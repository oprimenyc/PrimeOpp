import { describe, it, expect } from 'vitest';
import { normalizeOffer, effectivePrice, isAvailable, isStale } from '../src/index.js';
import { money } from '@primeopp-deal-intelligence/contracts';

describe('offer-normalization', () => {
  it('normalizeOffer fills defaults and never silently drops provenance', () => {
    const o = normalizeOffer({
      retailerId: 'ret:amazon' as any,
      productId: 'prod:1' as any,
      prices: { base: money(1999), sale: money(1499) },
      source: { sourceMethod: 'public-product-page', extractionMethod: 'fixture', precedence: 4 }
    });
    expect(o.id).toMatch(/^offer_/);
    expect(o.availability.state).toBe('UNKNOWN');
    expect(o.confidence.overall).toBeGreaterThan(0);
    expect(o.source.precedence).toBe(4);
  });
  it('effectivePrice prefers coupon > sale > member > base', () => {
    const mk = (prices: any) => normalizeOffer({
      retailerId: 'ret:x' as any, productId: 'p' as any, prices,
      source: { sourceMethod: 'manual-entry', extractionMethod: 't', precedence: 6 }
    });
    expect(effectivePrice(mk({ base: money(1999) }))?.amountMinor).toBe(1999);
    expect(effectivePrice(mk({ base: money(1999), sale: money(1499) }))?.amountMinor).toBe(1499);
    expect(effectivePrice(mk({ base: money(1999), sale: money(1499), coupon: money(999) }))?.amountMinor).toBe(999);
  });
  it('isAvailable returns true for IN_STOCK and similar', () => {
    const o = normalizeOffer({
      retailerId: 'ret:x' as any, productId: 'p' as any,
      availability: { state: 'IN_STOCK', confidence: 0.9, lastCheckedAt: '2024-01-01T00:00:00Z', source: 'fixture' },
      source: { sourceMethod: 'fixture', extractionMethod: 'fixture', precedence: 6 }
    });
    expect(isAvailable(o)).toBe(true);
    o.availability.state = 'OUT_OF_STOCK';
    expect(isAvailable(o)).toBe(false);
  });
  it('isStale returns true when older than maxAgeMs', () => {
    const o = normalizeOffer({
      retailerId: 'ret:x' as any, productId: 'p' as any,
      availability: { state: 'IN_STOCK', confidence: 0.9, lastCheckedAt: '2020-01-01T00:00:00Z', source: 'fixture' },
      source: { sourceMethod: 'fixture', extractionMethod: 'fixture', precedence: 6 }
    });
    expect(isStale(o, 1000, '2024-01-01T00:00:00Z')).toBe(true);
  });
});
