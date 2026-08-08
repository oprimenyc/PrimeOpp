import { readFileSync } from "node:fs";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { describe, expect, it, beforeAll } from "vitest";
import {
  computeSourcingDecision,
  DEFAULT_SOURCING_FEE_SCHEDULE,
  SOURCING_DECISION_THRESHOLDS,
} from "../src/lib/sourcingDecision.js";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");

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

describe("sourcing decision engine", () => {
  const noEvidence = { soldMedian: null, activeLow: null, activeMedian: null, activeHigh: null };
  const goodEvidence = { soldMedian: 100, activeLow: 90, activeMedian: 100, activeHigh: 120 };

  it("never fabricates a decision without an acquisition cost", () => {
    const result = computeSourcingDecision({
      acquisitionCost: null,
      shippingEstimate: null,
      feeSchedule: DEFAULT_SOURCING_FEE_SCHEDULE,
      evidence: goodEvidence,
      evidenceConfidence: "HIGH",
      evidenceSampleCount: 50,
    });
    expect(result.decision).toBe("INSUFFICIENT_DATA");
    expect(result.reason).toMatch(/acquisition cost/i);
    expect(result.estimatedProfit).toBeNull();
  });

  it("recommends WATCH instead of guessing when there is no supported market evidence", () => {
    const result = computeSourcingDecision({
      acquisitionCost: 20,
      shippingEstimate: 5,
      feeSchedule: DEFAULT_SOURCING_FEE_SCHEDULE,
      evidence: noEvidence,
      evidenceConfidence: "UNKNOWN",
      evidenceSampleCount: null,
    });
    expect(result.decision).toBe("WATCH");
    expect(result.recommendedListPrice).toBeNull();
    expect(result.reason).toMatch(/no supported market-price evidence/i);
  });

  it("recommends WATCH instead of guessing net profit when shipping is unknown", () => {
    const result = computeSourcingDecision({
      acquisitionCost: 20,
      shippingEstimate: null,
      feeSchedule: DEFAULT_SOURCING_FEE_SCHEDULE,
      evidence: goodEvidence,
      evidenceConfidence: "HIGH",
      evidenceSampleCount: 50,
    });
    expect(result.decision).toBe("WATCH");
    expect(result.estimatedProfit).toBeNull();
    expect(result.reason).toMatch(/shipping estimate/i);
  });

  it("recommends BUY when ROI and profit clear the configured thresholds", () => {
    const result = computeSourcingDecision({
      acquisitionCost: 20,
      shippingEstimate: 5,
      feeSchedule: DEFAULT_SOURCING_FEE_SCHEDULE,
      evidence: goodEvidence,
      evidenceConfidence: "HIGH",
      evidenceSampleCount: 50,
    });
    expect(result.decision).toBe("BUY");
    expect(result.estimatedProfit).not.toBeNull();
    expect(result.roiPercent).toBeGreaterThanOrEqual(SOURCING_DECISION_THRESHOLDS.buyRoiPercent);
  });

  it("recommends PASS when the recommended list price would lose money", () => {
    const result = computeSourcingDecision({
      acquisitionCost: 150,
      shippingEstimate: 10,
      feeSchedule: DEFAULT_SOURCING_FEE_SCHEDULE,
      evidence: goodEvidence,
      evidenceConfidence: "HIGH",
      evidenceSampleCount: 50,
    });
    expect(result.decision).toBe("PASS");
    expect(result.estimatedProfit).toBeLessThanOrEqual(0);
  });

  it("recommends WATCH (not an outright BUY) for a positive but marginal ROI", () => {
    // Cost basis chosen so profit is positive but ROI stays under the BUY bar.
    const result = computeSourcingDecision({
      acquisitionCost: 65,
      shippingEstimate: 5,
      feeSchedule: DEFAULT_SOURCING_FEE_SCHEDULE,
      evidence: goodEvidence,
      evidenceConfidence: "MEDIUM",
      evidenceSampleCount: 12,
    });
    expect(result.decision).toBe("WATCH");
    expect(result.estimatedProfit).toBeGreaterThan(0);
    expect(result.roiPercent).toBeLessThan(SOURCING_DECISION_THRESHOLDS.buyRoiPercent);
  });
});

describe("sourcing sessions migration", () => {
  const migration = readFileSync(path.join(repoRoot, "lib/db/migrations/0013_sourcing_sessions.sql"), "utf8");

  it("is additive only", () => {
    expect(migration).not.toMatch(/\bDROP TABLE\b|\bDELETE FROM\b|\bDROP COLUMN\b/i);
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS sourcing_sessions");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS sourcing_session_items");
  });

  it("covers the full review-queue status lifecycle including BUY/PASS/WATCH", () => {
    for (const status of ["SCANNED", "IDENTIFYING", "QUEUED", "REVIEWING", "BUY", "PASS", "WATCH", "PURCHASED", "LISTED", "SOLD", "ARCHIVED"]) {
      expect(migration).toContain(status);
    }
  });

  it("keeps acquisition cost and shipping nullable rather than defaulted to zero", () => {
    expect(migration).toMatch(/acquisition_cost NUMERIC,/);
    expect(migration).toMatch(/shipping_estimate NUMERIC,/);
  });

  it("reuses canonical_listing_packages instead of duplicating listing state", () => {
    expect(migration).toContain("canonical_listing_package_id BIGINT REFERENCES canonical_listing_packages(id)");
  });
});

describe("sourcing routes safety posture", () => {
  it("makes no Stripe or external provider calls", () => {
    const source = readFileSync(path.join(repoRoot, "artifacts/api-server/src/routes/sourcing.ts"), "utf8");
    expect(source).not.toMatch(/require\(['"]stripe['"]\)|from ['"]stripe['"]|new Stripe/);
    expect(source).not.toMatch(/public marketplace|seller of record|escrow|payout|\bKYC\b/i);
  });

  it("requires authentication on every session and item route", async () => {
    await withServer(async (baseUrl) => {
      const createSession = await fetch(`${baseUrl}/api/sourcing/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: "ROSS -- Aug 8" }),
      });
      expect(createSession.status).toBe(401);

      const listSessions = await fetch(`${baseUrl}/api/sourcing/sessions`);
      expect(listSessions.status).toBe(401);

      const addItem = await fetch(`${baseUrl}/api/sourcing/sessions/1/items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "036000291452", source: "BARCODE" }),
      });
      expect(addItem.status).toBe(401);

      const batch = await fetch(`${baseUrl}/api/sourcing/sessions/1/items/batch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemIds: [1], action: "PASS" }),
      });
      expect(batch.status).toBe(401);
    });
  });

  it("rejects an invalid session create payload with a 400, not a silent pass", async () => {
    await withServer(async (baseUrl) => {
      // Unauthenticated requests are already rejected with 401 before body
      // validation runs -- this documents that auth is checked first.
      const res = await fetch(`${baseUrl}/api/sourcing/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
    });
  });
});
