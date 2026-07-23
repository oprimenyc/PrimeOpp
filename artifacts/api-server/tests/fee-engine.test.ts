import { describe, expect, it } from "vitest";
import { calculateFees, recommendListPrice, type FeeSchedule } from "../src/lib/feeEngine.js";

const SCHEDULE: FeeSchedule = {
  percentageFee: 0.13,
  fixedFee: 0.3,
  paymentProcessingPercent: 0.029,
  paymentProcessingFixed: 0.3,
  source: "SELLER_PROVIDED",
  version: "1",
};

describe("fee engine", () => {
  it("computes gross, platform, payment, net proceeds, profit, and margin with known shipping", () => {
    const result = calculateFees({
      listPrice: 100,
      feeSchedule: SCHEDULE,
      shipping: { mode: "SELLER_ENTERED", amount: 8 },
      costBasis: 40,
    });

    expect(result.grossSellingPrice).toBe(100);
    // 100 * 0.13 + 0.30
    expect(result.platformFees).toBe(13.3);
    // 100 * 0.029 + 0.30
    expect(result.paymentFees).toBe(3.2);
    expect(result.promotionalFees).toBe(0);
    // 100 - 13.3 - 3.2 - 0
    expect(result.netProceedsBeforeShipping).toBe(83.5);
    // 83.5 - 8
    expect(result.netProceeds).toBe(75.5);
    // 75.5 - 40
    expect(result.estimatedProfit).toBe(35.5);
    // 35.5 / 100 * 100
    expect(result.marginPercent).toBe(35.5);
    expect(result.shippingState).toBe("KNOWN");
    expect(result.profitState).toBe("CALCULATED");
    expect(result.providerCalls).toBe(false);
    expect(result.publishEnabled).toBe(false);
  });

  it("never silently assumes shipping — UNKNOWN yields null net/profit and a REQUIRES_SHIPPING state", () => {
    const result = calculateFees({
      listPrice: 100,
      feeSchedule: SCHEDULE,
      shipping: { mode: "UNKNOWN", amount: null },
      costBasis: 40,
    });

    expect(result.shippingState).toBe("UNKNOWN");
    expect(result.shippingCost).toBeNull();
    expect(result.netProceeds).toBeNull();
    expect(result.estimatedProfit).toBeNull();
    expect(result.marginPercent).toBeNull();
    expect(result.profitState).toBe("REQUIRES_SHIPPING");
    // Fees before shipping are still computable and shown.
    expect(result.netProceedsBeforeShipping).toBe(83.5);
  });

  it("flags missing cost basis without inventing a profit", () => {
    const result = calculateFees({
      listPrice: 50,
      feeSchedule: SCHEDULE,
      shipping: { mode: "SELLER_ENTERED", amount: 5 },
      costBasis: null,
    });

    expect(result.netProceeds).not.toBeNull();
    expect(result.estimatedProfit).toBeNull();
    expect(result.profitState).toBe("REQUIRES_COST_BASIS");
  });

  it("reports both gaps when shipping and cost basis are absent", () => {
    const result = calculateFees({
      listPrice: 50,
      feeSchedule: SCHEDULE,
      shipping: { mode: "UNKNOWN", amount: null },
      costBasis: null,
    });
    expect(result.profitState).toBe("REQUIRES_SHIPPING_AND_COST_BASIS");
  });

  it("applies an optional promotional fee", () => {
    const result = calculateFees({
      listPrice: 200,
      feeSchedule: { ...SCHEDULE, promotionalPercent: 0.02 },
      shipping: { mode: "SELLER_ENTERED", amount: 0 },
      costBasis: 0,
    });
    // 200 * 0.02
    expect(result.promotionalFees).toBe(4);
  });
});

describe("listing price strategies", () => {
  const evidence = { soldMedian: 100, activeLow: 90, activeMedian: 110, activeHigh: 140 };

  it("QUICK_SALE prices below supported sold median", () => {
    expect(recommendListPrice("QUICK_SALE", evidence).price).toBe(90);
  });

  it("MARKET centers on supported sold median", () => {
    expect(recommendListPrice("MARKET", evidence).price).toBe(100);
  });

  it("MAX_MARGIN prices above the highest supported anchor", () => {
    expect(recommendListPrice("MAX_MARGIN", evidence).price).toBe(147);
  });

  it("CUSTOM uses the seller-entered price", () => {
    expect(recommendListPrice("CUSTOM", evidence, 123.45).price).toBe(123.45);
  });

  it("returns no recommendation when evidence is insufficient — never fabricates one", () => {
    const result = recommendListPrice("MARKET", { soldMedian: null, activeLow: null, activeMedian: null, activeHigh: null });
    expect(result.price).toBeNull();
    expect(result.basis).toContain("Insufficient");
  });
});
