// Real, DB-backed regression coverage for the BUY -> LIST price-discard fix.
//
// The gap this closes: routes/sourcing.ts's create-listing handler hardcoded
// `targetPrice: null` when calling generateListingWorkspace(), even though
// the decision engine (computeSourcingDecision, via withDecision) had
// already computed a real, evidence-backed recommendedListPrice one line of
// code away. Every listing created from Sourcing had no price anywhere --
// not on the canonical package, not on any channel draft, not on any
// export -- forcing the operator to manually re-derive a price PrimeOpp had
// already calculated, with no link back to the evidence that justified it.
//
// The fix carries decision.recommendedListPrice into generateListingWorkspace
// as targetPrice -- the exact same field routes/listings.ts's standalone
// Listing Workspace flow already populates from its own form input, and the
// exact same field pages/listing-workspace.tsx already reads back out (see
// its Sourcing handoff effect, `pkg.target_price`) -- so this is a pure data
// flow fix, not a new pricing engine and not a new frontend affordance.
//
// Separate file on purpose: each vitest file gets an isolated module
// registry and therefore its own fresh /api/auth/login rate-limiter budget.
import type { AddressInfo } from "node:net";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

const DATABASE_URL = "postgres://test:test@127.0.0.1:5432/primeopp_test";

beforeAll(() => {
  process.env["DATABASE_URL"] = DATABASE_URL;
  process.env["SESSION_SECRET"] = "a".repeat(32);
  // Reuses the same admin credentials as sourcing-identity-correction.test.ts
  // and products-publishable.test.ts: the test DB persists across test files
  // in a run, and seedInitialAdminUser() is a one-time no-op once any
  // admin_users row exists -- whichever file's credentials seeded the DB
  // first "wins" for the whole run.
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

const runId = "LISTPX" + Math.abs(hashCode(String(process.hrtime.bigint())));
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

describe("Sourcing BUY -> LIST carries the decision engine's recommendedListPrice into the listing", () => {
  it("a BUY item with real evidence produces a listing whose canonical package, channel drafts, and exports all carry the recommended price -- not null", async () => {
    await withAuthedServer(async ({ baseUrl, authedFetch }) => {
      const identifier = `${runId}BUYPRICE`;
      const sessionRes = await authedFetch(`${baseUrl}/api/sourcing/sessions`, { method: "POST", body: JSON.stringify({ label: `${runId}-buyprice` }) });
      const session = await sessionRes.json();

      // 1. Real item with a well-formed identifier.
      const itemRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items`, {
        method: "POST",
        body: JSON.stringify({ query: identifier, source: "MANUAL_IDENTIFIER" }),
      });
      const item = await itemRes.json();

      // Give it real economics.
      await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ acquisitionCost: 15, shippingEstimate: 5, targetPlatform: "ebay" }),
      });

      // 2 + 3. Real supported market evidence -> decision becomes BUY with a
      // real, non-null recommendedListPrice.
      const evidenceRes = await authedFetch(`${baseUrl}/api/pricing/observations/manual`, {
        method: "POST",
        body: JSON.stringify({
          observations: [{ normalizedIdentifier: identifier, platform: "ebay", listingType: "SOLD", price: 45, matchConfidence: "HIGH" }],
        }),
      });
      expect(evidenceRes.status).toBe(201);

      const itemsRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items`);
      const resolved = (await itemsRes.json()).find((row: { id: number }) => row.id === item.id);
      expect(resolved.decision.decision).toBe("BUY");
      expect(resolved.decision.recommendedListPrice).toBe(45);

      // 4. Operator invokes create-listing (the same request the "Create
      //    Listing" button in the Review Queue sends).
      const listingRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items/${item.id}/create-listing`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      expect(listingRes.status).toBe(201);
      const listing = await listingRes.json();

      // 5. Canonical package carries the real recommended price -- this is
      //    the exact assertion that was impossible before the fix, since
      //    target_price was unconditionally null.
      expect(Number(listing.canonicalListingPackage.target_price)).toBe(45);
      // Margin is now computable too (cost 15, price 45 -> 30), proving this
      // flows through generateListingWorkspace's existing margin math
      // unchanged -- not a second, duplicated calculation.
      expect(Number(listing.canonicalListingPackage.margin)).toBe(30);

      // 6. Channel drafts receive the price via the existing model
      //    (createDraftPayload already read canonical.target_price into
      //    channel_payload.targetPrice -- this was already wired, just fed
      //    null before).
      expect(listing.channelDrafts.length).toBeGreaterThan(0);
      for (const draft of listing.channelDrafts) {
        expect(draft.channel_payload.targetPrice).toBe(45);
      }
      // Exports spread the same channel_payload, so the price survives into
      // whatever the operator exports/copies out to a real marketplace too.
      expect(listing.exports.length).toBeGreaterThan(0);
      for (const listingExport of listing.exports) {
        expect(listingExport.export_payload.targetPrice).toBe(45);
      }

      // 7. Listing Workspace displays/retains this price: pages/listing-
      //    workspace.tsx's Sourcing-handoff effect reads
      //    canonicalListingPackage.target_price straight into its price
      //    input (pre-existing code, unmodified by this fix) -- proven here
      //    at the data layer that this field is populated for it to read.
      expect(listing.canonicalListingPackage.target_price).not.toBeNull();

      // 8. No duplicate/disconnected listing package: exactly one canonical
      //    package exists for this identifier, and the sourcing item points
      //    at that same one.
      const { query } = await import("../src/lib/db.js");
      const packages = await query<{ id: number }>(
        "SELECT id FROM canonical_listing_packages WHERE source_identifier=$1",
        [identifier],
      );
      expect(packages.length).toBe(1);

      const finalItemsRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items`);
      const finalItem = (await finalItemsRes.json()).find((row: { id: number }) => row.id === item.id);
      expect(finalItem.status).toBe("LISTED");
      expect(finalItem.canonicalListingPackageId).toBe(packages[0].id);
    });
  });

  it("an item with no supported evidence still lists with a null price -- no fabricated number is introduced", async () => {
    await withAuthedServer(async ({ baseUrl, authedFetch }) => {
      const identifier = `${runId}NOEVIDENCE`;
      const sessionRes = await authedFetch(`${baseUrl}/api/sourcing/sessions`, { method: "POST", body: JSON.stringify({ label: `${runId}-noevidence` }) });
      const session = await sessionRes.json();

      const itemRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items`, {
        method: "POST",
        body: JSON.stringify({ query: identifier, source: "MANUAL_IDENTIFIER" }),
      });
      const item = await itemRes.json();

      const listingRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items/${item.id}/create-listing`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      expect(listingRes.status).toBe(201);
      const listing = await listingRes.json();
      expect(listing.canonicalListingPackage.target_price).toBeNull();
      expect(listing.canonicalListingPackage.margin).toBeNull();
    });
  });
});

afterAll(async () => {
  const { query, pool } = await import("../src/lib/db.js");
  await query(
    `DELETE FROM listing_export_packages WHERE canonical_listing_id IN (SELECT id FROM canonical_listing_packages WHERE source_identifier LIKE $1)`,
    [`${runId}%`],
  );
  await query(
    `DELETE FROM channel_listing_drafts WHERE canonical_listing_id IN (SELECT id FROM canonical_listing_packages WHERE source_identifier LIKE $1)`,
    [`${runId}%`],
  );
  await query("UPDATE sourcing_session_items SET canonical_listing_package_id=NULL WHERE raw_query LIKE $1", [`${runId}%`]);
  await query("DELETE FROM canonical_listing_packages WHERE source_identifier LIKE $1", [`${runId}%`]);
  await query("DELETE FROM platform_price_observations WHERE normalized_identifier LIKE $1", [`${runId}%`]);
  await query("DELETE FROM sourcing_session_items WHERE raw_query LIKE $1", [`${runId}%`]);
  await query("DELETE FROM sourcing_sessions WHERE label LIKE $1", [`${runId}%`]);
  await pool.end();
});
