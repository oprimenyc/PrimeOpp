// Tenant configuration contracts.
import type { TenantId, ISO8601 } from './common.js';

export interface TenantConfig {
  readonly tenantId: TenantId;
  readonly displayName: string;
  readonly region: string;
  readonly defaultCurrency: string;
  readonly defaultLocale: string;
  readonly defaultAlsoListOnPrimeOppMarketplace: boolean;
  readonly defaultChannels: readonly string[];
  readonly feePlanId: string;
  readonly prohibitedItemsAckRequired: boolean;
  readonly createdAt: ISO8601;
  readonly updatedAt: ISO8601;
}

export interface TenantIsolationRule {
  readonly ruleId: string;
  readonly tenantId: TenantId;
  readonly resourceType: string;
  readonly accessPattern: 'owner_only' | 'organization_only' | 'tenant_only' | 'cross_tenant_denied';
}

export interface TenantRole {
  readonly roleId: string;
  readonly tenantId: TenantId;
  readonly name: string;
  readonly permissions: readonly string[];
  readonly scope: 'tenant' | 'organization' | 'listing' | 'order';
}
