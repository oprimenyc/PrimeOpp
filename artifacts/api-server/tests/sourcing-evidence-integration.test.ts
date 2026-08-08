// Real, DB-backed golden-path test for the arbitrary-scanned-product ->
// normalized market evidence -> BUY/PASS/WATCH loop (migration 0014).
//
// Every other test in this suite runs with no reachable Postgres (by
// design -- see withServer() in sourcing.test.ts) and verifies fail-closed
// behavior. This file is different: it requires a real local Postgres at
// postgres://test:test@127.0.0.1:5432/primeopp_test with all migrations
// applied (see lib/db/scripts/migrate.mjs), and exercises the actual HTTP
// routes end to end -- real login, real session cookie + CSRF token, real
// inserts, real reads -- because a static assertion or a mocked query
// cannot prove the evidence-by-identifier fix in the previous session's
// handoff actually works. If Postgres is not reachable, every test here
// fails loudly (not skipped) so a missing DB is never mistaken for a pass.
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

// Distinct per-test-run identifiers so re-runs against the same persistent
// test DB never collide with rows a previous run left behind.
const runId = "TESTRUN" + Math.abs(hashCode(String(process.hrtime.bigint())));
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
const UPC = "036000291452"; // real-checksum UPC-A already used elsewhere in this suite

describe("golden path: scan -> identify -> real evidence -> decision -> BUY -> LIST", () => {
  it("resolves to BUY once a real manually-entered observation exists for the scanned identifier", async () => {
    await withAuthedServer(async ({ baseUrl, authedFetch }) => {
      // 1. Start a session (a real store trip).
      const sessionRes = await authedFetch(`${baseUrl}/api/sourcing/sessions`, {
        method: "POST",
        body: JSON.stringify({ label: `${runId}-golden-path` }),
      });
      expect(sessionRes.status).toBe(201);
      const session = await sessionRes.json();

      // 2. Scan an item that has never existed in PrimeOpp's own catalog.
      //    No evidence exists yet -- this must be honest, not fabricated.
      const itemRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items`, {
        method: "POST",
        body: JSON.stringify({ query: UPC, source: "BARCODE" }),
      });
      expect(itemRes.status).toBe(201);
      const item = await itemRes.json();
      expect(item.matchedProductId).toBeNull(); // never in PrimeOpp's own catalog
      expect(item.normalizedIdentifier).toBe(UPC); // but identity was still resolved
      expect(item.decision.decision).toBe("INSUFFICIENT_DATA"); // no cost yet -- not fabricated

      // 3. Set acquisition cost/shipping and a target platform. Still no
      //    market evidence exists for this identifier -- must stay WATCH,
      //    never guess a number.
      const withCostRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ acquisitionCost: 18, shippingEstimate: 7, targetPlatform: "ebay" }),
      });
      const withCost = await withCostRes.json();
      expect(withCost.decision.decision).toBe("WATCH");
      expect(withCost.decision.reason).toMatch(/evidence/i);
      expect(withCost.evidenceSummary).toEqual([]);

      // 4. BYOD: the operator checked eBay themselves and enters the real
      //    sold price they saw. This is the ONLY writer into
      //    platform_price_observations anywhere in the app.
      const evidenceRes = await authedFetch(`${baseUrl}/api/pricing/observations/manual`, {
        method: "POST",
        body: JSON.stringify({
          observations: [{
            normalizedIdentifier: UPC,
            identifierType: "UPC",
            platform: "ebay",
            listingType: "SOLD",
            price: 59.99,
            matchConfidence: "MEDIUM",
          }],
        }),
      });
      expect(evidenceRes.status).toBe(201);

      // 5. Re-fetch the item: real evidence now resolves to a real,
      //    explainable BUY -- the mission's own worked example
      //    ($18 acquisition, ~$60 sale, real fees/shipping, ~139% ROI).
      const itemsRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items`);
      const items = await itemsRes.json();
      const resolved = items.find((row: { id: number }) => row.id === item.id);
      expect(resolved.decision.decision).toBe("BUY");
      expect(resolved.decision.estimatedProfit).toBeGreaterThan(20);
      expect(resolved.decision.estimatedProfit).toBeLessThan(30);
      expect(resolved.decision.roiPercent).toBeGreaterThan(100);
      expect(resolved.decision.evidenceConfidence).toBe("MEDIUM");
      expect(resolved.decision.evidenceSampleCount).toBe(1);
      expect(resolved.evidenceSummary).toEqual([
        expect.objectContaining({ platform: "ebay", listingType: "SOLD", price: 59.99, sourceType: "MANUAL_ENTRY" }),
      ]);

      // 6. BUY -> LIST: reuses the existing Listing Workspace pipeline, not
      //    a duplicate one, and now persists channelDrafts/exports too
      //    (the previous session's fix).
      const listingRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items/${item.id}/create-listing`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      expect(listingRes.status).toBe(201);
      const listing = await listingRes.json();
      expect(listing.canonicalListingPackageId).toBeTruthy();
      expect(Array.isArray(listing.channelDrafts)).toBe(true);
      expect(listing.channelDrafts.length).toBeGreaterThan(0);
      expect(Array.isArray(listing.exports)).toBe(true);
    });
  });

  it("keeps evidence from different platforms separate -- never averaged or cross-contaminated", async () => {
    await withAuthedServer(async ({ baseUrl, authedFetch }) => {
      // No hyphens/dots/whitespace: classifyProductIntake strips those
      // before normalizing, so a hyphenated literal would not round-trip
      // back out as the same string this test submits as evidence for.
      const identifier = `${runId}MULTIPLATFORM`;
      const sessionRes = await authedFetch(`${baseUrl}/api/sourcing/sessions`, { method: "POST", body: JSON.stringify({ label: `${runId}-multi` }) });
      const session = await sessionRes.json();
      const itemRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items`, {
        method: "POST",
        body: JSON.stringify({ query: identifier, source: "MANUAL_IDENTIFIER" }),
      });
      const item = await itemRes.json();

      await authedFetch(`${baseUrl}/api/pricing/observations/manual`, {
        method: "POST",
        body: JSON.stringify({
          observations: [
            { normalizedIdentifier: identifier, platform: "ebay", listingType: "SOLD", price: 59.99, matchConfidence: "MEDIUM" },
            { normalizedIdentifier: identifier, platform: "stockx", listingType: "ACTIVE", price: 75, matchConfidence: "HIGH" },
          ],
        }),
      });

      const itemsRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items`);
      const resolved = (await itemsRes.json()).find((row: { id: number }) => row.id === item.id);

      // Concise cross-platform summary keeps both sources distinct.
      expect(resolved.evidenceSummary).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ platform: "ebay", listingType: "SOLD", price: 59.99 }),
          expect.objectContaining({ platform: "stockx", listingType: "ACTIVE", price: 75 }),
        ]),
      );
      expect(resolved.evidenceSummary).toHaveLength(2);

      // The decision itself only uses whichever platform is selected as the
      // sell-through venue (fees differ per venue) -- it must not blend
      // eBay's sold comp into a StockX-targeted decision or vice versa.
      const targetEbay = await (await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ acquisitionCost: 20, targetPlatform: "ebay" }),
      })).json();
      expect(targetEbay.decision.recommendedListPrice).toBe(59.99);

      const targetStockx = await (await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ targetPlatform: "stockx" }),
      })).json();
      expect(targetStockx.decision.recommendedListPrice).toBe(75);
    });
  });

  it("rejects a manual observation scoped to nothing (no productId, no normalizedIdentifier)", async () => {
    await withAuthedServer(async ({ baseUrl, authedFetch }) => {
      const res = await authedFetch(`${baseUrl}/api/pricing/observations/manual`, {
        method: "POST",
        body: JSON.stringify({ observations: [{ platform: "ebay", listingType: "SOLD", price: 10 }] }),
      });
      expect(res.status).toBe(400);
    });
  });

  it("stays WATCH, never fabricates, when an identified item has zero market evidence anywhere", async () => {
    await withAuthedServer(async ({ baseUrl, authedFetch }) => {
      const sessionRes = await authedFetch(`${baseUrl}/api/sourcing/sessions`, { method: "POST", body: JSON.stringify({ label: `${runId}-no-evidence` }) });
      const session = await sessionRes.json();
      const itemRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items`, {
        method: "POST",
        body: JSON.stringify({ query: `${runId}NEVEROBSERVED`, source: "SEARCH" }),
      });
      const item = await itemRes.json();
      const updated = await (await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ acquisitionCost: 12, shippingEstimate: 4, targetPlatform: "ebay" }),
      })).json();

      expect(updated.decision.decision).toBe("WATCH");
      expect(updated.decision.recommendedListPrice).toBeNull();
      expect(updated.decision.estimatedProfit).toBeNull();
      expect(updated.evidenceSummary).toEqual([]);
    });
  });

  it("still resolves evidence for the operator's own catalog products by product_id (backward compatible)", async () => {
    await withAuthedServer(async ({ baseUrl, authedFetch }) => {
      const { query } = await import("../src/lib/db.js");
      const [product] = await query<{ id: number }>(
        `INSERT INTO products (title, price, type) VALUES ($1, 20, 'pod') RETURNING id`,
        [`${runId}-catalog-product`],
      );

      await authedFetch(`${baseUrl}/api/pricing/observations/manual`, {
        method: "POST",
        body: JSON.stringify({ observations: [{ productId: product.id, platform: "etsy", listingType: "ACTIVE", price: 44, matchConfidence: "HIGH" }] }),
      });

      const sessionRes = await authedFetch(`${baseUrl}/api/sourcing/sessions`, { method: "POST", body: JSON.stringify({ label: `${runId}-catalog` }) });
      const session = await sessionRes.json();
      // A sourcing item is only ever linked to matched_product_id through
      // the real identifier-map lookup, which needs no live provider to
      // exercise this path -- directly setting it here isolates the
      // assertion to "does product_id-scoped evidence still resolve",
      // which is what this test is actually checking.
      const itemRows = await query<{ id: number }>(
        `INSERT INTO sourcing_session_items (session_id, raw_query, intake_source, matched_product_id, acquisition_cost, shipping_estimate, target_platform)
         VALUES ($1, $2, 'MANUAL_IDENTIFIER', $3, 10, 4, 'etsy') RETURNING id`,
        [session.id, `${runId}-catalog-scan`, product.id],
      );
      const itemId = itemRows[0].id;

      const itemsRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items`);
      const resolved = (await itemsRes.json()).find((row: { id: number }) => row.id === itemId);
      expect(resolved.decision.recommendedListPrice).toBe(44);
      expect(resolved.decision.decision).toBe("BUY");
    });
  });
});

afterAll(async () => {
  const { query, pool } = await import("../src/lib/db.js");
  await query("DELETE FROM platform_price_observations WHERE normalized_identifier LIKE $1 OR normalized_identifier = $2", [`${runId}%`, "036000291452"]);
  await query("DELETE FROM sourcing_session_items WHERE raw_query LIKE $1 OR raw_query = $2", [`${runId}%`, "036000291452"]);
  await query("DELETE FROM sourcing_sessions WHERE label LIKE $1", [`${runId}%`]);
  await query("DELETE FROM products WHERE title LIKE $1", [`${runId}%`]);
  await pool.end();
});
