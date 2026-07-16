import { describe, it, expect } from 'vitest';
import { validateDeal, isTerminal, isPublishable } from '../src/index.js';
import { normalizeOffer } from '@primeopp-deal-intelligence/offer-normalization';
import { money } from '@primeopp-deal-intelligence/contracts';

function mkOffer(over: any = {}) {
  return normalizeOffer({
    retailerId: 'ret:amazon' as any,
    productId: 'p1' as any,
    prices: { base: money(1999), sale: money(1499) },
    availability: { state: 'IN_STOCK', confidence: 0.9, lastCheckedAt: '2024-01-01T00:00:00Z', source: 'fixture' },
    source: { sourceMethod: 'public-product-page', extractionMethod: 'fixture', precedence: 4 },
    evidence: [{ id: 'e1', kind: 'structured-json', capturedAt: '2024-01-01T00:00:00Z', payloadRef: 'ref://1' }],
    ...over
  });
}

describe('deal-validation', () => {
  it('VERIFIED for clean deal', () => {
    const r = validateDeal({ offer: mkOffer() });
    expect(r.state).toBe('VERIFIED');
  });
  it('REJECTED when retailerId missing', () => {
    const o = mkOffer(); o.retailerId = '' as any;
    const r = validateDeal({ offer: o });
    expect(r.state).toBe('REJECTED');
  });
  it('DEAD when out of stock', () => {
    const o = mkOffer({ availability: { state: 'OUT_OF_STOCK', confidence: 0.9, lastCheckedAt: '2024-01-01T00:00:00Z', source: 'fixture' } });
    const r = validateDeal({ offer: o });
    expect(r.state).toBe('DEAD');
  });
  it('EXPIRED when expiration in past', () => {
    const o = mkOffer({ expiration: { expiresAt: '2020-01-01T00:00:00Z' } });
    const r = validateDeal({ offer: o, now: '2024-01-01T00:00:00Z' });
    expect(r.state).toBe('EXPIRED');
  });
  it('VERIFIED_WITH_CONDITIONS when membership required', () => {
    const o = mkOffer({ restrictions: { membershipRequired: true } });
    const r = validateDeal({ offer: o });
    expect(r.state).toBe('VERIFIED_WITH_CONDITIONS');
  });
  it('NEEDS_REVIEW when no evidence', () => {
    const o = mkOffer({ evidence: [] });
    const r = validateDeal({ offer: o });
    expect(r.state).toBe('NEEDS_REVIEW');
    expect(r.missingEvidence.length).toBeGreaterThan(0);
  });
  it('BLOCKED for excluded category', () => {
    const r = validateDeal({
      offer: mkOffer(),
      product: { id: 'p1' as any, canonicalTitle: 'X', sourceTitle: 'X', identifiers: [], variants: [], condition: 'new', confidence: 1, evidence: [], createdAt: '2024-01-01T00:00:00Z', category: 'weapons' },
      knownExclusions: ['weapons']
    });
    expect(r.state).toBe('BLOCKED');
  });
  it('REJECTED when source URL not HTTPS', () => {
    const o = mkOffer({ source: { sourceMethod: 'public-product-page', sourceUrl: 'http://example.com/p', extractionMethod: 'fixture', precedence: 4 } });
    const r = validateDeal({ offer: o });
    expect(r.state).toBe('REJECTED');
  });
  it('isTerminal and isPublishable', () => {
    expect(isTerminal('PUBLISHED')).toBe(true);
    expect(isTerminal('VERIFIED')).toBe(false);
    expect(isPublishable('VERIFIED')).toBe(true);
    expect(isPublishable('VERIFIED_WITH_CONDITIONS')).toBe(true);
    expect(isPublishable('NEEDS_REVIEW')).toBe(false);
  });
});
