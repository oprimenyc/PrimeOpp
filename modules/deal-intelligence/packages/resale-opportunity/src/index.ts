/**
 * @primeopp-deal-intelligence/resale-opportunity
 *
 * Resale margin and ROI analysis. NEVER autonomously purchases products.
 */
import type {
  Money, ResaleAnalysis, ResaleRecommendation, Evidence, ISO8601
} from '@primeopp-deal-intelligence/contracts';
import { money, add, subtract, multiply, compare, min as moneyMin, max as moneyMax } from '@primeopp-deal-intelligence/contracts';

export interface ResaleInput {
  acquisitionPrice: Money;
  purchaseTaxEstimate?: Money;
  inboundShipping?: Money;
  marketplaceComps: Money[];        // observed comp prices
  marketplaceFeePct?: number;        // e.g. 0.13 for 13% eBay final value fee
  outboundShipping?: Money;
  packaging?: Money;
  returnReservePct?: number;
  quantityLimit?: number;
  sellThroughProxy?: number;         // 0..1
  seasonalRisk?: number;             // 0..1
  inventoryAgeRisk?: number;         // 0..1
  variantRisk?: number;              // 0..1
  authenticityRisk?: number;         // 0..1
  recommendedMarketplaces?: string[];
  evidence?: Evidence[];
  now?: ISO8601;
}

export function analyzeResale(input: ResaleInput): ResaleAnalysis {
  if (input.marketplaceComps.length === 0) {
    return emptyAnalysis(input, 'DATA_INSUFFICIENT', ['marketplaceComps']);
  }
  const sorted = input.marketplaceComps.slice().sort((a, b) => compare(a, b));
  const low = sorted[0]!;
  const high = sorted[sorted.length - 1]!;
  const median = sorted[Math.floor(sorted.length / 2)] ?? low;
  const currency = low.currency;

  // Recommended list price = median comp (conservative).
  const recommendedListPrice = median;
  // Fast-sale price = 10% below median.
  const fastSalePrice = multiply(median, 0.9);

  // Fees
  const feePct = input.marketplaceFeePct ?? 0.13;
  const expectedFees = multiply(recommendedListPrice, feePct);
  const expectedShipping = input.outboundShipping ?? money(0, currency);
  const packaging = input.packaging ?? money(0, currency);

  // Acquisition cost
  const acquisitionCost = add(add(input.acquisitionPrice, input.purchaseTaxEstimate ?? money(0, currency)),
    input.inboundShipping ?? money(0, currency));

  // Return reserve
  const returnReservePct = input.returnReservePct ?? 0.05;
  const returnReserve = multiply(recommendedListPrice, returnReservePct);

  // Total costs
  const totalCosts = add(add(add(acquisitionCost, expectedFees), expectedShipping), add(packaging, returnReserve));

  // Expected profit
  const expectedProfit = subtract(recommendedListPrice, totalCosts);
  const roi = acquisitionCost.amountMinor > 0 ? expectedProfit.amountMinor / acquisitionCost.amountMinor : 0;

  // Maximum buy price = list price - fees - shipping - packaging - reserve (zero profit)
  const breakEven = subtract(recommendedListPrice, add(add(expectedFees, expectedShipping), add(packaging, returnReserve)));
  const maximumBuyPrice = moneyMax(breakEven, money(0, currency));
  const targetBuyPrice = multiply(maximumBuyPrice, 0.7); // target 30% margin

  // Quantity
  const recommendedQuantity = input.quantityLimit !== undefined ? Math.max(1, Math.min(input.quantityLimit, 5)) : 1;

  // Confidence
  let confidence = 0.6;
  if (input.marketplaceComps.length >= 5) confidence += 0.15;
  if (input.sellThroughProxy !== undefined) confidence += 0.1;
  if (input.seasonalRisk !== undefined) confidence += 0.05;
  if (input.authenticityRisk !== undefined && input.authenticityRisk < 0.3) confidence += 0.1;
  confidence = Math.min(confidence, 0.95);

  const missing: string[] = [];
  if (input.marketplaceComps.length < 3) missing.push('marketplaceComps (need 3+)');
  if (input.sellThroughProxy === undefined) missing.push('sellThroughProxy');
  if (input.authenticityRisk === undefined) missing.push('authenticityRisk');

  // Recommendation
  let recommendation: ResaleRecommendation;
  if (missing.length >= 3) recommendation = 'DATA_INSUFFICIENT';
  else if (roi >= 0.5 && confidence >= 0.7) recommendation = 'STRONG_BUY';
  else if (roi >= 0.3 && confidence >= 0.6) recommendation = 'BUY';
  else if (roi >= 0.15) recommendation = 'MAYBE';
  else if (roi >= 0.05) recommendation = 'RESEARCH_MORE';
  else recommendation = 'PASS';

  // Risk adjustments
  const risks = [input.seasonalRisk, input.inventoryAgeRisk, input.variantRisk, input.authenticityRisk]
    .filter((v): v is number => v !== undefined);
  if (risks.length > 0) {
    const avgRisk = risks.reduce((a, b) => a + b, 0) / risks.length;
    if (avgRisk > 0.5 && recommendation === 'STRONG_BUY') recommendation = 'BUY';
    if (avgRisk > 0.7 && recommendation === 'BUY') recommendation = 'MAYBE';
  }

  return {
    estimatedMarketRange: { low, high },
    recommendedListPrice,
    fastSalePrice,
    expectedFees,
    expectedShipping,
    expectedProfit,
    roi,
    maximumBuyPrice,
    targetBuyPrice,
    recommendedQuantity,
    recommendedMarketplaces: input.recommendedMarketplaces ?? ['ebay', 'amazon'],
    confidence,
    missingData: missing,
    recommendation,
    evidence: input.evidence ?? []
  };
}

function emptyAnalysis(input: ResaleInput, recommendation: ResaleRecommendation, missing: string[]): ResaleAnalysis {
  const c = input.acquisitionPrice.currency;
  const zero = money(0, c);
  return {
    estimatedMarketRange: { low: zero, high: zero },
    recommendedListPrice: zero,
    fastSalePrice: zero,
    expectedFees: zero,
    expectedShipping: input.outboundShipping ?? zero,
    expectedProfit: zero,
    roi: 0,
    maximumBuyPrice: zero,
    targetBuyPrice: zero,
    recommendedQuantity: 0,
    recommendedMarketplaces: input.recommendedMarketplaces ?? [],
    confidence: 0,
    missingData: missing,
    recommendation,
    evidence: input.evidence ?? []
  };
}
