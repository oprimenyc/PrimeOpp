// Real, DB-backed test for the Review Queue identity-recovery flow
// (migration 0015 + the matchedProductId branch of PATCH .../items/:itemId).
//
// The gap this closes: a scanned item that was never in PrimeOpp's own
// catalog reaches the Review Queue as NOT_FOUND or AMBIGUOUS with no way to
// correct it in-page -- the only path was leaving Sourcing entirely,
// re-entering the same identifier on the separate Listing Workspace page,
// and saving a mapping there. This test proves the full in-page recovery
// path end to end: NOT_FOUND/AMBIGUOUS -> operator corrects identity
// (createProduct + saveProductIdentifierMapping, exactly what
// IdentityCorrectionPanel calls) -> item updates immediately -> evidence
// attaches to the corrected identity -> BUY/PASS/WATCH proceeds -> the
// existing BUY->LIST pipeline still works for a manually-corrected item.
//
// Separate file from sourcing-evidence-integration.test.ts on purpose: each
// test file gets its own isolated module registry (and therefore its own
// fresh /api/auth/login rate-limiter budget of 5 attempts per 15 minutes),
// so adding logins here doesn't eat into that file's already-used budget.
import type { AddressInfo } from "node:net";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

const DATABASE_URL = "postgres://test:test@127.0.0.1:5432/primeopp_test";

beforeAll(() => {
  process.env["DATABASE_URL"] = DATABASE_URL;
  process.env["SESSION_SECRET"] = "a".repeat(32);
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

const runId = "IDFIX" + Math.abs(hashCode(String(process.hrtime.bigint())));
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

describe("Review Queue identity recovery (NOT_FOUND/AMBIGUOUS -> corrected -> evidence -> decision)", () => {
  it("recovers a NOT_FOUND item to a manually-corrected identity, then evidence and BUY/PASS/WATCH work from it", async () => {
    await withAuthedServer(async ({ baseUrl, authedFetch }) => {
      const identifier = `${runId}NOTFOUND`;
      const sessionRes = await authedFetch(`${baseUrl}/api/sourcing/sessions`, { method: "POST", body: JSON.stringify({ label: `${runId}-notfound` }) });
      const session = await sessionRes.json();

      // 1. NOT_FOUND item: a real, well-formed identifier (alphanumeric SKU
      //    shape) with no catalog match. This is the common case, not an
      //    edge case -- most items scanned at a real store were never
      //    previously in PrimeOpp's own catalog.
      const itemRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items`, {
        method: "POST",
        body: JSON.stringify({ query: identifier, source: "MANUAL_IDENTIFIER" }),
      });
      expect(itemRes.status).toBe(201);
      const item = await itemRes.json();
      expect(item.lookupStatus).toBe("NOT_FOUND");
      expect(item.matchedProductId).toBeNull();
      expect(item.title).toBeNull();
      // A letters+digits value with no separators classifies as STYLE_CODE,
      // not SKU (looksLikeStyleCode() in productIntake.ts) -- the mapping
      // saved below must use the SAME type, exactly as
      // IdentityCorrectionPanel derives it from item.identifierType rather
      // than hardcoding one.
      expect(item.identifierType).toBe("STYLE_CODE");
      // Classification confidence is persisted (migration 0015), not
      // discarded after this response -- HIGH here because the format
      // itself classifies confidently even with no catalog match.
      expect(item.identityConfidence).toBe("HIGH");

      // Before correction: still resolves to WATCH/no evidence, never a
      // fabricated decision, since the item DOES have a real identifier
      // even with no catalog match (evidence lookup keys off
      // normalized_identifier, not matched_product_id).
      const withCostRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ acquisitionCost: 15, shippingEstimate: 5, targetPlatform: "ebay" }),
      });
      const withCost = await withCostRes.json();
      expect(withCost.decision.decision).toBe("WATCH");
      expect(withCost.evidenceSummary).toEqual([]);

      // 2. Operator corrects the identity -- exactly what
      //    IdentityCorrectionPanel does: create a new catalog product, save
      //    the identifier mapping (the SAME endpoint Listing Workspace
      //    uses), then link the item to it.
      const createProductRes = await authedFetch(`${baseUrl}/api/products`, {
        method: "POST",
        body: JSON.stringify({ type: "affiliate", title: `${runId} Corrected Product`, category: "Footwear" }),
      });
      expect(createProductRes.status).toBe(201);
      const product = await createProductRes.json();
      // This product exists purely as an identity anchor for the sourcing
      // item -- it has no price/external_link, so it must NOT be a live
      // storefront listing (see products-publishable.test.ts for the full
      // regression coverage of that invariant). Evidence/decision/BUY->LIST
      // below all still work from an unpublished product, proving the
      // identity-record and publishable-storefront-product concepts are
      // genuinely decoupled.
      expect(product.is_published).toBe(false);

      const mappingRes = await authedFetch(`${baseUrl}/api/product-identifiers`, {
        method: "POST",
        body: JSON.stringify({
          productId: product.id,
          identifier,
          identifierType: "STYLE_CODE",
          source: "MANUAL",
          confidence: "HIGH",
          isPrimary: true,
        }),
      });
      expect(mappingRes.status).toBe(201);

      // 3 + 4. Saved mapping now exists; link this item to it.
      const correctedRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ matchedProductId: product.id, title: `${runId} Corrected Product`, category: "Footwear" }),
      });
      expect(correctedRes.status).toBe(200);
      const corrected = await correctedRes.json();

      // 5. Corrected identity displayed immediately -- no page reload, no
      //    recreating the item.
      expect(corrected.matchedProductId).toBe(product.id);
      expect(corrected.title).toBe(`${runId} Corrected Product`);
      expect(corrected.lookupStatus).toBe("FOUND");
      expect(corrected.lookupSource).toBe("MANUAL_CORRECTION");
      // Confidence flips to the distinct "a human verified this" state --
      // never silently relabeled as if the classifier had found it itself.
      expect(corrected.identityConfidence).toBe("MANUAL");

      // Saved mapping is real and reusable: the NEXT scan of this exact
      // identifier resolves automatically, not just this one item.
      const reintakeRes = await authedFetch(`${baseUrl}/api/products/intake`, {
        method: "POST",
        body: JSON.stringify({ query: identifier, source: "MANUAL_IDENTIFIER" }),
      });
      const reintake = await reintakeRes.json();
      expect(reintake.lookupStatus).toBe("FOUND");
      expect(reintake.matchedProductId).toBe(String(product.id));

      // 6 + 7. Evidence attaches to the corrected identity and the decision
      //    engine receives it -- same evidence pipeline, no special case.
      const evidenceRes = await authedFetch(`${baseUrl}/api/pricing/observations/manual`, {
        method: "POST",
        body: JSON.stringify({
          observations: [{ normalizedIdentifier: identifier, platform: "ebay", listingType: "SOLD", price: 45, matchConfidence: "HIGH" }],
        }),
      });
      expect(evidenceRes.status).toBe(201);

      const itemsRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items`);
      const resolved = (await itemsRes.json()).find((row: { id: number }) => row.id === item.id);
      expect(resolved.evidenceSummary).toEqual([expect.objectContaining({ platform: "ebay", listingType: "SOLD", price: 45 })]);

      // 8. BUY/PASS/WATCH still works -- real computed decision, not a
      //    special-cased "corrected item" path.
      expect(resolved.decision.decision).toBe("BUY");
      expect(resolved.decision.recommendedListPrice).toBe(45);
      expect(resolved.identityConfidence).toBe("MANUAL");

      // 9. Existing Listing Workspace flow remains intact for a
      //    manually-corrected item: BUY -> LIST still persists a full
      //    package (channelDrafts/exports), not a truncated stand-in.
      const listingRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items/${item.id}/create-listing`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      expect(listingRes.status).toBe(201);
      const listing = await listingRes.json();
      expect(listing.canonicalListingPackageId).toBeTruthy();
      expect(Array.isArray(listing.channelDrafts)).toBe(true);
      expect(listing.channelDrafts.length).toBeGreaterThan(0);
    });
  });

  it("persists AMBIGUOUS classification confidence for an item the local classifier itself isn't sure about", async () => {
    await withAuthedServer(async ({ baseUrl, authedFetch }) => {
      // A 10-digit numeric value that fails the ISBN-10 checksum is exactly
      // the case analyzeIdentifierByContract() flags as genuinely ambiguous
      // (could be a numeric SKU or an invalid ISBN) -- not a clean match,
      // not a clean miss either.
      const ambiguousValue = "1234567891"; // 10-digit numeric, fails ISBN-10 checksum
      const sessionRes = await authedFetch(`${baseUrl}/api/sourcing/sessions`, { method: "POST", body: JSON.stringify({ label: `${runId}-ambiguous` }) });
      const session = await sessionRes.json();

      const itemRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items`, {
        method: "POST",
        body: JSON.stringify({ query: ambiguousValue, source: "MANUAL_IDENTIFIER" }),
      });
      const item = await itemRes.json();

      // The create response still carries the transient classification
      // block for this one request...
      expect(item.classification.confidence).toBe("LOW");
      expect(item.valid).toBe(false);
      // ...and it is now ALSO persisted on the item row itself, so it does
      // not vanish the moment this response is gone -- unlike before
      // migration 0015, when only this one response ever carried it.
      expect(item.identityConfidence).toBe("LOW");

      // Re-fetching the item (simulating the operator returning to the
      // queue later) still shows the same honest, non-fabricated signal.
      const itemsRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items`);
      const refetched = (await itemsRes.json()).find((row: { id: number }) => row.id === item.id);
      expect(refetched.identityConfidence).toBe("LOW");
      expect(refetched.lookupStatus).not.toBe("FOUND");
    });
  });

  it("rejects an identity correction pointing at a product that does not exist, with a clean 400 -- not a raw FK violation", async () => {
    await withAuthedServer(async ({ baseUrl, authedFetch }) => {
      const sessionRes = await authedFetch(`${baseUrl}/api/sourcing/sessions`, { method: "POST", body: JSON.stringify({ label: `${runId}-bad-product` }) });
      const session = await sessionRes.json();
      const itemRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items`, {
        method: "POST",
        body: JSON.stringify({ query: `${runId}BADPRODUCT`, source: "MANUAL_IDENTIFIER" }),
      });
      const item = await itemRes.json();

      const res = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ matchedProductId: 999_999_999 }),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("product_not_found");
    });
  });
});

afterAll(async () => {
  const { query, pool } = await import("../src/lib/db.js");
  await query("DELETE FROM platform_price_observations WHERE normalized_identifier LIKE $1", [`${runId}%`]);
  await query("DELETE FROM sourcing_session_items WHERE raw_query LIKE $1", [`${runId}%`]);
  await query("DELETE FROM sourcing_sessions WHERE label LIKE $1", [`${runId}%`]);
  await query("DELETE FROM product_identifiers WHERE identifier LIKE $1", [`${runId}%`]);
  await query("DELETE FROM products WHERE title LIKE $1", [`${runId}%`]);
  await pool.end();
});
