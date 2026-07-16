// @primeopp-marketplace/buyer
// Buyer model factory.

import type {
  Buyer, BuyerAccount, BuyerProfile, BuyerType, BuyerLifecycleState,
  BuyerAddressReference, BuyerPaymentReference, BuyerPreference,
  BuyerWatchlist, BuyerSavedSearch, BuyerReputation, BuyerRiskProfile,
  BuyerLifecycle, SecretReference, Identifier, TenantId, ISO8601, ActorReference
} from '@primeopp-marketplace/contracts';
import { primeVaultRef } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export interface CreateBuyerInput {
  readonly tenantId: TenantId;
  readonly displayName: string;
  readonly email?: string;
  readonly buyerType?: BuyerType;
  readonly locale?: string;
  readonly timezone?: string;
}

export function createBuyer(input: CreateBuyerInput): Buyer {
  const now = new Date().toISOString();
  const accountId = newId('buyer');
  const buyerType = input.buyerType ?? 'registered';
  const account: BuyerAccount = {
    accountId,
    tenantId: input.tenantId,
    buyerType,
    lifecycle: buyerType === 'guest' ? 'guest' : 'active',
    createdAt: now,
    updatedAt: now
  };
  const profile: BuyerProfile = {
    displayName: input.displayName,
    contactEmail: input.email,
    locale: input.locale ?? 'en-US',
    timezone: input.timezone ?? 'America/New_York'
  };
  return {
    buyerId: accountId,
    tenantId: input.tenantId,
    account, profile,
    createdAt: now,
    updatedAt: now
  };
}

export function createBuyerAddress(accountId: Identifier, label: string, addressRefKey: string, isDefault = false): BuyerAddressReference {
  return {
    addressId: newId('addr'),
    label,
    addressRef: primeVaultRef(addressRefKey),
    isDefault
  };
}

export function createBuyerPaymentMethod(accountId: Identifier, provider: string, tokenRefKey: string, isDefault = false): BuyerPaymentReference {
  return {
    paymentMethodId: newId('pm'),
    provider,
    tokenRef: primeVaultRef(tokenRefKey),
    isDefault
  };
}

export function createBuyerPreference(accountId: Identifier, opts?: Partial<BuyerPreference>): BuyerPreference {
  return {
    preferenceId: newId('pref'),
    accountId,
    preferredCurrency: opts?.preferredCurrency ?? 'USD',
    preferredLocale: opts?.preferredLocale ?? 'en-US',
    notifyOnOfferResponse: opts?.notifyOnOfferResponse ?? true,
    notifyOnShippingUpdate: opts?.notifyOnShippingUpdate ?? true,
    notifyOnPriceDrop: opts?.notifyOnPriceDrop ?? false
  };
}

export function createBuyerWatchlist(accountId: Identifier, listingIds: Identifier[] = []): BuyerWatchlist {
  return {
    watchlistId: newId('wl'),
    accountId,
    listingIds,
    updatedAt: new Date().toISOString()
  };
}

export function createBuyerSavedSearch(accountId: Identifier, name: string, query: Record<string, unknown>): BuyerSavedSearch {
  return {
    savedSearchId: newId('ss'),
    accountId,
    name,
    query,
    createdAt: new Date().toISOString()
  };
}

export function createBuyerReputation(accountId: Identifier, ratingAverage = 5.0, ratingCount = 0, cancellationRate = 0): BuyerReputation {
  return {
    reputationId: newId('brep'),
    accountId,
    ratingAverage,
    ratingCount,
    cancellationRate,
    updatedAt: new Date().toISOString()
  };
}

export function createBuyerRiskProfile(accountId: Identifier, riskScore = 0, signals: string[] = []): BuyerRiskProfile {
  return {
    riskProfileId: newId('brisk'),
    accountId,
    riskScore,
    signals,
    updatedAt: new Date().toISOString()
  };
}

export function createInitialBuyerLifecycle(accountId: Identifier, initialState: BuyerLifecycleState = 'active'): BuyerLifecycle {
  return {
    accountId,
    currentState: initialState,
    history: [{ state: initialState, at: new Date().toISOString(), reason: 'initial state', actor: { actorType: 'system', actorId: 'system', tenantId: '' } }]
  };
}

const VALID_TRANSITIONS: Record<BuyerLifecycleState, readonly BuyerLifecycleState[]> = {
  guest: ['active', 'closed'],
  active: ['verified', 'paused', 'suspended', 'closed'],
  verified: ['paused', 'suspended', 'closed'],
  paused: ['active', 'closed'],
  suspended: ['active', 'closed'],
  closed: []
};

export function transitionBuyerLifecycle(
  current: BuyerLifecycle,
  target: BuyerLifecycleState,
  actor: ActorReference,
  reason?: string
): { ok: true; lifecycle: BuyerLifecycle } | { ok: false; code: string; message: string } {
  const allowed = VALID_TRANSITIONS[current.currentState] ?? [];
  if (!allowed.includes(target)) {
    return { ok: false, code: 'INVALID_TRANSITION', message: `cannot transition from ${current.currentState} to ${target}` };
  }
  return {
    ok: true,
    lifecycle: {
      ...current,
      currentState: target,
      history: [...current.history, { state: target, at: new Date().toISOString(), reason, actor }]
    }
  };
}
