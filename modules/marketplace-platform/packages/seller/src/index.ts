// @primeopp-marketplace/seller
// Seller model factory + lifecycle helpers.

import type {
  Seller, SellerAccount, SellerOrganization, SellerProfile, SellerType,
  SellerLifecycleState, SellerUser, SellerPermission, SellerRole,
  SecretReference, Identifier, TenantId, ISO8601, ActorReference,
  SellerLocation, SellerWarehouse, SellerStorefront, SellerTeam, SellerPolicy,
  SellerSubscription, SellerFeePlan, SellerPayoutProfileReference,
  SellerTaxProfileReference, SellerVerification, SellerRiskProfile,
  SellerReputation, SellerLifecycle, ConsignmentAgreement
} from '@primeopp-marketplace/contracts';
import { primeVaultRef } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export interface CreateSellerInput {
  readonly tenantId: TenantId;
  readonly displayName: string;
  readonly email: string;
  readonly sellerType: SellerType;
  readonly timezone: string;
  readonly locale: string;
  readonly defaultAlsoListOnPrimeOppMarketplace?: boolean;
  readonly defaultChannels?: readonly string[];
  readonly payoutProfileRef?: SecretReference;
  readonly taxProfileRef?: SecretReference;
}

export function createSeller(input: CreateSellerInput): Seller {
  const now = new Date().toISOString();
  const organizationId = newId('org');
  const accountId = newId('seller');
  const sellerId = newId('seller');
  const organization: SellerOrganization = {
    organizationId,
    tenantId: input.tenantId,
    name: input.displayName,
    sellerType: input.sellerType,
    defaultAlsoListOnPrimeOppMarketplace: input.defaultAlsoListOnPrimeOppMarketplace ?? true,
    defaultChannels: input.defaultChannels ?? ['primeopp-marketplace'],
    payoutProfileRef: input.payoutProfileRef,
    taxProfileRef: input.taxProfileRef,
    createdAt: now
  };
  const account: SellerAccount = {
    accountId,
    organizationId,
    tenantId: input.tenantId,
    email: input.email,
    lifecycle: 'onboarding',
    createdAt: now,
    updatedAt: now
  };
  const profile: SellerProfile = {
    displayName: input.displayName,
    contactEmail: input.email,
    timezone: input.timezone,
    locale: input.locale
  };
  return {
    sellerId,
    tenantId: input.tenantId,
    organization, account, profile,
    createdAt: now,
    updatedAt: now
  };
}

export function createSellerUser(
  organizationId: Identifier,
  tenantId: TenantId,
  roles: SellerRole[],
  permissions: SellerPermission[],
  identityRefKey?: string
): SellerUser {
  return {
    userId: newId('user'),
    organizationId,
    tenantId,
    teamIds: [],
    roles,
    permissions,
    identityRef: identityRefKey ? primeVaultRef(identityRefKey) : undefined
  };
}

export function createSellerLocation(
  organizationId: Identifier,
  name: string,
  kind: SellerLocation['kind'],
  supportsLocalPickup: boolean,
  publicSafeLocation?: { name: string; instructions: string }
): SellerLocation {
  return {
    locationId: newId('loc'),
    organizationId,
    name,
    kind,
    publicSafeLocation,
    supportsLocalPickup
  };
}

export function createSellerWarehouse(organizationId: Identifier, locationId: Identifier, name: string, region: string, timezone: string): SellerWarehouse {
  return {
    warehouseId: newId('wh'),
    locationId,
    organizationId,
    name,
    region,
    timezone
  };
}

export function createSellerStorefront(organizationId: Identifier, slug: string, title: string, publicUrl: string): SellerStorefront {
  return {
    storefrontId: newId('store'),
    organizationId,
    slug,
    title,
    publicUrl
  };
}

export function createSellerTeam(organizationId: Identifier, name: string, memberIds: Identifier[] = []): SellerTeam {
  return {
    teamId: newId('team'),
    organizationId,
    name,
    memberIds
  };
}

export function createSellerPolicy(organizationId: Identifier, opts: { returnWindowDays: number; restockingFeePercent: number; localPickupPolicy: SellerPolicy['localPickupPolicy']; shippingPolicyRef?: Identifier }): SellerPolicy {
  return {
    policyId: newId('pol'),
    organizationId,
    returnWindowDays: opts.returnWindowDays,
    restockingFeePercent: opts.restockingFeePercent,
    localPickupPolicy: opts.localPickupPolicy,
    shippingPolicyRef: opts.shippingPolicyRef,
    prohibitedItemsAck: true
  };
}

export function createSellerSubscription(organizationId: Identifier, plan: SellerSubscription['plan']): SellerSubscription {
  const now = new Date();
  return {
    subscriptionId: newId('sub'),
    organizationId,
    plan,
    startedAt: now.toISOString(),
    renewsAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString()
  };
}

export function createSellerFeePlan(organizationId: Identifier, tier: SellerFeePlan['tier'], discountPercent: number): SellerFeePlan {
  return {
    feePlanId: newId('fee'),
    organizationId,
    tier,
    discountPercent
  };
}

export function createSellerPayoutProfile(organizationId: Identifier, provider: string, accountRefKey: string): SellerPayoutProfileReference {
  return {
    payoutProfileId: newId('payout'),
    organizationId,
    provider,
    accountRef: primeVaultRef(accountRefKey)
  };
}

export function createSellerTaxProfile(organizationId: Identifier, jurisdiction: string, profileRefKey: string): SellerTaxProfileReference {
  return {
    taxProfileId: newId('tax'),
    organizationId,
    jurisdiction,
    profileRef: primeVaultRef(profileRefKey)
  };
}

export function createSellerVerification(organizationId: Identifier, kind: SellerVerification['kind'], status: SellerVerification['status'] = 'pending'): SellerVerification {
  return {
    verificationId: newId('ver'),
    organizationId,
    status,
    kind
  };
}

export function createSellerRiskProfile(organizationId: Identifier, riskScore: number, signals: string[]): SellerRiskProfile {
  return {
    riskProfileId: newId('risk'),
    organizationId,
    riskScore,
    signals,
    updatedAt: new Date().toISOString()
  };
}

export function createSellerReputation(organizationId: Identifier, ratingAverage: number, ratingCount: number, disputeRate: number, cancellationRate: number): SellerReputation {
  return {
    reputationId: newId('rep'),
    organizationId,
    ratingAverage,
    ratingCount,
    disputeRate,
    cancellationRate,
    updatedAt: new Date().toISOString()
  };
}

export function createConsignmentAgreement(
  tenantId: TenantId,
  organizationId: Identifier,
  consignorOrgId: Identifier,
  consigneeOrgId: Identifier,
  commissionSplitPercent: number,
  approvalPolicy: 'auto' | 'manual',
  minimumSaleAmount?: number,
  currency: string = 'USD'
): ConsignmentAgreement {
  return {
    agreementId: newId('cons'),
    organizationId,
    tenantId,
    consignorOrgId,
    consigneeOrgId,
    commissionSplitPercent,
    minimumSalePrice: minimumSaleAmount ? { amount: String(minimumSaleAmount), currency } : undefined,
    approvalPolicy,
    signedAt: new Date().toISOString()
  };
}

// Lifecycle transition rules: only allow known transitions.
const VALID_TRANSITIONS: Record<SellerLifecycleState, readonly SellerLifecycleState[]> = {
  prospect: ['onboarding'],
  onboarding: ['active', 'paused', 'closed'],
  active: ['paused', 'suspended', 'closed'],
  paused: ['active', 'closed'],
  suspended: ['active', 'terminated'],
  closed: [],
  terminated: []
};

export function transitionSellerLifecycle(
  current: SellerLifecycle,
  target: SellerLifecycleState,
  actor: ActorReference,
  reason?: string
): { ok: true; lifecycle: SellerLifecycle } | { ok: false; code: string; message: string } {
  const allowed = VALID_TRANSITIONS[current.currentState] ?? [];
  if (!allowed.includes(target)) {
    return { ok: false, code: 'INVALID_TRANSITION', message: `cannot transition from ${current.currentState} to ${target}` };
  }
  const entry = { state: target, at: new Date().toISOString(), reason, actor };
  return {
    ok: true,
    lifecycle: {
      ...current,
      currentState: target,
      history: [...current.history, entry]
    }
  };
}

export function createInitialSellerLifecycle(accountId: Identifier): SellerLifecycle {
  return {
    accountId,
    currentState: 'onboarding',
    history: [{ state: 'onboarding', at: new Date().toISOString(), reason: 'initial state', actor: { actorType: 'system', actorId: 'system', tenantId: '' } }]
  };
}
