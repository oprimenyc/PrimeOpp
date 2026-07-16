// Opportunity decision engine — Phase 16.

import type {
  Money,
  OpportunityDecision,
  OpportunityInput,
  OpportunityResult,
  OpportunityThresholds,
} from '@primeopp/contracts';
import { clamp01, roundTo } from '@primeopp/contracts';

export const DEFAULT_THRESHOLDS: OpportunityThresholds = {
  strongBuyRoi: 1.0,
  buyRoi: 0.4,
  maybeRoi: 0.15,
  minimumConfidence: 0.6,
  minimumComparableCount: 3,
};

/**
 * Score an opportunity and produce a recommendation.
 * NEVER makes an autonomous purchasing decision — only a recommendation.
 */
export function scoreOpportunity(input: OpportunityInput): OpportunityResult {
  const t = input.tenantThresholds ?? DEFAULT_THRESHOLDS;
  const reasons: string[] = [];
  const risks: string[] = [];
  const missingData: string[] = [];

  // Missing-data checks.
  if (input.comparableCount < t.minimumComparableCount) {
    missingData.push(`only ${input.comparableCount} comparables (need ≥ ${t.minimumComparableCount})`);
  }
  if (input.confidence < t.minimumConfidence) {
    missingData.push(`confidence ${input.confidence.toFixed(2)} below threshold ${t.minimumConfidence}`);
  }
  if (input.conditionRisk === undefined) missingData.push('conditionRisk not provided');
  if (input.authenticityRisk === undefined) missingData.push('authenticityRisk not provided');
  if (input.shippingComplexity === undefined) missingData.push('shippingComplexity not provided');
  if (input.sellThroughProxy === undefined) missingData.push('sellThroughProxy not provided');

  // Risk scoring.
  if (input.conditionRisk !== undefined && input.conditionRisk > 0.5) risks.push(`high condition risk (${input.conditionRisk.toFixed(2)})`);
  if (input.authenticityRisk !== undefined && input.authenticityRisk > 0.3) risks.push(`authenticity risk (${input.authenticityRisk.toFixed(2)}) — consider AUTHENTICATE_FIRST`);
  if (input.shippingComplexity !== undefined && input.shippingComplexity > 0.6) risks.push(`shipping complexity high (${input.shippingComplexity.toFixed(2)})`);
  if (input.returnRisk !== undefined && input.returnRisk > 0.4) risks.push(`return risk elevated (${input.returnRisk.toFixed(2)})`);
  if (input.inventoryAgeRiskDays !== undefined && input.inventoryAgeRiskDays > 90) risks.push(`inventory age risk: ${input.inventoryAgeRiskDays} days`);
  if (input.categoryRisk !== undefined && input.categoryRisk > 0.5) risks.push(`category risk high (${input.categoryRisk.toFixed(2)})`);

  // Decision logic.
  let decision: OpportunityDecision;

  if (missingData.length > 2) {
    decision = 'DATA_INSUFFICIENT';
    reasons.push('insufficient data to make a confident decision');
  } else if (input.authenticityRisk !== undefined && input.authenticityRisk > 0.6) {
    decision = 'AUTHENTICATE_FIRST';
    reasons.push('authenticity risk too high to proceed without authentication');
  } else if (input.conditionRisk !== undefined && input.conditionRisk > 0.7) {
    decision = 'INSPECT_FIRST';
    reasons.push('condition risk too high to proceed without in-person inspection');
  } else if (input.expectedProfit.amount <= 0) {
    decision = 'PASS';
    reasons.push(`expected profit non-positive: ${input.expectedProfit.amount} ${input.expectedProfit.currency}`);
  } else if (missingData.length > 0) {
    decision = 'RESEARCH_MORE';
    reasons.push(`missing data: ${missingData.join('; ')}`);
  } else if (input.roi >= t.strongBuyRoi && input.confidence >= t.minimumConfidence && risks.length === 0) {
    decision = 'STRONG_BUY';
    reasons.push(`ROI ${input.roi.toFixed(2)} ≥ strong-buy threshold ${t.strongBuyRoi}`);
  } else if (input.roi >= t.buyRoi) {
    decision = 'BUY';
    reasons.push(`ROI ${input.roi.toFixed(2)} ≥ buy threshold ${t.buyRoi}`);
  } else if (input.roi >= t.maybeRoi) {
    // If no major risks and seller is likely flexible (low sell-through proxy), suggest NEGOTIATE.
    if (risks.length === 0 && (input.sellThroughProxy === undefined || input.sellThroughProxy < 0.4)) {
      decision = 'NEGOTIATE';
      reasons.push(`ROI ${input.roi.toFixed(2)} in MAYBE zone [${t.maybeRoi}, ${t.buyRoi}); risks low — negotiate toward target`);
    } else {
      decision = 'MAYBE';
      reasons.push(`ROI ${input.roi.toFixed(2)} in MAYBE zone [${t.maybeRoi}, ${t.buyRoi})`);
    }
  } else {
    decision = 'PASS';
    reasons.push(`ROI ${input.roi.toFixed(2)} below maybe threshold ${t.maybeRoi}`);
  }

  // Recommended maximum purchase price: the buy price at which ROI = buyRoi.
  // From: roi = (listingPrice - totalCosts - buyPrice) / (totalCosts + buyPrice)
  // → buyPrice = (listingPrice - totalCosts*(1+roi)) / (1+roi)
  // We have expectedProfit at the current buy price; we need to back out.
  // Simpler: maxBuyPrice = currentBuyPrice + expectedProfit * scaleFactor
  // where scaleFactor scales by how much ROI we want to retain.
  // For clarity, compute from ROI: maxBuyPrice such that ROI = t.buyRoi.
  // ROI = profit / cost; cost = buyPrice + otherCosts
  // At threshold: profit_threshold = cost * t.buyRoi
  // profit_threshold = listingPrice - cost = listingPrice - (buyPrice + otherCosts)
  // → listingPrice - buyPrice - otherCosts = (buyPrice + otherCosts) * t.buyRoi
  // → listingPrice = buyPrice*(1+t.buyRoi) + otherCosts*(1+t.buyRoi)
  // → buyPrice = (listingPrice)/(1+t.buyRoi) - otherCosts
  // We don't have listingPrice or otherCosts directly; we have expectedProfit and roi.
  // cost = profit/roi; listingPrice = profit + cost = profit*(1+roi)/roi
  // otherCosts = cost - buyPrice; but we don't know buyPrice separately.
  // For the result, approximate maxBuyPrice = expectedProfit / t.buyRoi.
  // This is the maximum buy price at which ROI = t.buyRoi (assuming other costs constant).
  const maxBuyPrice: Money = {
    amount: roundTo(input.expectedProfit.amount / Math.max(t.buyRoi, 0.01), 2),
    currency: input.expectedProfit.currency,
    precise: false,
    status: 'ESTIMATED',
  };

  // Suggested negotiation target: halfway between current expected profit and break-even.
  const suggestedNegotiationTarget: Money = {
    amount: roundTo(maxBuyPrice.amount * 0.95, 2),
    currency: input.expectedProfit.currency,
    precise: false,
    status: 'ESTIMATED',
  };

  // Recommended marketplaces based on category and velocity.
  const recommendedMarketplaces = ['primeopp-marketplace'];
  if (input.desiredVelocityDays !== undefined && input.desiredVelocityDays <= 7) {
    recommendedMarketplaces.push('ebay-test-adapter');
  }
  if (input.desiredVelocityDays === undefined || input.desiredVelocityDays > 14) {
    recommendedMarketplaces.push('local-test-adapter');
  }

  // Recommended next step.
  let recommendedNextStep: string;
  switch (decision) {
    case 'STRONG_BUY':
    case 'BUY':
      recommendedNextStep = `proceed with purchase at or below ${maxBuyPrice.amount} ${maxBuyPrice.currency}`;
      break;
    case 'NEGOTIATE':
      recommendedNextStep = `negotiate toward ${suggestedNegotiationTarget.amount} ${suggestedNegotiationTarget.currency}`;
      break;
    case 'MAYBE':
      recommendedNextStep = 'collect more comps or negotiate price';
      break;
    case 'PASS':
      recommendedNextStep = 'do not purchase';
      break;
    case 'RESEARCH_MORE':
      recommendedNextStep = `address missing data: ${missingData.join('; ')}`;
      break;
    case 'AUTHENTICATE_FIRST':
      recommendedNextStep = 'submit to authentication service before purchase';
      break;
    case 'INSPECT_FIRST':
      recommendedNextStep = 'inspect in person before purchase';
      break;
    case 'DATA_INSUFFICIENT':
      recommendedNextStep = 'gather additional data (comps, condition, shipping) before deciding';
      break;
  }

  // Final confidence: clamp input confidence.
  const confidence = clamp01(input.confidence);

  return {
    decision,
    reasons,
    risks,
    missingData,
    maximumRecommendedPurchasePrice: maxBuyPrice,
    ...(decision === 'MAYBE' || decision === 'NEGOTIATE' ? { suggestedNegotiationTarget } : {}),
    recommendedMarketplaces,
    recommendedNextStep,
    confidence,
  };
}

/**
 * Convert a BUY/MAYBE/PASS decision into a human-readable summary.
 */
export function summarizeDecision(result: OpportunityResult): string {
  return `Decision: ${result.decision}. Reasons: ${result.reasons.join('; ')}. Next: ${result.recommendedNextStep}`;
}
