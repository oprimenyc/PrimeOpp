import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyFreshness,
  getRetailerAdapter,
  RETAILER_ADAPTERS,
  retailerAdapterStatus,
} from "../src/lib/retailerAdapters.js";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");

describe("retailer adapter system", () => {
  it("ships shells for the named retailers with source priority", () => {
    const keys = RETAILER_ADAPTERS.map((a) => a.key);
    for (const key of ["target", "walmart", "best-buy", "home-depot", "lowes"]) {
      expect(keys).toContain(key);
    }
    expect(keys).toContain("licensed-provider");
    expect(keys).toContain("public-monitor");
    expect(keys).toContain("user-browser");
  });

  it("reports NOT_CONFIGURED with required env names when unconfigured", () => {
    const status = retailerAdapterStatus(getRetailerAdapter("target")!);
    expect(status.status).toBe("NOT_CONFIGURED");
    expect(status.configured).toBe(false);
    expect(status.requiredEnv).toContain("TARGET_API_KEY");
    expect(status.priority).toBe(1); // OFFICIAL_API preferred
  });

  it("keeps unofficial adapters disabled by default", () => {
    const monitor = retailerAdapterStatus(getRetailerAdapter("public-monitor")!);
    const browser = retailerAdapterStatus(getRetailerAdapter("user-browser")!);
    expect(monitor.status).toBe("DISABLED_EXPERIMENTAL");
    expect(monitor.enabled).toBe(false);
    expect(browser.status).toBe("DISABLED_EXPERIMENTAL");
    expect(browser.enabled).toBe(false);
  });

  it("never invents a quantity — inventory shell returns null quantity and a status", async () => {
    const observations = await getRetailerAdapter("walmart")!.getInventory({ retailerItemId: "x", externalStoreId: "y" });
    expect(observations).toHaveLength(1);
    expect(observations[0].quantity).toBeNull();
    expect(observations[0].quantityConfidence).toBe("UNKNOWN");
    expect(["NOT_SUPPORTED", "PROVIDER_REQUIRED"]).toContain(observations[0].availabilityStatus);
    expect(observations[0].price).toBeNull();
  });

  it("classifies observation freshness and never hides missing timestamps", () => {
    const now = Date.UTC(2026, 6, 22, 12, 0, 0);
    expect(classifyFreshness(null, now)).toBe("UNKNOWN");
    expect(classifyFreshness(new Date(now - 5 * 60 * 1000).toISOString(), now)).toBe("LIVE");
    expect(classifyFreshness(new Date(now - 60 * 60 * 1000).toISOString(), now)).toBe("RECENT");
    expect(classifyFreshness(new Date(now - 48 * 60 * 60 * 1000).toISOString(), now)).toBe("STALE");
    expect(
      classifyFreshness(new Date(now - 60 * 1000).toISOString(), now, new Date(now - 30 * 1000).toISOString()),
    ).toBe("EXPIRED");
  });

  it("adds additive retailer/store/inventory tables with nullable quantity", () => {
    const migration = readFileSync(path.join(repoRoot, "lib/db/migrations/0011_retail_intelligence.sql"), "utf8");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS retailers");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS retailer_products");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS retailer_stores");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS inventory_observations");
    // quantity must remain nullable (no NOT NULL on the quantity column).
    expect(migration).toMatch(/quantity INTEGER,\n/);
    expect(migration).toContain("quantity_confidence TEXT NOT NULL DEFAULT 'UNKNOWN'");
    expect(migration).toContain("'LIMITED_AVAILABILITY'");
    // Additive only — no destructive statements.
    expect(migration).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it("extends the product identifier graph additively with retailer/marketplace types", () => {
    const migration = readFileSync(path.join(repoRoot, "lib/db/migrations/0011_retail_intelligence.sql"), "utf8");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS namespace");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS raw_identifier");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS retailer_id");
    expect(migration).toContain("TARGET_TCIN");
    expect(migration).toContain("AMAZON_ASIN");
    expect(migration).toContain("EBAY_EPID");
  });
});
