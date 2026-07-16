import { describe, it, expect } from 'vitest';
import { fromRetailerString, safeQuantityEstimate, freshnessOf, isAvailableState, AVAILABILITY_STATES } from '../src/index.js';

describe('availability-engine', () => {
  it('parses common retailer strings', () => {
    expect(fromRetailerString('In Stock')).toBe('IN_STOCK');
    expect(fromRetailerString('Only 2 left!')).toBe('LOW_STOCK');
    expect(fromRetailerString('Out of stock')).toBe('OUT_OF_STOCK');
    expect(fromRetailerString('Pre-order')).toBe('PREORDER');
    expect(fromRetailerString('Members only')).toBe('REQUIRES_MEMBERSHIP');
    expect(fromRetailerString('')).toBe('UNKNOWN');
  });
  it('safeQuantityEstimate does not fabricate quantity for vague states', () => {
    expect(safeQuantityEstimate('LIMITED', { min: 1, max: 5 })).toBeUndefined();
    expect(safeQuantityEstimate('IN_STOCK', { min: 1, max: 5 })).toEqual({ min: 1, max: 5 });
    expect(safeQuantityEstimate('IN_STOCK', undefined)).toBeUndefined();
  });
  it('freshnessOf returns stale when older than default 24h', () => {
    const f = freshnessOf({ lastCheckedAt: '2020-01-01T00:00:00Z' }, '2024-01-01T00:00:00Z');
    expect(f.stale).toBe(true);
  });
  it('freshnessOf respects staleAfter', () => {
    const f = freshnessOf({ lastCheckedAt: '2024-01-01T00:00:00Z', staleAfter: '2024-01-02T00:00:00Z' }, '2024-01-03T00:00:00Z');
    expect(f.stale).toBe(true);
  });
  it('isAvailableState', () => {
    expect(isAvailableState('IN_STOCK')).toBe(true);
    expect(isAvailableState('OUT_OF_STOCK')).toBe(false);
  });
  it('AVAILABILITY_STATES covers all required states', () => {
    for (const s of ['IN_STOCK','LOW_STOCK','LIMITED','STORE_ONLY','ONLINE_ONLY','PICKUP_ONLY','DELIVERY_ONLY','PREORDER','BACKORDER','RESTOCK_EXPECTED','OUT_OF_STOCK','DISCONTINUED','UNKNOWN','REQUIRES_LOGIN','REQUIRES_MEMBERSHIP']) {
      expect(AVAILABILITY_STATES).toContain(s as any);
    }
  });
});
