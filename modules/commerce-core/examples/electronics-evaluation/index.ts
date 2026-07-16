// Example C — Electronics Evaluation workflow.
import { createSdk } from '@primeopp/sdk';
import { createPricingObservation } from '@primeopp/pricing';
import { buildPackageSpec } from '@primeopp/shipping-estimator';

async function main() {
  console.log('=== Workflow C: Electronics Evaluation ===');
  const sdk = createSdk({ tenantId: 'demo' });

  // Build a variant (iPhone 13, 128GB, Blue)
  const variant = sdk.buildVariant('iphone-13', [
    { axis: 'STORAGE', value: '128GB', source: 'spec', confidence: 0.99 },
    { axis: 'COLOR', value: 'Blue', source: 'spec', confidence: 0.99 },
  ]);
  console.log(`Variant hash: ${variant.attributeHash}`);

  // Condition assessment
  const cond = sdk.assessCondition({
    category: 'ELECTRONICS',
    observedDefects: ['light_scratch'],
    missingAccessories: ['earpods'],
    functionalStatus: 'WORKING',
    cosmeticStatus: 'LIGHT_SCRATCHES',
    packagingCondition: 'ORIGINAL',
    photoRefs: ['img1'],
    evidenceRefs: [],
    scope: { tenantId: 'demo' },
  });
  console.log(`Condition: ${cond.assessment.condition} (confidence ${cond.confidence.toFixed(2)})`);

  // Pricing
  const sold = [
    createPricingObservation({ productId: 'iphone-13', variantId: variant.id, condition: cond.assessment.condition, price: { amount: 450, currency: 'USD', precise: true, status: 'ACTUAL' }, currency: 'USD', quantity: 1, source: 'MARKETPLACE_SOLD_LISTING', listingStatus: 'SOLD', confidence: 0.95, evidenceRefs: [], scope: { tenantId: 'demo' } }),
    createPricingObservation({ productId: 'iphone-13', variantId: variant.id, condition: cond.assessment.condition, price: { amount: 470, currency: 'USD', precise: true, status: 'ACTUAL' }, currency: 'USD', quantity: 1, source: 'MARKETPLACE_SOLD_LISTING', listingStatus: 'SOLD', confidence: 0.95, evidenceRefs: [], scope: { tenantId: 'demo' } }),
    createPricingObservation({ productId: 'iphone-13', variantId: variant.id, condition: cond.assessment.condition, price: { amount: 460, currency: 'USD', precise: true, status: 'ACTUAL' }, currency: 'USD', quantity: 1, source: 'MARKETPLACE_SOLD_LISTING', listingStatus: 'SOLD', confidence: 0.95, evidenceRefs: [], scope: { tenantId: 'demo' } }),
  ];
  const priced = sdk.priceProduct({ productId: 'iphone-13', variantId: variant.id, condition: cond.assessment.condition, activeComps: [], soldComps: sold, strategy: 'BALANCED', scope: { tenantId: 'demo' } });
  console.log(`Market value: ${priced.estimatedMarketValue.midpoint.amount} USD`);

  // Shipping estimate
  const spec = buildPackageSpec({ weight: 1, weightUnit: 'LB', length: 8, width: 5, height: 3, dimensionUnit: 'IN' });
  const ship = sdk.estimateShipping({ packageSpec: spec, scope: { tenantId: 'demo' } });
  console.log(`Shipping: ${ship.estimatedRange.midpoint.amount.toFixed(2)} USD (billable ${ship.billableWeight} ${ship.billableWeightUnit})`);

  // Profit
  const fees = sdk.assessFees({ marketplaceRef: 'primeopp-marketplace', basis: { amount: priced.recommendedListPrice.amount, currency: 'USD', precise: false, status: 'ESTIMATED' } });
  const profit = sdk.calculateProfit({
    productId: 'iphone-13',
    listingPrice: { amount: priced.recommendedListPrice.amount, currency: 'USD', precise: false, status: 'ESTIMATED' },
    costBasis: { amount: 300, currency: 'USD', precise: true, status: 'ACTUAL' },
    inboundCost: { amount: 0, currency: 'USD', precise: true, status: 'ACTUAL' },
    feeAssessment: fees,
    shippingEstimate: ship,
    taxTreatment: 'EXCLUDED',
    scope: { tenantId: 'demo' },
  });
  console.log(`Net profit: ${profit.netProfit.amount} USD; ROI: ${(profit.roi * 100).toFixed(1)}%`);

  // Score
  const opp = sdk.scoreOpportunity({
    expectedProfit: profit.netProfit, roi: profit.roi, margin: profit.margin,
    comparableCount: priced.comparableCount, confidence: 0.85,
    conditionRisk: 0.2, authenticityRisk: 0.1, shippingComplexity: 0.2, sellThroughProxy: 0.7,
    scope: { tenantId: 'demo' },
  });
  console.log(`Decision: ${opp.decision}`);
}

main().catch(console.error);
