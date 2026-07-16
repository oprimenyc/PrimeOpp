import { describe, it, expect } from 'vitest';
import { analyzeResale } from '../src/index.js';
import { money } from '@primeopp-deal-intelligence/contracts';

describe('resale-opportunity', () => {
  it('recommends BUY for high ROI', () => {
    const r = analyzeResale({
      acquisitionPrice: money(5000), // $50
      marketplaceComps: [money(10000), money(11000), money(12000), money(11500), money(10500)],
      marketplaceFeePct: 0.13,
      outboundShipping: money(800),
      packaging: money(100),
      sellThroughProxy: 0.7,
      authenticityRisk: 0.1
    });
    expect(r.roi).toBeGreaterThan(0.3);
    expect(['BUY','STRONG_BUY']).toContain(r.recommendation);
    expect(r.expectedProfit.amountMinor).toBeGreaterThan(0);
  });
  it('recommends PASS for low ROI', () => {
    const r = analyzeResale({
      acquisitionPrice: money(9000),
      marketplaceComps: [money(10000), money(10100), money(10200)],
      marketplaceFeePct: 0.13,
      outboundShipping: money(800)
    });
    expect(r.roi).toBeLessThan(0.1);
    expect(['PASS','RESEARCH_MORE','MAYBE']).toContain(r.recommendation);
  });
  it('DATA_INSUFFICIENT when no comps', () => {
    const r = analyzeResale({ acquisitionPrice: money(5000), marketplaceComps: [] });
    expect(r.recommendation).toBe('DATA_INSUFFICIENT');
    expect(r.confidence).toBe(0);
  });
  it('maximumBuyPrice never negative', () => {
    const r = analyzeResale({
      acquisitionPrice: money(5000),
      marketplaceComps: [money(100), money(200), money(300)],
      marketplaceFeePct: 0.13,
      outboundShipping: money(800)
    });
    expect(r.maximumBuyPrice.amountMinor).toBeGreaterThanOrEqual(0);
  });
  it('risk adjustments downgrade STRONG_BUY to BUY when avg risk >0.5', () => {
    const r = analyzeResale({
      acquisitionPrice: money(1000),
      marketplaceComps: [money(10000), money(11000), money(12000), money(11500), money(10500)],
      marketplaceFeePct: 0.10,
      seasonalRisk: 0.7,
      inventoryAgeRisk: 0.6,
      variantRisk: 0.4,
      authenticityRisk: 0.4
    });
    expect(['BUY','MAYBE']).toContain(r.recommendation);
  });
});
