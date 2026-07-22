import { describe, it, expect, beforeAll } from "vitest";
import type { AddressInfo } from "node:net";

// Regression test: unmatched /api/* paths must return a JSON 404, not fall
// through to the SPA catch-all (which previously returned 200 + index.html
// for any unrecognized /api/* path).
beforeAll(() => {
  process.env["DATABASE_URL"] = "postgres://test:test@127.0.0.1:5432/primeopp_test";
  process.env["SESSION_SECRET"] = "a".repeat(32);
  process.env["ADMIN_EMAIL"] = "admin@example.com";
  process.env["ADMIN_PASSWORD"] = "password12345";
  delete process.env["STRIPE_SECRET_KEY"];
  delete process.env["STRIPE_WEBHOOK_SECRET"];
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

describe("/api/* 404 fallback", () => {
  it("returns JSON 404 for an unmatched /api path, not the SPA HTML", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/nonexistent`);
      expect(res.status).toBe(404);
      expect(res.headers.get("content-type")).toMatch(/application\/json/);
      const body = await res.json() as { error: string };
      expect(body.error).toBe("Not found");
    });
  });

  it("still serves the SPA HTML with 200 for a non-API path", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/some-nonexistent-route-xyz`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toMatch(/text\/html/);
    });
  });

  it("still serves 200 for the homepage", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/`);
      expect(res.status).toBe(200);
    });
  });
});
