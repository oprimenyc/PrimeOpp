import { describe, it, expect } from 'vitest';
import { buildPublication, seoMetadataFor, correctionPolicyText, InMemoryPublishingCaptureAdapter } from '../src/index.js';

describe('publishing-contracts', () => {
  it('buildPublication requires affiliate disclosure', () => {
    expect(() => buildPublication({
      target: 'primeopp-website', tenantId: 't1', headline: 'X',
      product: { productId: 'p' as any, canonicalTitle: 'X' },
      retailer: { retailerId: 'r' as any, name: 'X' },
      requirements: [], availability: 'IN_STOCK',
      affiliateDisclosure: '', evidenceFreshness: '2024-01-01T00:00:00Z',
      verificationLabel: 'verified', correctionPolicy: 'p', structuredSeoMetadata: {}
    })).toThrow();
  });
  it('buildPublication assigns id and createdAt', () => {
    const p = buildPublication({
      target: 'primeopp-website', tenantId: 't1', headline: 'X',
      product: { productId: 'p' as any, canonicalTitle: 'X' },
      retailer: { retailerId: 'r' as any, name: 'X' },
      requirements: [], availability: 'IN_STOCK',
      affiliateDisclosure: 'Affiliate', evidenceFreshness: '2024-01-01T00:00:00Z',
      verificationLabel: 'verified', correctionPolicy: 'p', structuredSeoMetadata: {}
    });
    expect(p.id).toMatch(/^pub_/);
    expect(p.createdAt).toBeTruthy();
  });
  it('seoMetadataFor includes og:title and price', () => {
    const m = seoMetadataFor({
      headline: 'X',
      product: { productId: 'p' as any, canonicalTitle: 'X' },
      retailer: { retailerId: 'r' as any, name: 'Amazon' },
      effectivePrice: { amountMinor: 1999, currency: 'USD' }
    });
    expect(m['og:title']).toBe('X');
    expect(m['product:price:amount']).toBe('19.99');
  });
  it('InMemoryPublishingCaptureAdapter is test-only and captures', async () => {
    const a = new InMemoryPublishingCaptureAdapter('rss');
    expect(a.testOnly).toBe(true);
    const p = buildPublication({
      target: 'rss', tenantId: 't1', headline: 'X',
      product: { productId: 'p' as any, canonicalTitle: 'X' },
      retailer: { retailerId: 'r' as any, name: 'X' },
      requirements: [], availability: 'IN_STOCK',
      affiliateDisclosure: 'Affiliate', evidenceFreshness: '2024-01-01T00:00:00Z',
      verificationLabel: 'verified', correctionPolicy: 'p', structuredSeoMetadata: {}
    });
    await a.publish(p);
    expect(a.captured).toHaveLength(1);
  });
  it('correctionPolicyText mentions correction', () => {
    expect(correctionPolicyText().toLowerCase()).toContain('correction');
  });
});
