import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreOpportunity, DEFAULT_THRESHOLDS } from '../src/index.ts';

test('STRONG_BUY for high ROI + high confidence + no risks', () => {
  const r = scoreOpportunity({
    expectedProfit: { amount: 100, currency: 'USD', precise: false, status: 'ESTIMATED' },
    roi: 1.5,
    margin: 0.5,
    comparableCount: 5,
    confidence: 0.9,
    conditionRisk: 0.1,
    authenticityRisk: 0.1,
    shippingComplexity: 0.2,
    sellThroughProxy: 0.6,
    scope: { tenantId: 't1' },
  });
  assert.equal(r.decision, 'STRONG_BUY');
});

test('BUY for moderate ROI', () => {
  const r = scoreOpportunity({
    expectedProfit: { amount: 50, currency: 'USD', precise: false, status: 'ESTIMATED' },
    roi: 0.5,
    margin: 0.3,
    comparableCount: 4,
    confidence: 0.8,
    conditionRisk: 0.2,
    authenticityRisk: 0.1,
    shippingComplexity: 0.2,
    sellThroughProxy: 0.5,
    scope: { tenantId: 't1' },
  });
  assert.equal(r.decision, 'BUY');
});

test('MAYBE for low ROI with risks', () => {
  const r = scoreOpportunity({
    expectedProfit: { amount: 30, currency: 'USD', precise: false, status: 'ESTIMATED' },
    roi: 0.2,
    margin: 0.2,
    comparableCount: 4,
    confidence: 0.7,
    conditionRisk: 0.6,
    authenticityRisk: 0.2,
    shippingComplexity: 0.3,
    sellThroughProxy: 0.4,
    scope: { tenantId: 't1' },
  });
  assert.equal(r.decision, 'MAYBE');
});

test('PASS for negative expected profit', () => {
  const r = scoreOpportunity({
    expectedProfit: { amount: -10, currency: 'USD', precise: false, status: 'ESTIMATED' },
    roi: -0.1,
    margin: -0.1,
    comparableCount: 5,
    confidence: 0.9,
    conditionRisk: 0.1,
    authenticityRisk: 0.1,
    shippingComplexity: 0.2,
    sellThroughProxy: 0.5,
    scope: { tenantId: 't1' },
  });
  assert.equal(r.decision, 'PASS');
});

test('AUTHENTICATE_FIRST for high authenticity risk', () => {
  const r = scoreOpportunity({
    expectedProfit: { amount: 100, currency: 'USD', precise: false, status: 'ESTIMATED' },
    roi: 1.5,
    margin: 0.5,
    comparableCount: 5,
    confidence: 0.9,
    conditionRisk: 0.1,
    authenticityRisk: 0.8,
    shippingComplexity: 0.2,
    sellThroughProxy: 0.5,
    scope: { tenantId: 't1' },
  });
  assert.equal(r.decision, 'AUTHENTICATE_FIRST');
});

test('INSPECT_FIRST for high condition risk', () => {
  const r = scoreOpportunity({
    expectedProfit: { amount: 100, currency: 'USD', precise: false, status: 'ESTIMATED' },
    roi: 1.5,
    margin: 0.5,
    comparableCount: 5,
    confidence: 0.9,
    conditionRisk: 0.85,
    authenticityRisk: 0.1,
    shippingComplexity: 0.2,
    sellThroughProxy: 0.5,
    scope: { tenantId: 't1' },
  });
  assert.equal(r.decision, 'INSPECT_FIRST');
});

test('DATA_INSUFFICIENT for too much missing data', () => {
  const r = scoreOpportunity({
    expectedProfit: { amount: 100, currency: 'USD', precise: false, status: 'ESTIMATED' },
    roi: 1.5,
    margin: 0.5,
    comparableCount: 1, // below threshold
    confidence: 0.3,    // below threshold
    scope: { tenantId: 't1' },
    // missing conditionRisk, authenticityRisk, shippingComplexity, sellThroughProxy
  });
  assert.equal(r.decision, 'DATA_INSUFFICIENT');
});

test('maximumRecommendedPurchasePrice is positive for profitable opportunity', () => {
  const r = scoreOpportunity({
    expectedProfit: { amount: 100, currency: 'USD', precise: false, status: 'ESTIMATED' },
    roi: 0.5,
    margin: 0.3,
    comparableCount: 4,
    confidence: 0.8,
    scope: { tenantId: 't1' },
  });
  assert.ok(r.maximumRecommendedPurchasePrice.amount > 0);
});

test('tenant thresholds override defaults', () => {
  const r = scoreOpportunity({
    expectedProfit: { amount: 50, currency: 'USD', precise: false, status: 'ESTIMATED' },
    roi: 0.2,
    margin: 0.2,
    comparableCount: 4,
    confidence: 0.8,
    conditionRisk: 0.2,
    authenticityRisk: 0.1,
    shippingComplexity: 0.2,
    sellThroughProxy: 0.5,
    tenantThresholds: { ...DEFAULT_THRESHOLDS, buyRoi: 0.15 },
    scope: { tenantId: 't1' },
  });
  assert.equal(r.decision, 'BUY');
});

test('NEGOTIATE produced for MAYBE-zone ROI with no risks and low sell-through', () => {
  const r = scoreOpportunity({
    expectedProfit: { amount: 30, currency: 'USD', precise: false, status: 'ESTIMATED' },
    roi: 0.2,
    margin: 0.2,
    comparableCount: 4,
    confidence: 0.7,
    conditionRisk: 0.1,
    authenticityRisk: 0.1,
    shippingComplexity: 0.2,
    sellThroughProxy: 0.2,
    scope: { tenantId: 't1' },
  });
  assert.equal(r.decision, 'NEGOTIATE');
  assert.ok(r.suggestedNegotiationTarget);
});
