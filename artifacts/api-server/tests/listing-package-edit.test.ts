// Real, DB-backed regression coverage for editing an already-existing
// canonical listing package without creating a disconnected duplicate.
//
// The gap this closes: routes/listings.ts had exactly one persistence path
// (POST /listings/packages -> INSERT). pages/listing-workspace.tsx's
// handlePackageSubmit always called that same create endpoint, even when
// the page had a package already open -- most notably right after a
// Sourcing BUY -> LIST handoff, where sourcing_session_items.
// canonical_listing_package_id already points at a real, correctly-priced
// package (see sourcing-listing-price.test.ts / commit c41f774). Editing
// any field on that page and saving created a SECOND, disconnected package
// while the sourcing item kept pointing at the stale original.
//
// Fix: PUT /listings/packages/:id (persistUpdatedListingWorkspace) updates
// the existing row and replaces its channel drafts/exports wholesale, using
// the exact same generateListingWorkspace() the create path uses -- no
// second pricing/generation logic. The frontend now calls this whenever
// `result` already carries a canonicalListingPackageId; a genuinely new
// scan/search clears `result` first (pre-existing runIntake() behavior), so
// that path still creates.
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

const runId = "LISTEDIT" + Math.abs(hashCode(String(process.hrtime.bigint())));
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

describe("Editing a listing package handed off from Sourcing updates it in place, never duplicates", () => {
  it("BUY -> LIST -> open in Listing Workspace -> edit a field -> save updates the SAME package, keeps the sourcing item attached, and stays internally consistent", async () => {
    await withAuthedServer(async ({ baseUrl, authedFetch }) => {
      const identifier = `${runId}HANDOFF`;

      // 1. Sourcing BUY item with real evidence.
      const sessionRes = await authedFetch(`${baseUrl}/api/sourcing/sessions`, { method: "POST", body: JSON.stringify({ label: `${runId}-handoff` }) });
      const session = await sessionRes.json();
      const itemRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items`, {
        method: "POST",
        body: JSON.stringify({ query: identifier, source: "MANUAL_IDENTIFIER" }),
      });
      const item = await itemRes.json();
      await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ acquisitionCost: 15, shippingEstimate: 5, targetPlatform: "ebay" }),
      });
      await authedFetch(`${baseUrl}/api/pricing/observations/manual`, {
        method: "POST",
        body: JSON.stringify({
          observations: [{ normalizedIdentifier: identifier, platform: "ebay", listingType: "SOLD", price: 45, matchConfidence: "HIGH" }],
        }),
      });

      // create-listing requires the item to actually be marked BUY (the
      // same manual PATCH the "Buy" button sends) -- server-enforced now,
      // not just implied by the decision engine's recommendation.
      await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "BUY" }),
      });

      // 2. Create listing package from Sourcing (the handoff's origin point).
      const createListingRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items/${item.id}/create-listing`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      expect(createListingRes.status).toBe(201);
      const listingA = await createListingRes.json();
      const packageId = listingA.canonicalListingPackageId;
      expect(Number(listingA.canonicalListingPackage.target_price)).toBe(45);

      // 3. Exactly one canonical package exists.
      const { query } = await import("../src/lib/db.js");
      const afterCreate = await query<{ id: number }>("SELECT id FROM canonical_listing_packages WHERE source_identifier=$1", [identifier]);
      expect(afterCreate.length).toBe(1);
      expect(Number(afterCreate[0].id)).toBe(Number(packageId));

      // 4. Sourcing item points to it.
      const itemsAfterCreate = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items`);
      const itemAfterCreate = (await itemsAfterCreate.json()).find((row: { id: number }) => row.id === item.id);
      expect(Number(itemAfterCreate.canonicalListingPackageId)).toBe(Number(packageId));
      expect(itemAfterCreate.status).toBe("LISTED");

      // 5 + 6 + 7. Open Listing Workspace through the handoff (this is what
      // pages/listing-workspace.tsx's Sourcing-handoff effect reads: the
      // canonicalListingPackage fields become the edit form's initial
      // values), change a field, and save via PUT -- exactly what
      // handlePackageSubmit now does once `result.canonicalListingPackageId`
      // is set. Change title AND price to prove both flow through, and add
      // a second channel to prove drafts/exports resync rather than merely
      // append.
      const editRes = await authedFetch(`${baseUrl}/api/listings/packages/${packageId}`, {
        method: "PUT",
        body: JSON.stringify({
          source: "SCAN",
          identifier: String(listingA.canonicalListingPackage.source_identifier),
          identifierType: listingA.canonicalListingPackage.identifier_type,
          productId: listingA.canonicalListingPackage.product_id,
          product: {
            title: `${runId} Edited Title`,
            description: listingA.canonicalListingPackage.description,
            category: listingA.canonicalListingPackage.category,
            condition: listingA.canonicalListingPackage.condition,
            costBasis: Number(listingA.canonicalListingPackage.cost_basis),
            targetPrice: 50, // operator adjusts the price up from the recommended $45
            shippingProfile: null,
          },
          selectedChannels: ["ebay", "general-resale"],
          createExports: true,
        }),
      });
      expect(editRes.status).toBe(200);
      const listingB = await editRes.json();

      // Same package id -- not a new one.
      expect(Number(listingB.canonicalListingPackageId)).toBe(Number(packageId));
      // 10. Updated values persisted.
      expect(listingB.canonicalListingPackage.title).toBe(`${runId} Edited Title`);
      expect(Number(listingB.canonicalListingPackage.target_price)).toBe(50);
      // Margin recomputed from the SAME existing math (generateListingWorkspace),
      // not a second pricing engine: cost 15, new price 50 -> margin 35.
      expect(Number(listingB.canonicalListingPackage.margin)).toBe(35);

      // 11. Channel drafts/exports remain synchronized with the edit -- 2
      //     drafts/exports now, not 1 (stale) + 2 (new) = 3.
      expect(listingB.channelDrafts.length).toBe(2);
      expect(listingB.exports.length).toBe(2);
      for (const draft of listingB.channelDrafts) {
        expect(draft.channel_payload.targetPrice).toBe(50);
        expect(Number(draft.canonical_listing_id)).toBe(Number(packageId));
      }

      // 8. Canonical package count is STILL ONE.
      const afterEdit = await query<{ id: number }>("SELECT id FROM canonical_listing_packages WHERE source_identifier=$1", [identifier]);
      expect(afterEdit.length).toBe(1);
      expect(Number(afterEdit[0].id)).toBe(Number(packageId));

      const draftRows = await query<{ id: number }>("SELECT id FROM channel_listing_drafts WHERE canonical_listing_id=$1", [packageId]);
      expect(draftRows.length).toBe(2);

      // 9. The sourcing item still points at the SAME package id -- the
      //    update route never touches sourcing_session_items, so there was
      //    nothing to drift.
      const itemsAfterEdit = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items`);
      const itemAfterEdit = (await itemsAfterEdit.json()).find((row: { id: number }) => row.id === item.id);
      expect(Number(itemAfterEdit.canonicalListingPackageId)).toBe(Number(packageId));
    });
  });

  it("editing a package id that does not exist 404s instead of silently creating one", async () => {
    await withAuthedServer(async ({ baseUrl, authedFetch }) => {
      const res = await authedFetch(`${baseUrl}/api/listings/packages/999999999`, {
        method: "PUT",
        body: JSON.stringify({
          source: "MANUAL_FALLBACK",
          identifier: `${runId}GHOST`,
          product: { title: "Ghost" },
          selectedChannels: ["general-resale"],
          createExports: true,
        }),
      });
      expect(res.status).toBe(404);
      expect((await res.json()).error).toBe("listing_package_not_found");
    });
  });

  it("a genuinely new Listing Workspace creation (no existing package) still creates a new package -- no regression", async () => {
    await withAuthedServer(async ({ baseUrl, authedFetch }) => {
      const identifier = `${runId}FRESHCREATE`;
      const res = await authedFetch(`${baseUrl}/api/listings/packages`, {
        method: "POST",
        body: JSON.stringify({
          source: "MANUAL_FALLBACK",
          identifier,
          product: { title: `${runId} Fresh Listing`, targetPrice: 20, costBasis: 10 },
          selectedChannels: ["general-resale"],
          createExports: true,
        }),
      });
      expect(res.status).toBe(201);
      const created = await res.json();
      expect(Number(created.canonicalListingPackage.target_price)).toBe(20);

      const { query } = await import("../src/lib/db.js");
      const rows = await query<{ id: number }>("SELECT id FROM canonical_listing_packages WHERE source_identifier=$1", [identifier]);
      expect(rows.length).toBe(1);
      expect(Number(rows[0].id)).toBe(Number(created.canonicalListingPackageId));
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
