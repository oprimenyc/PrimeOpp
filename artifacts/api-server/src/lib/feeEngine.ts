// feeEngine.ts — deterministic fee / shipping / net-proceeds / profit math.
//
// This module contains real, pure calculation. It does not call any provider,
// does not assume shipping silently, and does not fabricate fee schedules — the
// caller supplies the fee schedule and shipping input. When shipping is UNKNOWN
// or cost basis is absent, net proceeds and profit are returned as null with an
// explicit state so the UI can show the gap instead of an invented number.

export const SHIPPING_MODES = [
  "SELLER_ENTERED",
  "SAVED_PROFILE",
  "PLATFORM_CALCULATED",
  "UNKNOWN",
] as const;

export type ShippingMode = (typeof SHIPPING_MODES)[number];

export type FeeSchedule = {
  // Fraction of gross (e.g. 0.1325 for a 13.25% final-value fee).
  percentageFee: number;
  // Flat per-order fee in currency units (e.g. 0.30).
  fixedFee: number;
  // Payment-processing fraction of gross (e.g. 0.029).
  paymentProcessingPercent: number;
  // Flat payment-processing fee in currency units.
  paymentProcessingFixed: number;
  // Optional promotional / ad-rate fraction of gross (e.g. 0.02).
  promotionalPercent?: number;
  source?: string;
  version?: string;
};

export type ShippingInput = {
  mode: ShippingMode;
  // Required when mode is not UNKNOWN. Ignored (treated as null) when UNKNOWN.
  amount: number | null;
};

export type FeeCalculationInput = {
  listPrice: number;
  feeSchedule: FeeSchedule;
  shipping: ShippingInput;
  costBasis: number | null;
  currency?: string;
};

export type ProfitState =
  | "CALCULATED"
  | "REQUIRES_SHIPPING"
  | "REQUIRES_COST_BASIS"
  | "REQUIRES_SHIPPING_AND_COST_BASIS"
  | "INVALID_INPUT";

export type FeeCalculationResult = {
  currency: string;
  grossSellingPrice: number;
  platformFees: number;
  paymentFees: number;
  promotionalFees: number;
  shippingState: "KNOWN" | "UNKNOWN";
  shippingCost: number | null;
  costBasis: number | null;
  // Net proceeds AFTER platform/payment/promo fees but BEFORE shipping. Always
  // computable from the list price and fee schedule.
  netProceedsBeforeShipping: number;
  // Net proceeds after shipping. null when shipping is UNKNOWN.
  netProceeds: number | null;
  estimatedProfit: number | null;
  marginPercent: number | null;
  profitState: ProfitState;
  feeScheduleSource: string;
  feeScheduleVersion: string;
  providerCalls: false;
  publishEnabled: false;
};

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isNonNegativeFinite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function calculateFees(input: FeeCalculationInput): FeeCalculationResult {
  const currency = input.currency ?? "USD";
  const schedule = input.feeSchedule;
  const gross = isNonNegativeFinite(input.listPrice) ? round2(input.listPrice) : 0;

  const invalidInput = !isNonNegativeFinite(input.listPrice);

  const promotionalPercent = isNonNegativeFinite(schedule.promotionalPercent) ? schedule.promotionalPercent : 0;
  const percentageFee = isNonNegativeFinite(schedule.percentageFee) ? schedule.percentageFee : 0;
  const paymentPercent = isNonNegativeFinite(schedule.paymentProcessingPercent) ? schedule.paymentProcessingPercent : 0;
  const fixedFee = isNonNegativeFinite(schedule.fixedFee) ? schedule.fixedFee : 0;
  const paymentFixed = isNonNegativeFinite(schedule.paymentProcessingFixed) ? schedule.paymentProcessingFixed : 0;

  const platformFees = round2(gross * percentageFee + fixedFee);
  const paymentFees = round2(gross * paymentPercent + paymentFixed);
  const promotionalFees = round2(gross * promotionalPercent);

  const netProceedsBeforeShipping = round2(gross - platformFees - paymentFees - promotionalFees);

  const shippingKnown = input.shipping.mode !== "UNKNOWN" && isNonNegativeFinite(input.shipping.amount);
  const shippingCost = shippingKnown ? round2(input.shipping.amount as number) : null;

  const costBasis = isNonNegativeFinite(input.costBasis) ? round2(input.costBasis) : null;

  const netProceeds = shippingCost !== null ? round2(netProceedsBeforeShipping - shippingCost) : null;

  let estimatedProfit: number | null = null;
  let marginPercent: number | null = null;
  let profitState: ProfitState;

  if (invalidInput) {
    profitState = "INVALID_INPUT";
  } else if (shippingCost === null && costBasis === null) {
    profitState = "REQUIRES_SHIPPING_AND_COST_BASIS";
  } else if (shippingCost === null) {
    profitState = "REQUIRES_SHIPPING";
  } else if (costBasis === null) {
    profitState = "REQUIRES_COST_BASIS";
  } else {
    estimatedProfit = round2((netProceeds as number) - costBasis);
    marginPercent = gross > 0 ? round2((estimatedProfit / gross) * 100) : null;
    profitState = "CALCULATED";
  }

  return {
    currency,
    grossSellingPrice: gross,
    platformFees,
    paymentFees,
    promotionalFees,
    shippingState: shippingCost !== null ? "KNOWN" : "UNKNOWN",
    shippingCost,
    costBasis,
    netProceedsBeforeShipping,
    netProceeds,
    estimatedProfit,
    marginPercent,
    profitState,
    feeScheduleSource: schedule.source ?? "SELLER_PROVIDED",
    feeScheduleVersion: schedule.version ?? "1",
    providerCalls: false,
    publishEnabled: false,
  };
}

// Listing-price strategies. These operate on SUPPORTED evidence only (a real
// sold median and/or active range). When evidence is insufficient the caller
// must not fabricate one — recommend() returns null and the UI keeps the field
// editable / manual.
export const PRICING_STRATEGIES = ["QUICK_SALE", "MARKET", "MAX_MARGIN", "CUSTOM"] as const;
export type PricingStrategy = (typeof PRICING_STRATEGIES)[number];

export type PricingEvidence = {
  soldMedian: number | null;
  activeLow: number | null;
  activeMedian: number | null;
  activeHigh: number | null;
};

export function recommendListPrice(
  strategy: PricingStrategy,
  evidence: PricingEvidence,
  customPrice?: number | null,
): { price: number | null; basis: string } {
  if (strategy === "CUSTOM") {
    return {
      price: isNonNegativeFinite(customPrice) ? round2(customPrice) : null,
      basis: "Seller-entered custom price.",
    };
  }

  const sold = isNonNegativeFinite(evidence.soldMedian) ? evidence.soldMedian : null;
  const activeMedian = isNonNegativeFinite(evidence.activeMedian) ? evidence.activeMedian : null;
  const activeLow = isNonNegativeFinite(evidence.activeLow) ? evidence.activeLow : null;
  const activeHigh = isNonNegativeFinite(evidence.activeHigh) ? evidence.activeHigh : null;

  if (sold === null && activeMedian === null) {
    return { price: null, basis: "Insufficient supported evidence for a recommendation. Enter a custom price." };
  }

  if (strategy === "QUICK_SALE") {
    const anchor = sold ?? activeLow ?? activeMedian;
    return anchor === null
      ? { price: null, basis: "Insufficient supported evidence for a quick-sale recommendation." }
      : { price: round2(anchor * 0.9), basis: "10% below supported sold median (or lowest supported active price)." };
  }

  if (strategy === "MAX_MARGIN") {
    const anchor = activeHigh ?? sold ?? activeMedian;
    return anchor === null
      ? { price: null, basis: "Insufficient supported evidence for a max-margin recommendation." }
      : { price: round2(anchor * 1.05), basis: "5% above the highest supported active/sold anchor. Slower expected sale." };
  }

  // MARKET
  const anchor = sold ?? activeMedian;
  return anchor === null
    ? { price: null, basis: "Insufficient supported evidence for a market recommendation." }
    : { price: round2(anchor), basis: "Centered on supported sold median (or active median)." };
}
