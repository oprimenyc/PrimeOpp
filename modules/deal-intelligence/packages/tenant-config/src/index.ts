/**
 * @primeopp-deal-intelligence/tenant-config
 *
 * Multi-tenant configuration and isolation. Does not build a competing
 * identity platform; exposes integration contracts only.
 */
import type {
  TenantConfig, TenantId, RetailerId, AlertRule, CampaignId, ISO8601
} from '@primeopp-deal-intelligence/contracts';
import { nextId, nowIso } from '@primeopp-deal-intelligence/contracts';

export type TenantKind = TenantConfig['kind'];

export class TenantRegistry {
  private tenants = new Map<string, TenantConfig>();

  create(input: Omit<TenantConfig, 'id' | 'createdAt'>): TenantConfig {
    const id = nextId('tenant') as TenantId;
    const t: TenantConfig = { ...input, id, createdAt: nowIso() };
    this.tenants.set(id, t);
    return t;
  }

  get(id: string): TenantConfig | undefined { return this.tenants.get(id); }
  list(): TenantConfig[] { return [...this.tenants.values()]; }

  /** Isolation check: tenant A must not see tenant B's private data. */
  canAccessRetailer(tenantId: string, retailerId: RetailerId): boolean {
    const t = this.tenants.get(tenantId);
    if (!t) return false;
    return t.retailers.includes(retailerId);
  }
  canAccessCampaign(tenantId: string, campaignId: CampaignId): boolean {
    const t = this.tenants.get(tenantId);
    if (!t) return false;
    return (t.affiliateCampaigns ?? []).includes(campaignId);
  }
  isolatedDataKeys(tenantId: string): string[] {
    const t = this.tenants.get(tenantId);
    return t?.isolatedData ?? [];
  }
}

export function defaultPublicTenant(): Omit<TenantConfig, 'id' | 'createdAt'> {
  return {
    name: 'PrimeOpp Public',
    kind: 'public',
    retailers: [], // public tenant sees all (enforced by adapter layer)
    alertRules: [],
    isolatedData: ['user-watchlists','conversion-data','unpublished-research']
  };
}

export function defaultEnterpriseTenant(): Omit<TenantConfig, 'id' | 'createdAt'> {
  return {
    name: 'Enterprise',
    kind: 'enterprise-retail',
    retailers: [],
    alertRules: [],
    affiliateCampaigns: [],
    isolatedData: ['private-deal-sources','premium-alerts','custom-retailer-lists','affiliate-campaigns','enterprise-opportunities','unpublished-research','proprietary-scoring-rules','user-watchlists','conversion-data']
  };
}
