// sourcingDecision.ts — turns real, operator-supplied economics into an
// honest BUY / PASS / WATCH recommendation for a review-queue item.
//
// This module calls no provider. It only combines:
//   - the operator's own acquisition cost / shipping estimate,
//   - real fee-schedule math (feeEngine.calculateFees), and
//   - real supported pricing evidence (a PricingEvidence the caller already
//     obtained from platform_price_observations or entered manually).
//
// When acquisition cost, shipping, or supported market evidence is missing,
// this returns WATCH/INSUFFICIENT_DATA with the exact gap named — never a
// fabricated number and never a silent PASS. The operator's manual decision
// (stored on the item) always takes precedence over this recommendation.

import { calculateFees, recommendListPrice, type FeeSchedule, type PricingEvidence } from "./feeEngine.js";

export const SOURCING_DECISIONS = ["BUY", "WATCH", "PASS", "INSUFFICIENT_DATA"] as const;
export type SourcingDecision = (typeof SOURCING_DECISIONS)[number];

// Reseller rule-of-thumb thresholds. Deliberately named constants, not
// buried magic numbers, so the basis for a BUY/WATCH/PASS split is visible
// and adjustable in one place.
export const SOURCING_DECISION_THRESHOLDS = {
  // Minimum ROI (estimatedProfit / acquisitionCost) to recommend BUY outright.
  buyRoiPercent: 30,
  // Minimum absolute profit to recommend BUY even if ROI is borderline.
  buyMinProfit: 5,
};

export type SourcingDecisionInput = {
  acquisitionCost: number | null;
  shippingEstimate: number | null;
  feeSchedule: FeeSchedule;
  evidence: PricingEvidence;
  evidenceConfidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  evidenceSampleCount: number | null;
};

export type SourcingDecisionResult = {
  decision: SourcingDecision;
  reason: string;
  recommendedListPrice: number | null;
  listPriceBasis: string;
  estimatedProfit: number | null;
  roiPercent: number | null;
  fees: ReturnType<typeof calculateFees> | null;
  evidenceConfidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  evidenceSampleCount: number | null;
};

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeSourcingDecision(input: SourcingDecisionInput): SourcingDecisionResult {
  const { price: recommendedListPrice, basis: listPriceBasis } = recommendListPrice("MARKET", input.evidence);

  if (input.acquisitionCost === null) {
    return {
      decision: "INSUFFICIENT_DATA",
      reason: "Enter an acquisition cost to compute economics for this item.",
      recommendedListPrice,
      listPriceBasis,
      estimatedProfit: null,
      roiPercent: null,
      fees: null,
      evidenceConfidence: input.evidenceConfidence,
      evidenceSampleCount: input.evidenceSampleCount,
    };
  }

  if (recommendedListPrice === null) {
    return {
      decision: "WATCH",
      reason: "No supported market-price evidence yet for this item. Configure a pricing source, or enter a comparable price manually to get a BUY/PASS recommendation.",
      recommendedListPrice: null,
      listPriceBasis,
      estimatedProfit: null,
      roiPercent: null,
      fees: null,
      evidenceConfidence: input.evidenceConfidence,
      evidenceSampleCount: input.evidenceSampleCount,
    };
  }

  const fees = calculateFees({
    listPrice: recommendedListPrice,
    feeSchedule: input.feeSchedule,
    shipping: {
      mode: input.shippingEstimate === null ? "UNKNOWN" : "SELLER_ENTERED",
      amount: input.shippingEstimate,
    },
    costBasis: input.acquisitionCost,
  });

  if (fees.profitState === "REQUIRES_SHIPPING") {
    return {
      decision: "WATCH",
      reason: "Add a shipping estimate to compute net profit for this item.",
      recommendedListPrice,
      listPriceBasis,
      estimatedProfit: null,
      roiPercent: null,
      fees,
      evidenceConfidence: input.evidenceConfidence,
      evidenceSampleCount: input.evidenceSampleCount,
    };
  }

  const estimatedProfit = fees.estimatedProfit;
  const roiPercent = estimatedProfit !== null && input.acquisitionCost > 0
    ? round2((estimatedProfit / input.acquisitionCost) * 100)
    : null;

  let decision: SourcingDecision;
  let reason: string;

  if (estimatedProfit === null) {
    decision = "INSUFFICIENT_DATA";
    reason = "Profit could not be calculated from the data entered so far.";
  } else if (estimatedProfit <= 0) {
    decision = "PASS";
    reason = `Estimated profit is $${estimatedProfit.toFixed(2)} at the recommended list price. Passing avoids a loss.`;
  } else if (
    roiPercent !== null &&
    roiPercent >= SOURCING_DECISION_THRESHOLDS.buyRoiPercent &&
    estimatedProfit >= SOURCING_DECISION_THRESHOLDS.buyMinProfit
  ) {
    decision = "BUY";
    reason = `Estimated ${roiPercent.toFixed(1)}% ROI and $${estimatedProfit.toFixed(2)} profit clear the ${SOURCING_DECISION_THRESHOLDS.buyRoiPercent}% ROI / $${SOURCING_DECISION_THRESHOLDS.buyMinProfit} profit bar.`;
  } else {
    decision = "WATCH";
    reason = `Estimated profit is positive ($${estimatedProfit.toFixed(2)}) but ROI is below the ${SOURCING_DECISION_THRESHOLDS.buyRoiPercent}% bar for an outright BUY. Worth a second look.`;
  }

  return {
    decision,
    reason,
    recommendedListPrice,
    listPriceBasis,
    estimatedProfit,
    roiPercent,
    fees,
    evidenceConfidence: input.evidenceConfidence,
    evidenceSampleCount: input.evidenceSampleCount,
  };
}

// Default fee schedule used when the review queue has not been told which
// platform to price against. Marked SELLER_PROVIDED/default so the UI can
// show it is a fallback, not a platform-verified schedule.
export const DEFAULT_SOURCING_FEE_SCHEDULE: FeeSchedule = {
  percentageFee: 0.13,
  fixedFee: 0.3,
  paymentProcessingPercent: 0.029,
  paymentProcessingFixed: 0.3,
  source: "DEFAULT_ESTIMATE",
  version: "1",
};

export const SOURCING_ITEM_STATUSES = [
  "SCANNED",
  "IDENTIFYING",
  "QUEUED",
  "REVIEWING",
  "BUY",
  "PASS",
  "WATCH",
  "PURCHASED",
  "LISTED",
  "SOLD",
  "ARCHIVED",
] as const;
export type SourcingItemStatus = (typeof SOURCING_ITEM_STATUSES)[number];
