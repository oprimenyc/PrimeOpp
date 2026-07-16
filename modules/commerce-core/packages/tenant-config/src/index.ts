// Tenant & enterprise config — Phase 21.
// Organizations, sellers, locations, teams, roles.

import type {
  Identified,
  Location,
  Organization,
  Role,
  SellerAccount,
  Team,
  TenantId,
  TenantScoped,
  Timestamped,
} from '@primeopp/contracts';
import { nowUtc, uuid } from '@primeopp/contracts';

/**
 * Reference to a secret stored in Prime Vault (or compatible secret store).
 * NEVER embed the actual secret value in this package.
 */
export interface SecretRef {
  /** Vault reference, e.g. "primevault://tenants/t1/secrets/ebay-api-key". */
  ref: string;
  /** Optional version pin. */
  version?: string;
}

export interface TenantConfig extends Identified, Timestamped {
  tenantId: TenantId;
  name: string;
  organizationIds: string[];
  defaultAlsoListOnPrimeOppMarketplace: boolean;
  /** Thresholds for approvals (e.g. listing approval, refund approval). */
  approvalThresholds: Record<string, number>;
  /** Secret references for adapters (adapterId -> SecretRef). */
  adapterSecrets: Record<string, SecretRef>;
  /** Tenant-level pricing policy. */
  pricingPolicy?: {
    defaultStrategy: string;
    minimumMargin: number;
    minimumRoi: number;
  };
}

export interface TenantConfigStore {
  get(tenantId: TenantId): Promise<TenantConfig | undefined>;
  upsert(config: TenantConfig): Promise<void>;
  list(): Promise<TenantConfig[]>;
}

export class InMemoryTenantConfigStore implements TenantConfigStore {
  private readonly configs = new Map<TenantId, TenantConfig>();

  async get(tenantId: TenantId): Promise<TenantConfig | undefined> {
    return this.configs.get(tenantId);
  }

  async upsert(config: TenantConfig): Promise<void> {
    this.configs.set(config.tenantId, { ...config, updatedAt: nowUtc() });
  }

  async list(): Promise<TenantConfig[]> {
    return Array.from(this.configs.values());
  }
}

export function createTenantConfig(opts: {
  tenantId: TenantId;
  name: string;
  defaultAlsoListOnPrimeOppMarketplace?: boolean;
  approvalThresholds?: Record<string, number>;
  adapterSecrets?: Record<string, SecretRef>;
  pricingPolicy?: TenantConfig['pricingPolicy'];
}): TenantConfig {
  const now = nowUtc();
  return {
    id: uuid(),
    tenantId: opts.tenantId,
    name: opts.name,
    organizationIds: [],
    defaultAlsoListOnPrimeOppMarketplace: opts.defaultAlsoListOnPrimeOppMarketplace ?? true,
    approvalThresholds: opts.approvalThresholds ?? {},
    adapterSecrets: opts.adapterSecrets ?? {},
    ...(opts.pricingPolicy ? { pricingPolicy: opts.pricingPolicy } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

export function createOrganization(opts: {
  tenantId: TenantId;
  name: string;
  businessUnits?: string[];
  defaultAlsoListOnPrimeOppMarketplace?: boolean;
  defaultApprovalThresholds?: Record<string, number>;
}): Organization {
  const now = nowUtc();
  return {
    id: uuid(),
    tenantId: opts.tenantId,
    name: opts.name,
    businessUnits: opts.businessUnits ?? [],
    defaultAlsoListOnPrimeOppMarketplace: opts.defaultAlsoListOnPrimeOppMarketplace ?? true,
    ...(opts.defaultApprovalThresholds ? { defaultApprovalThresholds: opts.defaultApprovalThresholds } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

export function createSellerAccount(opts: {
  tenantId: TenantId;
  organizationId?: string;
  name: string;
  role: string;
  teamIds?: string[];
  locationIds?: string[];
}): SellerAccount {
  const now = nowUtc();
  return {
    id: uuid(),
    tenantId: opts.tenantId,
    ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
    name: opts.name,
    teamIds: opts.teamIds ?? [],
    role: opts.role,
    locationIds: opts.locationIds ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createLocation(opts: {
  tenantId: TenantId;
  organizationId?: string;
  label: string;
  kind: Location['kind'];
  address?: string;
}): Location {
  const now = nowUtc();
  return {
    id: uuid(),
    tenantId: opts.tenantId,
    ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
    label: opts.label,
    kind: opts.kind,
    ...(opts.address ? { address: opts.address } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

export function createTeam(opts: {
  tenantId: TenantId;
  organizationId?: string;
  name: string;
  memberUserIds?: string[];
}): Team {
  const now = nowUtc();
  return {
    id: uuid(),
    tenantId: opts.tenantId,
    ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
    name: opts.name,
    memberUserIds: opts.memberUserIds ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createRole(opts: { tenantId: TenantId; name: string; permissions: string[] }): Role {
  return { id: uuid(), tenantId: opts.tenantId, name: opts.name, permissions: opts.permissions };
}

// ---------------------------------------------------------------------------
// Tenant isolation guards
// ---------------------------------------------------------------------------

export function assertTenantAccess(scope: TenantScoped, targetTenantId: TenantId): void {
  if (scope.tenantId !== targetTenantId) {
    throw new Error(`CROSS_TENANT_ACCESS_DENIED: scope tenant ${scope.tenantId} cannot access tenant ${targetTenantId}`);
  }
}

export function assertOrganizationAccess(scope: TenantScoped, targetOrganizationId: string | undefined): void {
  if (targetOrganizationId === undefined) return;
  if (scope.organizationId === undefined || scope.organizationId !== targetOrganizationId) {
    throw new Error(`CROSS_ORG_ACCESS_DENIED: scope organization ${scope.organizationId ?? '<none>'} cannot access organization ${targetOrganizationId}`);
  }
}

/**
 * Filter records by tenant scope.
 * Used by every read path to enforce tenant isolation.
 */
export function filterByTenantScope<T extends TenantScoped>(records: T[], scope: TenantScoped): T[] {
  return records.filter((r) => r.tenantId === scope.tenantId);
}
