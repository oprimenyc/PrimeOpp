import { describe, it, expect, beforeAll } from "vitest";
import type { AddressInfo } from "node:net";

// These tests verify Phase 4 of the fail-closed payment requirement: the app
// must boot and serve non-payment routes even when Stripe is not configured,
// while payment/webhook routes must return an explicit 503 rather than
// crashing, silently no-opping, or granting paid access.
beforeAll(() => {
  process.env["DATABASE_URL"] = "postgres://test:test@127.0.0.1:5432/primeopp_test";
  process.env["SESSION_SECRET"] = "a".repeat(32);
  process.env["ADMIN_EMAIL"] = "admin@example.com";
  process.env["ADMIN_PASSWORD"] = "password12345";
  delete process.env["STRIPE_SECRET_KEY"];
  delete process.env["STRIPE_WEBHOOK_SECRET"];
});

describe("validateEnv", () => {
  it("does not throw when Stripe vars are absent", async () => {
    const { validateEnv } = await import("../src/lib/env.js");
    expect(() => validateEnv()).not.toThrow();
  });

  it("still throws when a genuinely required var is missing", async () => {
    const { validateEnv } = await import("../src/lib/env.js");
    const original = process.env["SESSION_SECRET"];
    delete process.env["SESSION_SECRET"];
    try {
      expect(() => validateEnv()).toThrow(/SESSION_SECRET/);
    } finally {
      process.env["SESSION_SECRET"] = original;
    }
  });
});

async function withServer(fn: (baseUrl: string) => Promise<void>) {
  const { default: app } = await import("../src/app.js");
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const port = (server.address() as AddressInfo).port;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("payment routes fail closed without Stripe configured", () => {
  it("app boots (health route reachable) without Stripe secrets", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/healthz`);
      expect(res.status).toBe(200);
    });
  });

  it("checkout session creation returns 503, no paid access granted", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/checkout/session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: [{ product_id: 1, title: "Test Shirt", quantity: 1, size: "M", color: "Black", price: 10 }],
        }),
      });
      expect(res.status).toBe(503);
      const body = await res.json() as { error: string };
      expect(body.error).toMatch(/Stripe not configured/);
    });
  });

  it("checkout session retrieval returns 503", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/checkout/session/cs_test_123`);
      expect(res.status).toBe(503);
    });
  });

  it("webhook fails closed (503) when Stripe secret is missing, no order mutation attempted", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/webhook`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "checkout.session.completed" }),
      });
      expect(res.status).toBe(503);
    });
  });
});
