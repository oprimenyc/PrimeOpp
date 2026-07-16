// Pricing observations + pricing engine — Phases 11 & 12.

import type {
  CanonicalCondition,
  Confidence,
  Identified,
  Money,
  MoneyRange,
  PricingInput,
  PricingIntermediate,
  PricingResult,
  PricingObservation,
  PricingObservationGroup,
  PricingStrategy,
  TenantScoped,
  Timestamped,
} from '@primeopp/contracts';
import { clamp01, nowUtc, roundTo, uuid } from '@primeopp/contracts';

// ---------------------------------------------------------------------------
// Observation grouping & validation
// ---------------------------------------------------------------------------

/**
 * Group pricing observations by (variant, condition, listing-status).
 * Reject mixed bundles / mixed variants / mixed conditions with explicit warnings.
 */
export function groupObservations(
  observations: PricingObservation[],
  opts: { productId: string; variantId?: string; condition: CanonicalCondition; scope: TenantScoped },
): PricingObservationGroup {
  const active: PricingObservation[] = [];
  const sold: PricingObservation[] = [];
  const warnings: string[] = [];

  for (const o of observations) {
    if (o.tenantId !== opts.scope.tenantId) {
      warnings.push(`observation ${o.id} from tenant ${o.tenantId} rejected (cross-tenant)`);
      continue;
    }
    if (o.productId !== opts.productId) {
      warnings.push(`observation ${o.id} for product ${o.productId} rejected (mismatch with ${opts.productId})`);
      continue;
    }
    if (opts.variantId !== undefined && o.variantId !== undefined && o.variantId !== opts.variantId) {
      warnings.push(`observation ${o.id} for variant ${o.variantId} rejected (variant mismatch with ${opts.variantId})`);
      continue;
    }
    if (o.condition !== opts.condition) {
      warnings.push(`observation ${o.id} condition ${o.condition} rejected (mismatch with ${opts.condition})`);
      continue;
    }
    if (o.listingStatus === 'ACTIVE') active.push(o);
    else if (o.listingStatus === 'SOLD') sold.push(o);
    else warnings.push(`observation ${o.id} with status ${o.listingStatus} ignored`);
  }

  // Sort by observedAt desc.
  active.sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime());
  sold.sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime());

  return {
    productId: opts.productId,
    variantId: opts.variantId,
    condition: opts.condition,
    active,
    sold,
    normalized: warnings.length === 0,
    warnings,
  };
}

/**
 * Create a pricing observation record.
 */
export function createPricingObservation(opts: {
  productId: string;
  variantId?: string;
  condition: CanonicalCondition;
  price: Money;
  shipping?: Money;
  feesIfKnown?: Money;
  currency: string;
  quantity: number;
  location?: string;
  source: PricingObservation['source'];
  sourceRef?: string;
  listingStatus: 'ACTIVE' | 'SOLD' | 'ENDED' | 'UNKNOWN';
  listedAt?: string;
  soldAt?: string;
  sellerType?: string;
  confidence: number;
  evidenceRefs: string[];
  authenticityStatus?: 'AUTHENTIC' | 'SUSPECT' | 'COUNTERFEIT' | 'UNVERIFIED';
  scope: TenantScoped;
}): PricingObservation & Identified & Timestamped {
  const observedAt = nowUtc();
  return {
    id: uuid(),
    tenantId: opts.scope.tenantId,
    ...(opts.scope.organizationId ? { organizationId: opts.scope.organizationId } : {}),
    productId: opts.productId,
    ...(opts.variantId ? { variantId: opts.variantId } : {}),
    condition: opts.condition,
    price: opts.price,
    ...(opts.shipping ? { shipping: opts.shipping } : {}),
    ...(opts.feesIfKnown ? { feesIfKnown: opts.feesIfKnown } : {}),
    currency: opts.currency,
    quantity: opts.quantity,
    ...(opts.location ? { location: opts.location } : {}),
    source: opts.source,
    ...(opts.sourceRef ? { sourceRef: opts.sourceRef } : {}),
    listingStatus: opts.listingStatus,
    ...(opts.listedAt ? { listedAt: opts.listedAt } : {}),
    ...(opts.soldAt ? { soldAt: opts.soldAt } : {}),
    observedAt,
    ...(opts.sellerType ? { sellerType: opts.sellerType } : {}),
    confidence: opts.confidence,
    evidenceRefs: opts.evidenceRefs,
    freshnessSeconds: 0, // freshly observed
    ...(opts.authenticityStatus ? { authenticityStatus: opts.authenticityStatus } : {}),
    createdAt: observedAt,
    updatedAt: observedAt,
  };
}

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Compute freshness-weighted effective weight for a list of observations.
 * Weight decays exponentially with age (half-life of 30 days).
 */
export function freshnessWeight(observedAt: string, at: Date = new Date()): number {
  const ageSec = Math.max(0, (at.getTime() - new Date(observedAt).getTime()) / 1000);
  const halfLifeSec = 30 * 24 * 60 * 60;
  return Math.pow(0.5, ageSec / halfLifeSec);
}

/**
 * Reject comparisons that mix incompatible observations.
 * Returns true if observations are safe to combine.
 */
export function observationsAreComparable(obs: PricingObservation[]): { safe: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (obs.length === 0) return { safe: true, reasons };

  const variants = new Set(obs.map((o) => o.variantId ?? '_'));
  if (variants.size > 1) reasons.push('multiple variants present');

  const conditions = new Set(obs.map((o) => o.condition));
  if (conditions.size > 1) reasons.push('multiple conditions present');

  const statuses = new Set(obs.map((o) => o.listingStatus));
  if (statuses.has('ACTIVE') && statuses.has('SOLD')) reasons.push('mixed active and sold listings');

  const currencies = new Set(obs.map((o) => o.currency));
  if (currencies.size > 1) reasons.push('multiple currencies present');

  const quantities = new Set(obs.map((o) => o.quantity));
  if (quantities.size > 1) {
    const hasBundle = Array.from(quantities).some((q) => q > 1);
    const hasSingle = Array.from(quantities).some((q) => q === 1);
    if (hasBundle && hasSingle) reasons.push('mixed bundle and single-unit listings');
  }

  return { safe: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------------
// Pricing engine
// ---------------------------------------------------------------------------

/**
 * Compute the intermediate stats used by all pricing strategies.
 */
export function computeIntermediate(input: PricingInput): PricingIntermediate {
  const activePrices = input.activeComps.map((o) => o.price.amount);
  const soldPrices = input.soldComps.map((o) => o.price.amount);

  let effectiveWeight = 0;
  for (const o of [...input.activeComps, ...input.soldComps]) {
    effectiveWeight += freshnessWeight(o.observedAt) * o.confidence;
  }

  return {
    activeMedian: median(activePrices),
    activeMean: mean(activePrices),
    activeLow: activePrices.length > 0 ? Math.min(...activePrices) : 0,
    activeHigh: activePrices.length > 0 ? Math.max(...activePrices) : 0,
    soldMedian: median(soldPrices),
    soldMean: mean(soldPrices),
    soldLow: soldPrices.length > 0 ? Math.min(...soldPrices) : 0,
    soldHigh: soldPrices.length > 0 ? Math.max(...soldPrices) : 0,
    activeCount: activePrices.length,
    soldCount: soldPrices.length,
    effectiveWeight,
  };
}

/**
 * Compute confidence range from intermediate.
 */
export function confidenceRange(intermediate: PricingIntermediate): { low: number; high: number } {
  const totalComps = intermediate.activeCount + intermediate.soldCount;
  if (totalComps === 0) return { low: 0, high: 0.2 };
  if (totalComps < 3) return { low: 0.2, high: 0.5 };
  if (intermediate.soldCount === 0) return { low: 0.3, high: 0.6 }; // active-only is weaker
  // Weight by effective weight of observations.
  const w = clamp01(intermediate.effectiveWeight / Math.max(1, totalComps));
  return { low: roundTo(0.4 + 0.4 * w, 2), high: roundTo(0.7 + 0.3 * w, 2) };
}

/**
 * Main pricing engine entrypoint.
 */
export function priceProduct(input: PricingInput): PricingResult {
  const warnings: string[] = [];
  const explanations: PricingExplanation[] = [];

  // Validate observations are comparable.
  const compCheck = observationsAreComparable([...input.activeComps, ...input.soldComps]);
  if (!compCheck.safe) {
    warnings.push(...compCheck.reasons);
    explanations.push({
      step: 'validate',
      detail: `observations not comparable: ${compCheck.reasons.join(', ')}`,
    });
  }

  const intermediate = computeIntermediate(input);
  explanations.push({
    step: 'computeIntermediate',
    detail: `activeCount=${intermediate.activeCount}, soldCount=${intermediate.soldCount}, activeMedian=${intermediate.activeMedian}, soldMedian=${intermediate.soldMedian}`,
  });

  if (intermediate.activeCount + intermediate.soldCount === 0) {
    warnings.push('no comparable observations; confidence very low');
  }

  // Estimated market value: prefer soldMedian when ≥3 sold comps, else blend.
  let estMid: number;
  let estLow: number;
  let estHigh: number;
  if (intermediate.soldCount >= 3) {
    estMid = intermediate.soldMedian;
    estLow = Math.min(intermediate.soldLow, intermediate.soldMedian);
    estHigh = Math.max(intermediate.soldHigh, intermediate.soldMedian);
    explanations.push({ step: 'estimateMarketValue', detail: `based on ${intermediate.soldCount} sold comps; median=${estMid}` });
  } else if (intermediate.soldCount > 0 && intermediate.activeCount > 0) {
    estMid = (intermediate.soldMedian + intermediate.activeMedian) / 2;
    estLow = Math.min(intermediate.soldLow, intermediate.activeLow);
    estHigh = Math.max(intermediate.soldHigh, intermediate.activeHigh);
    explanations.push({ step: 'estimateMarketValue', detail: `blended active+sold; mid=${estMid}` });
  } else if (intermediate.activeCount > 0) {
    estMid = intermediate.activeMedian;
    estLow = intermediate.activeLow;
    estHigh = intermediate.activeHigh;
    explanations.push({ step: 'estimateMarketValue', detail: `active-only; mid=${estMid}; sold comps missing` });
    warnings.push('pricing based on active listings only — sell-through uncertainty');
  } else {
    estMid = 0;
    estLow = 0;
    estHigh = 0;
  }

  const currency = input.activeComps[0]?.currency ?? input.soldComps[0]?.currency ?? 'USD';

  const estimatedMarketValue: MoneyRange = {
    low: { amount: estLow, currency, precise: false, status: 'ESTIMATED' },
    high: { amount: estHigh, currency, precise: false, status: 'ESTIMATED' },
    midpoint: { amount: estMid, currency, precise: false, status: 'ESTIMATED' },
    status: 'ESTIMATED',
  };

  // Strategy-driven prices.
  const { fastSalePrice, balancedPrice, maximumMarginPrice, minimumAcceptablePrice, recommendedListPrice, recommendedOfferFloor } = applyStrategy(input, intermediate, estMid, currency, warnings, explanations);

  // Source coverage: fraction of expected sources present.
  const sourceKinds = new Set([...input.activeComps, ...input.soldComps].map((o) => o.source));
  const sourceCoverage = clamp01(sourceKinds.size / 4);

  // Data freshness: oldest observation in seconds.
  const allObs = [...input.activeComps, ...input.soldComps];
  const dataFreshnessSeconds = allObs.length > 0
    ? Math.min(...allObs.map((o) => (new Date().getTime() - new Date(o.observedAt).getTime()) / 1000))
    : 0;

  return {
    estimatedMarketValue,
    fastSalePrice,
    balancedPrice,
    maximumMarginPrice,
    minimumAcceptablePrice,
    recommendedListPrice,
    recommendedOfferFloor,
    confidenceRange: confidenceRange(intermediate),
    dataFreshnessSeconds,
    sourceCoverage,
    comparableCount: intermediate.activeCount + intermediate.soldCount,
    explanation: explanations,
    warnings,
  };
}

interface PricingExplanation {
  step: string;
  detail: string;
  evidenceRef?: string;
}

function applyStrategy(
  input: PricingInput,
  intermediate: PricingIntermediate,
  estMid: number,
  currency: string,
  warnings: string[],
  explanations: PricingExplanation[],
): {
  fastSalePrice: Money;
  balancedPrice: Money;
  maximumMarginPrice: Money;
  minimumAcceptablePrice: Money;
  recommendedListPrice: Money;
  recommendedOfferFloor: Money;
} {
  const est = (amount: number, status: 'ESTIMATED' | 'USER_ENTERED' = 'ESTIMATED'): Money => ({
    amount: roundTo(amount, 2),
    currency,
    precise: false,
    status,
  });

  // Default multipliers per strategy.
  const multipliers: Record<PricingStrategy, { fast: number; balanced: number; maxMargin: number; min: number; list: number; floor: number }> = {
    QUICK_FLIP: { fast: 0.85, balanced: 0.95, maxMargin: 1.05, min: 0.75, list: 0.95, floor: 0.80 },
    BALANCED: { fast: 0.90, balanced: 1.00, maxMargin: 1.10, min: 0.80, list: 1.00, floor: 0.85 },
    MAX_MARGIN: { fast: 0.95, balanced: 1.05, maxMargin: 1.20, min: 0.85, list: 1.10, floor: 0.90 },
    MARKET_MATCH: { fast: 1.00, balanced: 1.00, maxMargin: 1.00, min: 1.00, list: 1.00, floor: 1.00 },
    CLEARANCE: { fast: 0.70, balanced: 0.80, maxMargin: 0.85, min: 0.50, list: 0.80, floor: 0.50 },
    AGED_INVENTORY: { fast: 0.75, balanced: 0.85, maxMargin: 0.95, min: 0.60, list: 0.85, floor: 0.65 },
    ENTERPRISE_POLICY: { fast: 0.92, balanced: 1.00, maxMargin: 1.08, min: 0.85, list: 1.00, floor: 0.88 },
    CUSTOM: { fast: 0.90, balanced: 1.00, maxMargin: 1.10, min: 0.80, list: 1.00, floor: 0.85 },
  };

  const m = multipliers[input.strategy];
  let fastSalePrice = est(estMid * m.fast);
  let balancedPrice = est(estMid * m.balanced);
  let maximumMarginPrice = est(estMid * m.maxMargin);
  let minimumAcceptablePrice = est(estMid * m.min);
  let recommendedListPrice = est(estMid * m.list);
  let recommendedOfferFloor = est(estMid * m.floor);

  // Override with custom listing price if provided.
  if (input.customListingPrice) {
    recommendedListPrice = { ...input.customListingPrice, status: 'USER_ENTERED' };
    explanations.push({ step: 'applyCustomListingPrice', detail: `list price overridden by user: ${input.customListingPrice.amount}` });
  }
  if (input.minimumPrice) {
    minimumAcceptablePrice = { ...input.minimumPrice, status: 'USER_ENTERED' };
    if (minimumAcceptablePrice.amount > recommendedListPrice.amount) {
      warnings.push('minimum price exceeds recommended list price — selling at a loss is possible');
    }
  }

  // Apply seasonality / local demand.
  if (input.seasonalityFactor !== undefined && input.seasonalityFactor !== 1.0) {
    fastSalePrice = est(fastSalePrice.amount * input.seasonalityFactor);
    balancedPrice = est(balancedPrice.amount * input.seasonalityFactor);
    maximumMarginPrice = est(maximumMarginPrice.amount * input.seasonalityFactor);
    recommendedListPrice = est(recommendedListPrice.amount * input.seasonalityFactor);
    explanations.push({ step: 'applySeasonality', detail: `seasonality factor ${input.seasonalityFactor} applied` });
  }
  if (input.localDemandFactor !== undefined && input.localDemandFactor !== 1.0) {
    fastSalePrice = est(fastSalePrice.amount * input.localDemandFactor);
    balancedPrice = est(balancedPrice.amount * input.localDemandFactor);
    recommendedListPrice = est(recommendedListPrice.amount * input.localDemandFactor);
    explanations.push({ step: 'applyLocalDemand', detail: `local demand factor ${input.localDemandFactor} applied` });
  }

  // Apply seller rules.
  if (input.sellerRules) {
    for (const rule of input.sellerRules) {
      try {
        rule.apply(input, intermediate);
        explanations.push({ step: `sellerRule:${rule.code}`, detail: rule.description });
      } catch (e) {
        warnings.push(`seller rule ${rule.code} failed: ${(e as Error).message}`);
      }
    }
  }

  return { fastSalePrice, balancedPrice, maximumMarginPrice, minimumAcceptablePrice, recommendedListPrice, recommendedOfferFloor };
}
