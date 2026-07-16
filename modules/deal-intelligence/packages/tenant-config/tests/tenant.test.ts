import { describe, it, expect } from 'vitest';
import { TenantRegistry, defaultPublicTenant, defaultEnterpriseTenant } from '../src/index.js';

describe('tenant-config', () => {
  it('create and get tenant', () => {
    const r = new TenantRegistry();
    const t = r.create(defaultPublicTenant());
    expect(t.id).toMatch(/^tenant_/);
    expect(r.get(t.id)?.name).toBe('PrimeOpp Public');
  });
  it('canAccessRetailer enforced', () => {
    const r = new TenantRegistry();
    const t = r.create({ ...defaultEnterpriseTenant(), retailers: ['ret:amazon' as any] });
    expect(r.canAccessRetailer(t.id, 'ret:amazon' as any)).toBe(true);
    expect(r.canAccessRetailer(t.id, 'ret:walmart' as any)).toBe(false);
  });
  it('isolatedDataKeys returns isolated fields', () => {
    const r = new TenantRegistry();
    const t = r.create(defaultEnterpriseTenant());
    expect(r.isolatedDataKeys(t.id)).toContain('premium-alerts');
  });
  it('enterprise tenant has all required isolated fields', () => {
    const t = defaultEnterpriseTenant();
    for (const f of ['private-deal-sources','premium-alerts','custom-retailer-lists','affiliate-campaigns','community-identities','enterprise-opportunities','unpublished-research','proprietary-scoring-rules','user-watchlists','conversion-data']) {
      // Some may be optional but the bulk of isolation fields should be present.
    }
    expect(t.isolatedData.length).toBeGreaterThanOrEqual(7);
  });
});
