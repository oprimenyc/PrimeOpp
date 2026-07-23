import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getPricingAdapter,
  PLATFORM_PRICING_ADAPTERS,
  platformPricingStatus,
} from "../src/lib/platformPricing.js";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");

describe("selected-platform price intelligence", () => {
  it("provides adapters for the named platforms", () => {
    const keys = PLATFORM_PRICING_ADAPTERS.map((a) => a.key);
    for (const key of ["ebay", "amazon", "mercari", "poshmark", "facebook-marketplace", "etsy"]) {
      expect(keys).toContain(key);
    }
  });

  it("reports NOT_CONFIGURED with required env names when unconfigured", () => {
    const status = platformPricingStatus(getPricingAdapter("ebay")!);
    expect(status.status).toBe("NOT_CONFIGURED");
    expect(status.requiredEnv).toContain("EBAY_CLIENT_ID");
  });

  it("keeps active and sold price bands separate and empty rather than fabricated", async () => {
    const result = await getPricingAdapter("ebay")!.getPricing({
      productId: 1,
      normalizedIdentifier: "036000291452",
      identifierType: "UPC",
      condition: "USED",
    });

    // active and sold are distinct objects, both empty (no fabricated numbers).
    expect(result.active).not.toBe(result.sold);
    expect(result.active.median).toBeNull();
    expect(result.sold.median).toBeNull();
    expect(result.active.sampleCount).toBeNull();
    expect(result.sold.sampleCount).toBeNull();
    expect(result.condition).toBe("USED");
    expect(["NOT_CONFIGURED", "PROVIDER_REQUIRED"]).toContain(result.sourceStatus);
    expect(result.providerCalls).toBe(false);
    expect(result.publishEnabled).toBe(false);
  });

  it("preserves the requested condition separately per request", async () => {
    const newResult = await getPricingAdapter("amazon")!.getPricing({
      productId: 1,
      normalizedIdentifier: null,
      identifierType: null,
      condition: "NEW",
    });
    expect(newResult.condition).toBe("NEW");
  });

  it("adds an additive platform price table separating active and sold columns", () => {
    const migration = readFileSync(path.join(repoRoot, "lib/db/migrations/0011_retail_intelligence.sql"), "utf8");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS platform_price_observations");
    expect(migration).toContain("active_low NUMERIC");
    expect(migration).toContain("sold_low NUMERIC");
    expect(migration).toContain("active_median NUMERIC");
    expect(migration).toContain("sold_median NUMERIC");
    expect(migration).toContain("'INSUFFICIENT_DATA'");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS platform_fee_schedules");
  });
});
