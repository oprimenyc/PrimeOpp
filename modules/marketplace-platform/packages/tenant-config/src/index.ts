// @primeopp-marketplace/tenant-config
// Default tenant configurations + isolation helpers.

import type { TenantConfig, TenantIsolationRule, TenantRole, TenantId } from '@primeopp-marketplace/contracts';

export const DEFAULT_TENANTS: readonly TenantConfig[] = [
  {
    tenantId: 'tenant_demo',
    displayName: 'PrimeOpp Demo Tenant',
    region: 'US',
    defaultCurrency: 'USD',
    defaultLocale: 'en-US',
    defaultAlsoListOnPrimeOppMarketplace: true,
    defaultChannels: ['primeopp-marketplace', 'test-ebay'],
    feePlanId: 'fee_plan_launch_promo',
    prohibitedItemsAckRequired: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    tenantId: 'tenant_enterprise',
    displayName: 'PrimeOpp Enterprise Tenant',
    region: 'US',
    defaultCurrency: 'USD',
    defaultLocale: 'en-US',
    defaultAlsoListOnPrimeOppMarketplace: false,
    defaultChannels: ['primeopp-marketplace'],
    feePlanId: 'fee_plan_enterprise_contract',
    prohibitedItemsAckRequired: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
];

export const DEFAULT_ISOLATION_RULES: readonly TenantIsolationRule[] = [
  { ruleId: 'iso_listing', tenantId: '*', resourceType: 'listing', accessPattern: 'organization_only' },
  { ruleId: 'iso_order', tenantId: '*', resourceType: 'order', accessPattern: 'organization_only' },
  { ruleId: 'iso_inventory', tenantId: '*', resourceType: 'inventory', accessPattern: 'organization_only' },
  { ruleId: 'iso_credentials', tenantId: '*', resourceType: 'channel_credentials', accessPattern: 'tenant_only' },
  { ruleId: 'iso_settlement', tenantId: '*', resourceType: 'settlement', accessPattern: 'organization_only' },
  { ruleId: 'iso_messages', tenantId: '*', resourceType: 'message', accessPattern: 'organization_only' },
  { ruleId: 'iso_analytics', tenantId: '*', resourceType: 'analytics', accessPattern: 'tenant_only' }
];

export const DEFAULT_ROLES: readonly TenantRole[] = [
  { roleId: 'role_owner', tenantId: '*', name: 'Owner', permissions: ['listing.create','listing.read','listing.update','listing.publish','listing.pause','listing.end','inventory.read','inventory.update','order.read','order.process','order.cancel','return.process','dispute.read','dispute.respond','finance.read','finance.payout','settings.update','team.manage'], scope: 'tenant' },
  { roleId: 'role_manager', tenantId: '*', name: 'Manager', permissions: ['listing.create','listing.read','listing.update','listing.publish','listing.pause','listing.end','inventory.read','inventory.update','order.read','order.process','order.cancel','return.process','dispute.read','dispute.respond'], scope: 'organization' },
  { roleId: 'role_lister', tenantId: '*', name: 'Lister', permissions: ['listing.create','listing.read','listing.update','listing.publish','listing.pause','inventory.read'], scope: 'organization' },
  { roleId: 'role_viewer', tenantId: '*', name: 'Viewer', permissions: ['listing.read','inventory.read','order.read'], scope: 'organization' },
  { roleId: 'role_api', tenantId: '*', name: 'API', permissions: ['listing.create','listing.read','listing.update','listing.publish','listing.pause','listing.end','inventory.read','inventory.update','order.read','order.process','order.cancel','return.process','dispute.read','dispute.respond','finance.read'], scope: 'tenant' }
];

export function getTenantConfig(tenantId: TenantId): TenantConfig | undefined {
  return DEFAULT_TENANTS.find(t => t.tenantId === tenantId);
}

export function checkTenantAccess(
  actorTenantId: TenantId,
  resourceTenantId: TenantId,
  resourceOrganizationId?: string,
  actorOrganizationId?: string
): { allowed: boolean; reason: string } {
  if (actorTenantId !== resourceTenantId) {
    return { allowed: false, reason: `cross-tenant access denied: actor tenant ${actorTenantId} cannot access resource in tenant ${resourceTenantId}` };
  }
  if (resourceOrganizationId && actorOrganizationId && resourceOrganizationId !== actorOrganizationId) {
    return { allowed: false, reason: `cross-organization access denied: actor org ${actorOrganizationId} cannot access resource in org ${resourceOrganizationId}` };
  }
  return { allowed: true, reason: 'tenant and organization match' };
}

export function roleHasPermission(role: TenantRole, permission: string): boolean {
  return role.permissions.includes(permission);
}

export function findRole(tenantId: TenantId, roleId: string): TenantRole | undefined {
  return DEFAULT_ROLES.find(r => r.roleId === roleId && (r.tenantId === '*' || r.tenantId === tenantId));
}
