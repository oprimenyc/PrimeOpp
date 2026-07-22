import { describe, expect, it, beforeAll } from "vitest";
import type { AddressInfo } from "node:net";
import { classifyProductIntake } from "../src/lib/productIntake.js";

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

describe("product intake classifier", () => {
  it("uses the product-intake contract for a valid barcode", () => {
    const result = classifyProductIntake("036000291452", "BARCODE");

    expect(result.normalizedIdentifier).toBe("036000291452");
    expect(result.identifierType).toBe("UPC_A");
    expect(result.valid).toBe(true);
    expect(result.classification.confidence).toBe("HIGH");
    expect(result.enrichmentStatus).toBe("PROVIDER_REQUIRED");
    expect(result.enrichment).toBeNull();
    expect(result.providerCalls).toBe(false);
    expect(result.publishEnabled).toBe(false);
    expect(result.productCandidate.title).toBeUndefined();
  });

  it("keeps invalid identifiers honest and cannot create a package", () => {
    const result = classifyProductIntake("12345", "BARCODE");

    expect(result.identifierType).toBe("UNKNOWN");
    expect(result.valid).toBe(false);
    expect(result.canCreateListingPackage).toBe(false);
    expect(result.providerCalls).toBe(false);
  });

  it("treats product-name search as a search query, not fake enrichment", () => {
    const result = classifyProductIntake("vintage denim jacket", "SEARCH");

    expect(result.identifierType).toBe("PRODUCT_NAME");
    expect(result.valid).toBe(true);
    expect(result.enrichmentStatus).toBe("PROVIDER_REQUIRED");
    expect(result.productCandidate.title).toBeUndefined();
  });
});

describe("POST /api/products/intake", () => {
  it("returns a valid intake classification without provider calls", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/products/intake`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "036000291452", source: "BARCODE" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json() as ReturnType<typeof classifyProductIntake>;
      expect(body.identifierType).toBe("UPC_A");
      expect(body.enrichmentStatus).toBe("PROVIDER_REQUIRED");
      expect(body.providerCalls).toBe(false);
      expect(body.publishEnabled).toBe(false);
    });
  });

  it("returns an invalid intake classification without fake product data", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/products/intake`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "12345", source: "BARCODE" }),
      });

      expect(res.status).toBe(422);
      const body = await res.json() as ReturnType<typeof classifyProductIntake>;
      expect(body.valid).toBe(false);
      expect(body.canCreateListingPackage).toBe(false);
      expect(body.productCandidate.title).toBeUndefined();
    });
  });
});
