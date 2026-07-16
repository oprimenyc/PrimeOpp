// Example B — Sneaker Evaluation workflow.
import { createSdk } from '@primeopp/sdk';
import { createPricingObservation } from '@primeopp/pricing';

async function main() {
  console.log('=== Workflow B: Sneaker Evaluation ===');
  const sdk = createSdk({ tenantId: 'demo' });

  // 1. Load sold comps
  const soldComps = [
    createPricingObservation({ productId: 'sneaker-1', condition: 'NEW_WITH_TAGS', price: { amount: 200, currency: 'USD', precise: true, status: 'ACTUAL' }, currency: 'USD', quantity: 1, source: 'MARKETPLACE_SOLD_LISTING', listingStatus: 'SOLD', confidence: 0.95, evidenceRefs: [], scope: { tenantId: 'demo' } }),
    createPricingObservation({ productId: 'sneaker-1', condition: 'NEW_WITH_TAGS', price: { amount: 220, currency: 'USD', precise: true, status: 'ACTUAL' }, currency: 'USD', quantity: 1, source: 'MARKETPLACE_SOLD_LISTING', listingStatus: 'SOLD', confidence: 0.95, evidenceRefs: [], scope: { tenantId: 'demo' } }),
    createPricingObservation({ productId: 'sneaker-1', condition: 'NEW_WITH_TAGS', price: { amount: 240, currency: 'USD', precise: true, status: 'ACTUAL' }, currency: 'USD', quantity: 1, source: 'MARKETPLACE_SOLD_LISTING', listingStatus: 'SOLD', confidence: 0.95, evidenceRefs: [], scope: { tenantId: 'demo' } }),
  ];

  // 2. Calculate pricing
  const priced = sdk.priceProduct({ productId: 'sneaker-1', condition: 'NEW_WITH_TAGS', activeComps: [], soldComps: soldComps, strategy: 'BALANCED', scope: { tenantId: 'demo' } });
  console.log(`Estimated market value: ${priced.estimatedMarketValue.midpoint.amount} USD (range ${priced.estimatedMarketValue.low.amount}-${priced.estimatedMarketValue.high.amount})`);
  console.log(`Recommended list: ${priced.recommendedListPrice.amount} USD`);

  // 3. Calculate profit
  const fees = sdk.assessFees({ marketplaceRef: 'primeopp-marketplace', basis: { amount: priced.recommendedListPrice.amount, currency: 'USD', precise: false, status: 'ESTIMATED' } });
  const profit = sdk.calculateProfit({
    productId: 'sneaker-1',
    listingPrice: { amount: priced.recommendedListPrice.amount, currency: 'USD', precise: false, status: 'ESTIMATED' },
    costBasis: { amount: 150, currency: 'USD', precise: true, status: 'ACTUAL' },
    inboundCost: { amount: 10, currency: 'USD', precise: true, status: 'ACTUAL' },
    feeAssessment: fees,
    taxTreatment: 'EXCLUDED',
    scope: { tenantId: 'demo' },
  });
  console.log(`Net profit: ${profit.netProfit.amount} USD; ROI: ${(profit.roi * 100).toFixed(1)}%`);

  // 4. Score opportunity
  const opp = sdk.scoreOpportunity({
    expectedProfit: profit.netProfit, roi: profit.roi, margin: profit.margin,
    comparableCount: priced.comparableCount, confidence: 0.85,
    conditionRisk: 0.1, authenticityRisk: 0.3, shippingComplexity: 0.3, sellThroughProxy: 0.6,
    scope: { tenantId: 'demo' },
  });
  console.log(`Decision: ${opp.decision} — ${opp.recommendedNextStep}`);
}

main().catch(console.error);
