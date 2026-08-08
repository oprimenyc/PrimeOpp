// Real, DB-backed regression coverage for making Sourcing's create-listing
// route safe to invoke more than once for the same item.
//
// The gap this closes: the route always INSERTed a new
// canonical_listing_packages row and unconditionally overwrote
// sourcing_session_items.canonical_listing_package_id, regardless of
// whether the item already had one. A double-click, a browser retry after
// a timeout, or a retry after the response (not the request) was lost all
// orphaned the original package -- and any channel drafts/exports already
// pulled from it -- while the item silently moved on to point at a second,
// brand-new one.
//
// Fix: if the item already references a canonical package, return that
// SAME package (200, not 201) instead of creating another. If the item has
// no package yet, it must be status === "BUY" to get one for the first
// time -- enforced server-side, not just by hiding the button.
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

const runId = "LISTIDEM" + Math.abs(hashCode(String(process.hrtime.bigint())));
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

async function makeBuyItem(baseUrl: string, authedFetch: typeof fetch, label: string, identifier: string) {
  const sessionRes = await authedFetch(`${baseUrl}/api/sourcing/sessions`, { method: "POST", body: JSON.stringify({ label }) });
  const session = await sessionRes.json();
  const itemRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items`, {
    method: "POST",
    body: JSON.stringify({ query: identifier, source: "MANUAL_IDENTIFIER" }),
  });
  const item = await itemRes.json();
  // Manual BUY, exactly as clicking the "Buy" button does (PATCH status),
  // independent of what the decision engine itself would recommend.
  await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items/${item.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "BUY" }),
  });
  return { session, itemId: item.id };
}

describe("Sourcing create-listing is idempotent and server-enforced", () => {
  it("a second create-listing call on an already-listed item returns the SAME package -- never creates a second one", async () => {
    await withAuthedServer(async ({ baseUrl, authedFetch }) => {
      const identifier = `${runId}DOUBLECLICK`;
      const { session, itemId } = await makeBuyItem(baseUrl, authedFetch, `${runId}-doubleclick`, identifier);

      const firstRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items/${itemId}/create-listing`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      expect(firstRes.status).toBe(201);
      const first = await firstRes.json();
      const packageId = first.canonicalListingPackageId;

      // Simulates a double-click / browser retry / lost-response retry --
      // the exact same request fired again for the same item.
      const secondRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items/${itemId}/create-listing`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      expect(secondRes.status).toBe(200); // not 201 -- nothing new was created
      const second = await secondRes.json();
      expect(Number(second.canonicalListingPackageId)).toBe(Number(packageId));
      expect(second.alreadyListed).toBe(true);

      // A third call for good measure -- this must stay stable, not merely
      // work "once more" by coincidence.
      const thirdRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items/${itemId}/create-listing`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      expect(thirdRes.status).toBe(200);
      expect(Number((await thirdRes.json()).canonicalListingPackageId)).toBe(Number(packageId));

      // Exactly one canonical package exists for this identifier, no matter
      // how many times create-listing was called.
      const { query } = await import("../src/lib/db.js");
      const packages = await query<{ id: number }>("SELECT id FROM canonical_listing_packages WHERE source_identifier=$1", [identifier]);
      expect(packages.length).toBe(1);
      expect(Number(packages[0].id)).toBe(Number(packageId));

      // Drafts/exports were not duplicated by the repeated calls either.
      const drafts = await query<{ id: number }>("SELECT id FROM channel_listing_drafts WHERE canonical_listing_id=$1", [packageId]);
      expect(drafts.length).toBe(1);
      const exportsRows = await query<{ id: number }>("SELECT id FROM listing_export_packages WHERE canonical_listing_id=$1", [packageId]);
      expect(exportsRows.length).toBe(1);

      // The sourcing item still points at that one package.
      const itemsRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items`);
      const finalItem = (await itemsRes.json()).find((row: { id: number }) => row.id === itemId);
      expect(Number(finalItem.canonicalListingPackageId)).toBe(Number(packageId));
      expect(finalItem.status).toBe("LISTED");
    });
  });

  it("rejects create-listing on an item that was never marked BUY -- the server enforces this, not just the button", async () => {
    await withAuthedServer(async ({ baseUrl, authedFetch }) => {
      const identifier = `${runId}NOTBUY`;
      const sessionRes = await authedFetch(`${baseUrl}/api/sourcing/sessions`, { method: "POST", body: JSON.stringify({ label: `${runId}-notbuy` }) });
      const session = await sessionRes.json();
      const itemRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items`, {
        method: "POST",
        body: JSON.stringify({ query: identifier, source: "MANUAL_IDENTIFIER" }),
      });
      const item = await itemRes.json();
      // Manually marked PASS, not BUY.
      await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "PASS" }),
      });

      const res = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items/${item.id}/create-listing`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe("item_not_buy");
      expect(body.status).toBe("PASS");

      const { query } = await import("../src/lib/db.js");
      const packages = await query<{ id: number }>("SELECT id FROM canonical_listing_packages WHERE source_identifier=$1", [identifier]);
      expect(packages.length).toBe(0);
    });
  });

  it("fails explicitly (409) rather than silently creating a replacement when an item's package reference is invalid", async () => {
    await withAuthedServer(async ({ baseUrl, authedFetch }) => {
      const identifier = `${runId}DANGLING`;
      const { session, itemId } = await makeBuyItem(baseUrl, authedFetch, `${runId}-dangling`, identifier);

      const listingRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items/${itemId}/create-listing`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const listing = await listingRes.json();
      const packageId = listing.canonicalListingPackageId;

      // Simulate a data-integrity anomaly: the referenced package no longer
      // exists. Nothing in the application itself deletes canonical
      // packages -- this forces the invariant violation directly to prove
      // the guard fires instead of silently fabricating a replacement.
      // sourcing_session_items.canonical_listing_package_id has
      // `ON DELETE SET NULL` (migration 0013), so this DELETE also clears
      // the item's own reference -- leaving it in exactly the anomalous
      // state the fix guards against: status still LISTED, but no package.
      const { query } = await import("../src/lib/db.js");
      await query("DELETE FROM channel_listing_drafts WHERE canonical_listing_id=$1", [packageId]);
      await query("DELETE FROM listing_export_packages WHERE canonical_listing_id=$1", [packageId]);
      await query("DELETE FROM canonical_listing_packages WHERE id=$1", [packageId]);

      const itemsAfterDelete = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items`);
      const itemAfterDelete = (await itemsAfterDelete.json()).find((row: { id: number }) => row.id === itemId);
      expect(itemAfterDelete.status).toBe("LISTED");
      expect(itemAfterDelete.canonicalListingPackageId).toBeNull();

      const retryRes = await authedFetch(`${baseUrl}/api/sourcing/sessions/${session.id}/items/${itemId}/create-listing`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      expect(retryRes.status).toBe(409);
      const body = await retryRes.json();
      expect(body.error).toBe("listing_reference_invalid");

      // No replacement package was fabricated for this identifier.
      const packages = await query<{ id: number }>("SELECT id FROM canonical_listing_packages WHERE source_identifier=$1", [identifier]);
      expect(packages.length).toBe(0);
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
  await query("DELETE FROM sourcing_session_items WHERE raw_query LIKE $1", [`${runId}%`]);
  await query("DELETE FROM sourcing_sessions WHERE label LIKE $1", [`${runId}%`]);
  await pool.end();
});
