import { describe, it, expect } from 'vitest';
import { listRetailers, getRetailer, getRetailerBySlug, listRetailersByRegion, RETAILER_COUNT, RETAILER_SLUGS } from '../src/index.js';

describe('retailer-registry', () => {
  it('has 20 retailers', () => {
    expect(RETAILER_COUNT).toBe(20);
    expect(listRetailers()).toHaveLength(20);
  });
  it('retrieves by id and by slug', () => {
    const r = getRetailer('ret:amazon');
    expect(r?.name).toBe('Amazon');
    const r2 = getRetailerBySlug('walmart');
    expect(r2?.id).toBe('ret:walmart');
  });
  it('every retailer has a pending legal review (no live scraping claim)', () => {
    for (const r of listRetailers()) {
      expect(r.termsReference.legalReviewStatus).toBe('pending');
    }
  });
  it('filters by region', () => {
    const us = listRetailersByRegion('US');
    expect(us.length).toBeGreaterThan(0);
  });
  it('every slug resolves', () => {
    for (const s of RETAILER_SLUGS) {
      expect(getRetailerBySlug(s)).toBeDefined();
    }
  });
});
