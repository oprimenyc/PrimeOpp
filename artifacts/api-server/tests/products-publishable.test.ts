// Real, DB-backed regression coverage for the storefront-publishable gate
// (migration 0016 + isPublishableProduct() in routes/products.ts).
//
// The gap this closes: POST /products has never server-side enforced the
// "affiliate products require an affiliate link" rule that admin.tsx's form
// already enforces client-side. IdentityCorrectionPanel (Sourcing's
// identity-recovery flow) calls that exact same endpoint with only a title,
// so it could silently produce a live, publicly-listed, checkout-purchasable
// affiliate product with no link and a $0 price. This proves:
//   1. an identity-only product (no external_link) is created but NOT
//      publishable, and cannot reach the storefront list, the product
//      detail page, or checkout, regardless of its type: "affiliate".
//   2. a real, complete affiliate product continues to work exactly as
//      before -- no regression to legitimate product creation/checkout.
//   3. pod products (which never had this requirement) are unaffected.
//
// Separate file on purpose: each vitest file gets an isolated module
// registry and therefore its own fresh /api/auth/login rate-limiter budget.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
const DATABASE_URL = "postgres://test:test@127.0.0.1:5432/primeopp_test";

describe("products publishable migration", () => {
  const migration = readFileSync(path.join(repoRoot, "lib/db/migrations/0016_products_publishable.sql"), "utf8");

  it("is additive only -- adds one column (defaulted true, so existing rows are unchanged) and an index, drops nothing", () => {
    expect(migration).not.toMatch(/\bDROP TABLE\b|\bDELETE FROM\b|\bDROP COLUMN\b/i);
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT true");
  });
});

beforeAll(() => {
  process.env["DATABASE_URL"] = DATABASE_URL;
  process.env["SESSION_SECRET"] = "a".repeat(32);
  // Reuses the same admin credentials as sourcing-identity-correction.test.ts:
  // the test DB persists across test files in a run, and seedInitialAdminUser()
  // is a one-time no-op once any admin_users row exists -- whichever file's
  // credentials seeded the DB first "wins" for the whole run.
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

const runId = "PUBFIX" + Math.abs(hashCode(String(process.hrtime.bigint())));
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

describe("storefront publishable gate (identity-only products vs. real storefront products)", () => {
  it("an affiliate product created with no external_link (the identity-correction shape) is not publishable", async () => {
    await withAuthedServer(async ({ baseUrl, authedFetch }) => {
      const createRes = await authedFetch(`${baseUrl}/api/products`, {
        method: "POST",
        body: JSON.stringify({ type: "affiliate", title: `${runId} Unlinked Affiliate Product`, category: "Footwear" }),
      });
      expect(createRes.status).toBe(201);
      const product = await createRes.json();
      // Never trusted from the client -- the request above sent no
      // is_published field at all, and productSchema doesn't even accept one.
      expect(product.is_published).toBe(false);

      // 1. Never appears in the public storefront list.
      const listRes = await authedFetch(`${baseUrl}/api/products`);
      const list = await listRes.json();
      expect(list.some((p: { id: number }) => p.id === product.id)).toBe(false);

      // 2. Direct-by-id fetch (the product detail page) 404s exactly as if
      //    it didn't exist -- no incomplete/unpurchasable page is served.
      const detailRes = await authedFetch(`${baseUrl}/api/products/${product.id}`);
      expect(detailRes.status).toBe(404);

      // 3. Checkout rejects it outright -- defense in depth even if some
      //    client-side bug ever put its id in a cart payload. Tested via a
      //    direct import of validateAndPriceItems since the checkout route
      //    fails closed with 503 before this point when Stripe isn't
      //    configured (see stripe-fail-closed.test.ts) -- this is the same
      //    function the route calls, not a re-implementation.
      const { validateAndPriceItems } = await import("../src/routes/orders.js");
      await expect(
        validateAndPriceItems([
          { product_id: product.id, title: product.title, quantity: 1, size: "", color: "", price: 0 },
        ]),
      ).rejects.toThrow(/not available/i);
    });
  });

  it("a real, complete affiliate product (with an external_link) is publishable and purchasable -- no regression", async () => {
    await withAuthedServer(async ({ baseUrl, authedFetch }) => {
      const createRes = await authedFetch(`${baseUrl}/api/products`, {
        method: "POST",
        body: JSON.stringify({
          type: "affiliate",
          title: `${runId} Real Affiliate Product`,
          external_link: "https://example.com/affiliate?ref=primeopp",
          price: 29.99,
        }),
      });
      expect(createRes.status).toBe(201);
      const product = await createRes.json();
      expect(product.is_published).toBe(true);

      const listRes = await authedFetch(`${baseUrl}/api/products`);
      const list = await listRes.json();
      expect(list.some((p: { id: number }) => p.id === product.id)).toBe(true);

      const detailRes = await authedFetch(`${baseUrl}/api/products/${product.id}`);
      expect(detailRes.status).toBe(200);

      const { validateAndPriceItems } = await import("../src/routes/orders.js");
      const priced = await validateAndPriceItems([
        { product_id: product.id, title: product.title, quantity: 2, size: "", color: "", price: 0 },
      ]);
      expect(priced[0].price).toBe(29.99);
    });
  });

  it("a pod product with no price is still publishable -- this fix adds no new restriction for pod", async () => {
    await withAuthedServer(async ({ baseUrl, authedFetch }) => {
      const createRes = await authedFetch(`${baseUrl}/api/products`, {
        method: "POST",
        body: JSON.stringify({ type: "pod", title: `${runId} POD Product` }),
      });
      expect(createRes.status).toBe(201);
      const product = await createRes.json();
      expect(product.is_published).toBe(true);

      const detailRes = await authedFetch(`${baseUrl}/api/products/${product.id}`);
      expect(detailRes.status).toBe(200);
    });
  });

  it("adding the missing external_link later publishes the product automatically (self-healing, not a manual publish flag)", async () => {
    await withAuthedServer(async ({ baseUrl, authedFetch }) => {
      const createRes = await authedFetch(`${baseUrl}/api/products`, {
        method: "POST",
        body: JSON.stringify({ type: "affiliate", title: `${runId} Later Linked Product` }),
      });
      const product = await createRes.json();
      expect(product.is_published).toBe(false);

      const updateRes = await authedFetch(`${baseUrl}/api/products/${product.id}`, {
        method: "PUT",
        body: JSON.stringify({
          type: "affiliate",
          title: `${runId} Later Linked Product`,
          external_link: "https://example.com/now-linked",
        }),
      });
      expect(updateRes.status).toBe(200);
      const updated = await updateRes.json();
      expect(updated.is_published).toBe(true);

      const detailRes = await authedFetch(`${baseUrl}/api/products/${product.id}`);
      expect(detailRes.status).toBe(200);
    });
  });
});

afterAll(async () => {
  const { query, pool } = await import("../src/lib/db.js");
  await query("DELETE FROM products WHERE title LIKE $1", [`${runId}%`]);
  await pool.end();
});
