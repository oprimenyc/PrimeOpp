import { describe, it, expect } from 'vitest';
import { scoreDeal, bandForScore, DEFAULT_WEIGHTS } from '../src/index.js';
import { normalizeOffer } from '@primeopp-deal-intelligence/offer-normalization';
import { money } from '@primeopp-deal-intelligence/contracts';

function mkOffer(over: any = {}) {
  return normalizeOffer({
    retailerId: 'ret:amazon' as any,
    productId: 'p1' as any,
    prices: { base: money(10000), sale: money(5000) },
    availability: { state: 'IN_STOCK', confidence: 0.9, lastCheckedAt: '2024-01-01T00:00:00Z', source: 'fixture' },
    source: { sourceMethod: 'public-product-page', extractionMethod: 'fixture', precedence: 4 },
    ...over
  });
}

describe('deal-scoring', () => {
  it('scores a 50% off deal strongly', () => {
    const r = scoreDeal({ offer: mkOffer() });
    expect(r.overall.value).toBeGreaterThan(40);
    expect(r.consumerValue.value).toBeGreaterThanOrEqual(50);
    expect(r.overall.factors.length).toBeGreaterThan(10);
  });
  it('every factor has rationale', () => {
    const r = scoreDeal({ offer: mkOffer() });
    for (const f of r.overall.factors) {
      expect(f.rationale.length).toBeGreaterThan(0);
    }
  });
  it('bandForScore maps correctly', () => {
    expect(bandForScore(95, [])).toBe('EXCEPTIONAL');
    expect(bandForScore(80, [])).toBe('STRONG');
    expect(bandForScore(50, [])).toBe('CONDITIONAL');
    expect(bandForScore(10, [])).toBe('REJECT');
    expect(bandForScore(50, ['a','b','c','d','e'])).toBe('INSUFFICIENT_DATA');
  });
  it('uses affiliateEligible to boost affiliateOpportunity', () => {
    const without = scoreDeal({ offer: mkOffer() });
    const withAff = scoreDeal({ offer: mkOffer(), affiliateEligible: true });
    expect(withAff.affiliateOpportunity.value).toBeGreaterThanOrEqual(without.affiliateOpportunity.value);
  });
  it('DEFAULT_WEIGHTS sum to ~1.0', () => {
    const sum = Object.values(DEFAULT_WEIGHTS).reduce((a,b) => a+b, 0);
    expect(sum).toBeGreaterThan(0.95);
    expect(sum).toBeLessThan(1.05);
  });
});
