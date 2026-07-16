import { describe, it, expect } from 'vitest';
import { InMemoryHistoricalPriceStore, discountPercentile, isHistoricalLow, isNearHistoricalLow } from '../src/index.js';
import { money } from '@primeopp-deal-intelligence/contracts';

describe('historical-pricing', () => {
  it('records and retrieves observations', async () => {
    const s = new InMemoryHistoricalPriceStore();
    await s.record({ productId: 'p1' as any, retailerId: 'ret:amazon' as any, observedAt: '2024-01-01T00:00:00Z', retailerPrice: money(2000), source: 'fixture', evidence: [] });
    const list = await s.observations('p1');
    expect(list).toHaveLength(1);
  });
  it('computes stats including lowest, median, recent average', async () => {
    const s = new InMemoryHistoricalPriceStore();
    for (const p of [2000, 1800, 1500, 1600, 1400]) {
      await s.record({ productId: 'p1' as any, retailerId: 'ret:amazon' as any, observedAt: '2024-01-01T00:00:00Z', effectivePrice: money(p), source: 'fixture', evidence: [] });
    }
    const stats = await s.stats('p1');
    expect(stats.observationCount).toBe(5);
    expect(stats.lowestObserved?.amountMinor).toBe(1400);
    expect(stats.medianObserved?.amountMinor).toBe(1600);
    expect(stats.recentAverage?.amountMinor).toBeGreaterThan(0);
    expect(stats.priceVolatility).toBeGreaterThan(0);
  });
  it('returns empty stats when no observations', async () => {
    const s = new InMemoryHistoricalPriceStore();
    const stats = await s.stats('p1');
    expect(stats.observationCount).toBe(0);
  });
  it('discountPercentile returns 0 when current is lowest', () => {
    const p = money(1000);
    const history = [
      { productId: 'p1' as any, retailerId: 'ret:x' as any, observedAt: '2024-01-01T00:00:00Z', effectivePrice: money(2000), source: 'fx', evidence: [] },
      { productId: 'p1' as any, retailerId: 'ret:x' as any, observedAt: '2024-01-02T00:00:00Z', effectivePrice: money(1500), source: 'fx', evidence: [] }
    ];
    expect(discountPercentile(p, history)).toBe(0);
  });
  it('isHistoricalLow and isNearHistoricalLow', () => {
    const stats = { observationCount: 1, lowestObserved: money(1000), freshness: '2024-01-01T00:00:00Z' };
    expect(isHistoricalLow(money(1000), stats)).toBe(true);
    expect(isHistoricalLow(money(1100), stats)).toBe(false);
    expect(isNearHistoricalLow(money(1040), stats, 0.05)).toBe(true);
  });
});
