import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PRODUCT_IDENTIFIER_TYPES, productIdentifierSchema } from "../src/lib/validation.js";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
const apiSrc = path.join(repoRoot, "artifacts/api-server/src");

function read(rel: string): string {
  return readFileSync(path.join(apiSrc, rel), "utf8");
}

describe("retail-intelligence safety posture", () => {
  it("accepts universal, retailer, and marketplace identifier types", () => {
    expect(PRODUCT_IDENTIFIER_TYPES).toContain("UPC");
    expect(PRODUCT_IDENTIFIER_TYPES).toContain("TARGET_TCIN");
    expect(PRODUCT_IDENTIFIER_TYPES).toContain("AMAZON_ASIN");

    const parsed = productIdentifierSchema.safeParse({
      productId: 1,
      identifier: "A0123456789",
      identifierType: "AMAZON_ASIN",
      namespace: "MARKETPLACE",
      platformId: "amazon",
    });
    expect(parsed.success).toBe(true);
  });

  it("new domain modules make no Stripe calls", () => {
    for (const file of ["lib/retailerAdapters.ts", "lib/platformPricing.ts", "lib/feeEngine.ts", "lib/oauth.ts", "routes/retailers.ts", "routes/pricing.ts", "routes/oauth.ts"]) {
      const source = read(file);
      expect(source).not.toMatch(/require\(['"]stripe['"]\)|from ['"]stripe['"]|new Stripe/);
    }
  });

  it("new routes keep publish disabled and provider calls off in their response shape", () => {
    for (const file of ["routes/retailers.ts", "routes/pricing.ts"]) {
      const source = read(file);
      expect(source).toContain("publishEnabled: false");
      expect(source).toContain("providerCalls: false");
    }
  });

  it("adapters return honest empty/NOT_CONFIGURED shells rather than fabricated data", () => {
    const retailer = read("lib/retailerAdapters.ts");
    const pricing = read("lib/platformPricing.ts");
    // No hardcoded fake price/quantity literals in the shell return paths.
    expect(retailer).toContain("NOT_CONFIGURED");
    expect(retailer).toContain("quantity: null");
    expect(pricing).toContain("NOT_CONFIGURED");
    expect(pricing).toContain("low: null");
  });

  it("does not claim to be a public marketplace, payment processor, or KYC platform", () => {
    for (const file of ["routes/retailers.ts", "routes/pricing.ts", "routes/oauth.ts"]) {
      const source = read(file);
      expect(source).not.toMatch(/public marketplace|seller of record|escrow|payout|\bKYC\b/i);
    }
  });
});
