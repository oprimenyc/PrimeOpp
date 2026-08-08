// Real, DB-backed regression coverage for a normalization mismatch between
// three places that all need to agree on the exact same string for an
// identifier to "match": classifyProductIntake() (sourcing items),
// POST /product-identifiers (saved identity-correction mappings), and
// POST /pricing/observations/manual (evidence, including the CSV bulk-import
// path).
//
// The bug: classifyProductIntake() only stripped whitespace/dashes/periods
// (never uppercased), while POST /product-identifiers always normalized via
// normalizeProductIdentifier() (strip AND uppercase). Any alphanumeric
// identifier with lowercase letters -- a real SKU or style code, not a
// barcode, where case is common ("nike-270-blk") -- would classify one way
// on the sourcing item and store a different way in the saved mapping, so
// they could never match. This broke the exact promise
// IdentityCorrectionPanel makes in its own comments: "this barcode resolves
// automatically next time too." Evidence had the same problem in the other
// direction: nothing normalized it at all, so a value pasted from a
// spreadsheet in different formatting than a scan produced would insert
// "successfully" and then never be found.
//
// Fix: classifyProductIntake() and the manual-observation route both now run
// through the same normalizeProductIdentifier() used by
// POST /product-identifiers. Migration 0017 backfills existing rows to match.
//
// Separate file on purpose: each vitest file gets an isolated module
// registry and therefore its own fresh /api/auth/login rate-limiter budget.
import type { AddressInfo } from "node:net";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

const DATABASE_URL = "postgres://test:test@127.0.0.1:5432/primeopp_test";

beforeAll(() => {
  process.env["DATABASE_URL"] = DATABASE_URL;
  process.env["SESSION_SECRET"] = "a".repeat(32);
  // Reuses the same admin credentials as the other sourcing/listings test
  // files: the test DB persists across files in a run, and
  // seedInitialAdminUser() is a one-time no-op once any admin_users row
  // exists -- whichever file's credentials seeded the DB first "wins".
  process.env["ADMIN_EMAIL"] = "sourcing-evidence-test@example.com";
  process.env["ADMIN_PASSWORD"] = "password12345";
  delete process.env["STRIPE_SECRET_KEY"];
  delete process.env["STRIPE_WEBHOOK_SECRET"];
});

async function withAuthedServer(fn: (ctx: { baseUrl: string; authedFetch: typeof fetch }) => Promise<void>) {
  const { default: app } = await import("../src/app.js");
  const { seedInitialAdminUser } = await import("../src/lib/auth.js");
  await seedInitialAdminUser();

  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: process.env["ADMIN_EMAIL"], password: process.env["ADMIN_PASSWORD"] }),
    });
    if (loginRes.status !== 200) {
      throw new Error(`admin login failed with ${loginRes.status}: ${await loginRes.text()}`);
    }
    const setCookie = loginRes.headers.get("set-cookie") ?? "";
    const cookie = setCookie.split(";")[0];
    const { csrfToken } = (await loginRes.json()) as { csrfToken: string };

    const authedFetch: typeof fetch = (input, init = {}) => {
      const headers = new Headers(init.headers);
      headers.set("cookie", cookie);
      headers.set("x-csrf-token", csrfToken);
      if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
      return fetch(input, { ...init, headers });
    };

    await fn({ baseUrl, authedFetch });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

// Lowercase on purpose -- digits alone (like the other test files' runId
// convention) would never trigger the case-mismatch this bug depended on.
const runId = "normfix" + Math.abs(hashCode(String(process.hrtime.bigint())));
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

describe("Identifier normalization is consistent across sourcing items, saved mappings, and evidence", () => {
  it("a mixed-case style code, once corrected, auto-resolves on the NEXT scan of the exact same text -- the promise IdentityCorrectionPanel makes", async () => {
    await withAuthedServer(async ({ baseUrl, authedFetch }) => {
      // Lowercase letters + digits + a dash: classifies as STYLE_CODE, and
      // is exactly the shape (a real sneaker/apparel style code) where case
      // varies in practice.
      const rawIdentifier = `nike-270-${runId}`;

      const sessionRes = await authedFetch(`${baseUrl}/api/sourcing/sessions`, { method: "POST", body: JSON.stringify({ label: `${runId}-mixedcase` }) });
      const session = await sessionRes.json();

      const firstItemRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items`, {
        method: "POST",
        body: JSON.stringify({ query: rawIdentifier, source: "MANUAL_IDENTIFIER" }),
      });
      const firstItem = await firstItemRes.json();
      expect(firstItem.identifierType).toBe("STYLE_CODE");
      expect(firstItem.lookupStatus).toBe("NOT_FOUND");
      // Normalized to strip the dash AND uppercase -- this is the exact
      // value that must also come out of normalizeProductIdentifier() on
      // the mapping side for the two to ever match.
      expect(firstItem.normalizedIdentifier).toBe(`NIKE270${runId.toUpperCase()}`);

      // Operator corrects the identity via the exact same calls
      // IdentityCorrectionPanel makes: create a product, save the mapping
      // using the RAW identifier text (mixed case, with the dash) -- not a
      // pre-normalized value, since the panel just passes through what the
      // item shows.
      const createProductRes = await authedFetch(`${baseUrl}/api/products`, {
        method: "POST",
        body: JSON.stringify({ type: "affiliate", title: `${runId} Nike 270`, category: "Footwear" }),
      });
      const product = await createProductRes.json();

      const mappingRes = await authedFetch(`${baseUrl}/api/product-identifiers`, {
        method: "POST",
        body: JSON.stringify({
          productId: product.id,
          identifier: rawIdentifier, // mixed case, with the dash -- as typed
          identifierType: "STYLE_CODE",
          source: "MANUAL",
          confidence: "HIGH",
          isPrimary: true,
        }),
      });
      expect(mappingRes.status).toBe(201);
      // The mapping itself is stored normalized (this was already correct
      // before the fix) -- confirms the fix target is classifyProductIntake,
      // not this route.
      expect((await mappingRes.json()).normalizedIdentifier).toBe(`NIKE270${runId.toUpperCase()}`);

      await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items/${firstItem.id}`, {
        method: "PATCH",
        body: JSON.stringify({ matchedProductId: product.id, title: `${runId} Nike 270`, category: "Footwear" }),
      });

      // THE regression check: scan the exact same raw text again (a second,
      // independent item -- simulating the operator picking up another
      // unit of the same shoe later in the same trip). Before the fix, this
      // would still come back NOT_FOUND because the item's own
      // normalizedIdentifier never got uppercased to match the mapping.
      const secondItemRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items`, {
        method: "POST",
        body: JSON.stringify({ query: rawIdentifier, source: "MANUAL_IDENTIFIER" }),
      });
      const secondItem = await secondItemRes.json();
      expect(secondItem.lookupStatus).toBe("FOUND");
      expect(Number(secondItem.matchedProductId)).toBe(product.id);
      expect(secondItem.title).toBe(`${runId} Nike 270`);

      // Same check through the standalone Listing Workspace intake endpoint,
      // which is the other real entry point that resolves against saved
      // mappings.
      const intakeRes = await authedFetch(`${baseUrl}/api/products/intake`, {
        method: "POST",
        body: JSON.stringify({ query: rawIdentifier, source: "MANUAL_IDENTIFIER" }),
      });
      const intake = await intakeRes.json();
      expect(intake.lookupStatus).toBe("FOUND");
      expect(Number(intake.matchedProductId)).toBe(product.id);
    });
  });

  it("evidence submitted with different case/spacing than the scan still attaches -- the CSV bulk-import path is not case/format-sensitive", async () => {
    await withAuthedServer(async ({ baseUrl, authedFetch }) => {
      const rawIdentifier = `abc-999-${runId}`;
      const sessionRes = await authedFetch(`${baseUrl}/api/sourcing/sessions`, { method: "POST", body: JSON.stringify({ label: `${runId}-evidencecase` }) });
      const session = await sessionRes.json();

      const itemRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items`, {
        method: "POST",
        body: JSON.stringify({ query: rawIdentifier, source: "MANUAL_IDENTIFIER" }),
      });
      const item = await itemRes.json();
      await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ acquisitionCost: 10, shippingEstimate: 4, targetPlatform: "ebay" }),
      });

      // Evidence entered with completely different formatting than the
      // scan -- upper/lower mixed, and a space instead of a dash -- exactly
      // what a CSV pasted from a spreadsheet export would look like.
      const differentlyFormatted = `ABC 999 ${runId}`;
      const evidenceRes = await authedFetch(`${baseUrl}/api/pricing/observations/manual`, {
        method: "POST",
        body: JSON.stringify({
          observations: [{ normalizedIdentifier: differentlyFormatted, platform: "ebay", listingType: "SOLD", price: 30, matchConfidence: "HIGH" }],
        }),
      });
      expect(evidenceRes.status).toBe(201);
      // Stored normalized, not verbatim -- this is the exact assertion that
      // would have failed before the fix (it stored `differentlyFormatted`
      // untouched).
      expect((await evidenceRes.json()).observations[0].normalized_identifier).toBe(`ABC999${runId}`.toUpperCase());

      const itemsRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items`);
      const resolved = (await itemsRes.json()).find((row: { id: number }) => row.id === item.id);
      // Evidence resolves despite the formatting difference -- proves the
      // item's own normalized_identifier and the evidence row's now agree.
      expect(resolved.evidenceSummary).toEqual([expect.objectContaining({ platform: "ebay", listingType: "SOLD", price: 30 })]);
      expect(resolved.decision.decision).toBe("BUY");
    });
  });
});

afterAll(async () => {
  const { query, pool } = await import("../src/lib/db.js");
  await query("DELETE FROM platform_price_observations WHERE normalized_identifier LIKE $1", [`%${runId.toUpperCase()}%`]);
  await query("DELETE FROM sourcing_session_items WHERE raw_query LIKE $1", [`%${runId}%`]);
  await query("DELETE FROM sourcing_sessions WHERE label LIKE $1", [`${runId}%`]);
  await query("DELETE FROM product_identifiers WHERE identifier LIKE $1", [`%${runId}%`]);
  await query("DELETE FROM products WHERE title LIKE $1", [`${runId}%`]);
  await pool.end();
});
