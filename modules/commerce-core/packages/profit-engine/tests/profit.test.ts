import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateProfit, computeTargetBuyPrice, decideProfitOpportunity } from '../src/index.ts';

test('calculateProfit produces positive ROI on profitable sale', () => {
  const r = calculateProfit({
    productId: 'p1',
    listingPrice: { amount: 100, currency: 'USD', precise: true, status: 'ACTUAL' },
    costBasis: { amount: 50, currency: 'USD', precise: true, status: 'ACTUAL' },
    inboundCost: { amount: 5, currency: 'USD', precise: true, status: 'ACTUAL' },
    feeAssessment: {
      scheduleRef: 's1', scheduleVersion: '1', basis: { amount: 100, currency: 'USD', precise: false, status: 'AUTHORITATIVE' },
      lineItems: [
        { type: 'MARKETPLACE_COMMISSION', amount: { amount: 8, currency: 'USD', precise: false, status: 'AUTHORITATIVE' }, model: 'PERCENTAGE', rate: 0.08 },
        { type: 'PAYMENT_PROCESSING', amount: { amount: 3, currency: 'USD', precise: false, status: 'AUTHORITATIVE' }, model: 'PERCENTAGE', rate: 0.029 },
      ],
      total: { amount: 11, currency: 'USD', precise: false, status: 'AUTHORITATIVE' },
      estimated: false,
      staleWarnings: [],
    },
    taxTreatment: 'EXCLUDED',
    scope: { tenantId: 't1' },
  });
  assert.equal(r.grossRevenue.amount, 100);
  assert.equal(r.productCost.amount, 50);
  assert.equal(r.inboundCost.amount, 5);
  assert.equal(r.marketplaceFees.amount, 8);
  assert.equal(r.paymentFees.amount, 3);
  // net = 100 - 50 - 5 - 8 - 3 = 34 (no shipping, packaging, labor, etc.)
  assert.equal(r.netProfit.amount, 34);
  assert.ok(r.roi > 0);
  assert.ok(r.margin > 0);
});

test('calculateProfit produces negative ROI on loss', () => {
  const r = calculateProfit({
    productId: 'p1',
    listingPrice: { amount: 50, currency: 'USD', precise: true, status: 'ACTUAL' },
    costBasis: { amount: 50, currency: 'USD', precise: true, status: 'ACTUAL' },
    inboundCost: { amount: 5, currency: 'USD', precise: true, status: 'ACTUAL' },
    taxTreatment: 'EXCLUDED',
    scope: { tenantId: 't1' },
  });
  assert.ok(r.netProfit.amount < 0);
  assert.ok(r.roi < 0);
});

test('calculateProfit warns when feeAssessment is missing', () => {
  const r = calculateProfit({
    productId: 'p1',
    listingPrice: { amount: 100, currency: 'USD', precise: true, status: 'ACTUAL' },
    costBasis: { amount: 50, currency: 'USD', precise: true, status: 'ACTUAL' },
    inboundCost: { amount: 5, currency: 'USD', precise: true, status: 'ACTUAL' },
    taxTreatment: 'EXCLUDED',
    scope: { tenantId: 't1' },
  });
  assert.ok(r.warnings.some((w) => w.includes('fee assessment missing')));
  assert.equal(r.marketplaceFees.amount, 0);
});

test('calculateProfit break-even equals total costs', () => {
  const r = calculateProfit({
    productId: 'p1',
    listingPrice: { amount: 100, currency: 'USD', precise: true, status: 'ACTUAL' },
    costBasis: { amount: 50, currency: 'USD', precise: true, status: 'ACTUAL' },
    inboundCost: { amount: 5, currency: 'USD', precise: true, status: 'ACTUAL' },
    packagingCost: { amount: 2, currency: 'USD', precise: true, status: 'ACTUAL' },
    taxTreatment: 'EXCLUDED',
    scope: { tenantId: 't1' },
  });
  // Break-even = 50 + 5 + 2 = 57
  assert.equal(r.breakEvenPrice.amount, 57);
});

test('calculateProfit tags every line with epistemic status', () => {
  const r = calculateProfit({
    productId: 'p1',
    listingPrice: { amount: 100, currency: 'USD', precise: true, status: 'ACTUAL' },
    costBasis: { amount: 50, currency: 'USD', precise: true, status: 'ESTIMATED' },
    inboundCost: { amount: 5, currency: 'USD', precise: true, status: 'ACTUAL' },
    taxTreatment: 'EXCLUDED',
    scope: { tenantId: 't1' },
  });
  assert.equal(r.statuses.productCost, 'ESTIMATED');
  assert.equal(r.statuses.inboundCost, 'ACTUAL');
  assert.equal(r.statuses.grossRevenue, 'ACTUAL');
});

test('computeTargetBuyPrice for desired ROI', () => {
  const target = computeTargetBuyPrice({
    listingPrice: { amount: 100, currency: 'USD', precise: true, status: 'ESTIMATED' },
    nonProductCosts: { amount: 10, currency: 'USD', precise: true, status: 'ESTIMATED' },
    desiredRoi: 0.5,
  });
  // (100 - 10) / (1 + 0.5) = 90 / 1.5 = 60
  assert.equal(target.amount, 60);
});

test('calculateProfit reports currency mismatch warning', () => {
  const r = calculateProfit({
    productId: 'p1',
    listingPrice: { amount: 100, currency: 'EUR', precise: true, status: 'ACTUAL' },
    costBasis: { amount: 50, currency: 'USD', precise: true, status: 'ACTUAL' },
    inboundCost: { amount: 5, currency: 'USD', precise: true, status: 'ACTUAL' },
    taxTreatment: 'EXCLUDED',
    scope: { tenantId: 't1' },
  });
  assert.ok(r.warnings.some((w) => w.includes('currency')));
});

test('decideProfitOpportunity returns deterministic BUY decision for strong metrics', () => {
  const r = calculateProfit({
    productId: 'p1',
    listingPrice: { amount: 100, currency: 'USD', precise: true, status: 'ACTUAL' },
    costBasis: { amount: 50, currency: 'USD', precise: true, status: 'ACTUAL' },
    inboundCost: { amount: 5, currency: 'USD', precise: true, status: 'ACTUAL' },
    feeAssessment: {
      scheduleRef: 's1',
      scheduleVersion: '1',
      basis: { amount: 100, currency: 'USD', precise: true, status: 'AUTHORITATIVE' },
      lineItems: [
        { type: 'MARKETPLACE_COMMISSION', amount: { amount: 8, currency: 'USD', precise: true, status: 'AUTHORITATIVE' }, model: 'PERCENTAGE', rate: 0.08 }
      ],
      total: { amount: 8, currency: 'USD', precise: true, status: 'AUTHORITATIVE' },
      estimated: false,
      staleWarnings: []
    },
    taxTreatment: 'EXCLUDED',
    scope: { tenantId: 't1' }
  });

  const decision = decideProfitOpportunity(r);
  assert.equal(decision.decision, 'BUY');
  assert.equal(decision.blockers.length, 0);
  assert.equal(decision.marginPct, 37);
  assert.equal(decision.roiPct, 58.73);
});

test('decideProfitOpportunity blocks non-positive profit', () => {
  const r = calculateProfit({
    productId: 'p1',
    listingPrice: { amount: 50, currency: 'USD', precise: true, status: 'ACTUAL' },
    costBasis: { amount: 50, currency: 'USD', precise: true, status: 'ACTUAL' },
    inboundCost: { amount: 5, currency: 'USD', precise: true, status: 'ACTUAL' },
    taxTreatment: 'EXCLUDED',
    scope: { tenantId: 't1' }
  });

  const decision = decideProfitOpportunity(r);
  assert.equal(decision.decision, 'PASS');
  assert.ok(decision.blockers.some((blocker) => blocker.code === 'NON_POSITIVE_NET_PROFIT'));
});
