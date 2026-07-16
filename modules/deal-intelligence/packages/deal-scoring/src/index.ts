/**
 * @primeopp-deal-intelligence/deal-scoring
 *
 * Multi-factor scoring. Every score is explainable: factors, weights,
 * raw values and rationales are preserved.
 */
import type {
  RetailOffer, ProductCandidate, DealScoreSet, Score, ScoreFactor, ScoreBand,
  Money, ISO8601, Confidence
} from '@primeopp-deal-intelligence/contracts';
import { nowIso, money, compare } from '@primeopp-deal-intelligence/contracts';
import { effectivePrice } from '@primeopp-deal-intelligence/offer-normalization';
import { isHistoricalLow } from '@primeopp-deal-intelligence/historical-pricing';
import type { PriceHistoryStats } from '@primeopp-deal-intelligence/contracts';

export interface ScoringContext {
  offer: RetailOffer;
  product?: ProductCandidate;
  history?: PriceHistoryStats;
  msrpReference?: Money;
  resaleAnalysis?: { roi: number; confidence: number };
  rarityScore?: number;       // 0..100
  affiliateEligible?: boolean;
  /** Configurable weights; defaults provided. */
  weights?: Partial<ScoringWeights>;
  now?: ISO8601;
}

export interface ScoringWeights {
  effectiveDiscount: number;
  historicalDiscount: number;
  absoluteSavings: number;
  resaleMargin: number;
  scarcity: number;
  availabilityConfidence: number;
  sourceConfidence: number;
  couponComplexity: number;
  membershipBurden: number;
  shippingBurden: number;
  expirationUrgency: number;
  affiliateValue: number;
  contentPotential: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  effectiveDiscount: 0.20,
  historicalDiscount: 0.15,
  absoluteSavings: 0.10,
  resaleMargin: 0.10,
  scarcity: 0.10,
  availabilityConfidence: 0.10,
  sourceConfidence: 0.05,
  couponComplexity: 0.05,
  membershipBurden: 0.03,
  shippingBurden: 0.03,
  expirationUrgency: 0.04,
  affiliateValue: 0.03,
  contentPotential: 0.02
};

export function bandForScore(value: number, missing: string[]): ScoreBand {
  if (missing.length >= 5) return 'INSUFFICIENT_DATA';
  if (value >= 90) return 'EXCEPTIONAL';
  if (value >= 75) return 'STRONG';
  if (value >= 60) return 'GOOD';
  if (value >= 45) return 'CONDITIONAL';
  if (value >= 30) return 'WATCH';
  if (value >= 15) return 'WEAK';
  return 'REJECT';
}

function factor(key: string, weight: number, raw: number, rationale: string): ScoreFactor {
  return { key, weight, raw, weighted: raw * weight, rationale };
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function scoreFromFactors(factors: ScoreFactor[], missing: string[], now: ISO8601, confidence: Confidence): Score {
  const total = factors.reduce((acc, f) => acc + f.weighted, 0);
  const value = Math.round(total * 100);
  return { value, band: bandForScore(value, missing), factors, confidence, missingData: missing, computedAt: now };
}

export function scoreDeal(ctx: ScoringContext): DealScoreSet {
  const now = ctx.now ?? nowIso();
  const w: ScoringWeights = { ...DEFAULT_WEIGHTS, ...(ctx.weights ?? {}) };
  const missing: string[] = [];
  const offer = ctx.offer;
  const price = effectivePrice(offer);
  if (!price) missing.push('effectivePrice');
  if (!ctx.history) missing.push('priceHistory');
  if (!ctx.msrpReference) missing.push('msrpReference');

  // Effective discount
  let effDiscPct = 0;
  if (price && offer.prices.base) {
    effDiscPct = (offer.prices.base.amountMinor - price.amountMinor) / offer.prices.base.amountMinor;
  }
  const effDiscFactor = factor('effectiveDiscount', w.effectiveDiscount, clamp01(effDiscPct),
    `effective discount ${(effDiscPct*100).toFixed(1)}%`);

  // Historical discount
  let histDiscRaw = 0;
  if (price && ctx.history?.lowestObserved) {
    if (isHistoricalLow(price, ctx.history)) histDiscRaw = 1;
    else {
      const ratio = ctx.history.lowestObserved.amountMinor > 0
        ? price.amountMinor / ctx.history.lowestObserved.amountMinor : 1;
      histDiscRaw = clamp01(1 - ratio);
    }
  }
  const histFactor = factor('historicalDiscount', w.historicalDiscount, histDiscRaw,
    ctx.history ? `price vs historical low ${ctx.history.lowestObserved?.amountMinor ?? 'n/a'}` : 'no history');

  // Absolute savings
  let absSaveRaw = 0;
  if (price && offer.prices.base) {
    const save = offer.prices.base.amountMinor - price.amountMinor;
    absSaveRaw = clamp01(save / 10000); // $100 = full score
  }
  const absFactor = factor('absoluteSavings', w.absoluteSavings, absSaveRaw,
    `absolute savings ${offer.prices.base && price ? ((offer.prices.base.amountMinor - price.amountMinor)/100).toFixed(2) : 'n/a'}`);

  // Resale margin
  const resaleRaw = ctx.resaleAnalysis ? clamp01(ctx.resaleAnalysis.roi / 1) : 0;
  const resaleFactor = factor('resaleMargin', w.resaleMargin, resaleRaw,
    ctx.resaleAnalysis ? `ROI ${(ctx.resaleAnalysis.roi*100).toFixed(0)}%` : 'no resale analysis');

  // Scarcity
  const scarcityRaw = ctx.rarityScore !== undefined ? clamp01(ctx.rarityScore / 100) : 0;
  const scarcityFactor = factor('scarcity', w.scarcity, scarcityRaw,
    ctx.rarityScore !== undefined ? `rarity score ${ctx.rarityScore}` : 'no rarity');

  // Availability confidence
  const availFactor = factor('availabilityConfidence', w.availabilityConfidence,
    clamp01(offer.availability.confidence), `availability state ${offer.availability.state}`);

  // Source confidence
  const sourceConf = offer.source.precedence === 1 ? 0.95 :
    offer.source.precedence === 2 ? 0.85 :
    offer.source.precedence === 3 ? 0.7 :
    offer.source.precedence === 4 ? 0.6 : 0.4;
  const sourceFactor = factor('sourceConfidence', w.sourceConfidence, sourceConf,
    `source precedence ${offer.source.precedence}`);

  // Coupon complexity (fewer = better)
  const couponCount = offer.coupons.length;
  const couponRaw = couponCount === 0 ? 1 : clamp01(1 - couponCount / 5);
  const couponFactor = factor('couponComplexity', w.couponComplexity, couponRaw,
    `${couponCount} coupon(s) applied`);

  // Membership burden
  const memberRaw = offer.restrictions.membershipRequired ? 0.4 : 1;
  const memberFactor = factor('membershipBurden', w.membershipBurden, memberRaw,
    offer.restrictions.membershipRequired ? 'membership required' : 'no membership required');

  // Shipping burden
  let shipRaw = 1;
  if (offer.fulfillment.shippingCost) shipRaw = clamp01(1 - offer.fulfillment.shippingCost.amountMinor / 5000);
  const shipFactor = factor('shippingBurden', w.shippingBurden, shipRaw,
    offer.fulfillment.shippingCost ? `shipping ${(offer.fulfillment.shippingCost.amountMinor/100).toFixed(2)}` : 'no shipping cost');

  // Expiration urgency
  let expRaw = 0.5;
  if (offer.expiration.expiresAt) {
    const ms = Date.parse(offer.expiration.expiresAt) - Date.parse(now);
    expRaw = clamp01(1 - ms / (7 * 24 * 3600 * 1000)); // 0..1 over 7 days
  }
  const expFactor = factor('expirationUrgency', w.expirationUrgency, expRaw,
    offer.expiration.expiresAt ? `expires ${offer.expiration.expiresAt}` : 'no expiration');

  // Affiliate value
  const affRaw = ctx.affiliateEligible ? 1 : 0;
  const affFactor = factor('affiliateValue', w.affiliateValue, affRaw,
    ctx.affiliateEligible ? 'affiliate eligible' : 'not affiliate eligible');

  // Content potential (simple heuristic: discount + scarcity + brand recognition)
  const contentRaw = clamp01((effDiscPct + scarcityRaw) / 2);
  const contentFactor = factor('contentPotential', w.contentPotential, contentRaw,
    `discount+scarcity blend`);

  const allFactors = [effDiscFactor, histFactor, absFactor, resaleFactor, scarcityFactor,
    availFactor, sourceFactor, couponFactor, memberFactor, shipFactor, expFactor, affFactor, contentFactor];

  // Build sub-scores for each score in the DealScoreSet
  const pickFactors = (keys: string[]): ScoreFactor[] => allFactors.filter(f => keys.includes(f.key));
  const subScore = (keys: string[], weightMap: Record<string, number>, conf: number): Score => {
    const fs = pickFactors(keys).map(f => ({ ...f, weight: weightMap[f.key] ?? f.weight, weighted: f.raw * (weightMap[f.key] ?? f.weight) }));
    return scoreFromFactors(fs, missing, now, conf);
  };

  const consumerValue = subScore(['effectiveDiscount','historicalDiscount','absoluteSavings','couponComplexity','membershipBurden','shippingBurden'],
    { effectiveDiscount: 0.3, historicalDiscount: 0.25, absoluteSavings: 0.2, couponComplexity: 0.1, membershipBurden: 0.1, shippingBurden: 0.05 }, 0.8);
  const resellerOpportunity = subScore(['resaleMargin','scarcity','availabilityConfidence','sourceConfidence'],
    { resaleMargin: 0.5, scarcity: 0.2, availabilityConfidence: 0.2, sourceConfidence: 0.1 }, ctx.resaleAnalysis?.confidence ?? 0.3);
  const affiliateOpportunity = subScore(['affiliateValue','effectiveDiscount','contentPotential'],
    { affiliateValue: 0.5, effectiveDiscount: 0.3, contentPotential: 0.2 }, 0.7);
  const scarcity = subScore(['scarcity','availabilityConfidence','sourceConfidence'],
    { scarcity: 0.6, availabilityConfidence: 0.25, sourceConfidence: 0.15 }, 0.6);
  const confidence = subScore(['sourceConfidence','availabilityConfidence'],
    { sourceConfidence: 0.6, availabilityConfidence: 0.4 }, offer.confidence.overall);
  const urgency = subScore(['expirationUrgency','scarcity','availabilityConfidence'],
    { expirationUrgency: 0.5, scarcity: 0.3, availabilityConfidence: 0.2 }, 0.7);
  const contentPotential = subScore(['contentPotential','effectiveDiscount','scarcity'],
    { contentPotential: 0.5, effectiveDiscount: 0.3, scarcity: 0.2 }, 0.6);
  const overall = scoreFromFactors(allFactors, missing, now, offer.confidence.overall);

  return {
    consumerValue, resellerOpportunity, affiliateOpportunity, scarcity,
    confidence, urgency, contentPotential, overall
  };
}
