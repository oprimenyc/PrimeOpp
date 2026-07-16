// Canonical Buyer model.
import type { Identifier, TenantId, ISO8601, SecretReference, EvidenceRecord, ActorReference } from './common.js';

export type BuyerType =
  | 'guest'
  | 'registered'
  | 'verified'
  | 'business'
  | 'enterprise'
  | 'local_pickup'
  | 'repeat';

export type BuyerLifecycleState =
  | 'guest'
  | 'active'
  | 'verified'
  | 'paused'
  | 'suspended'
  | 'closed';

export interface BuyerProfile {
  readonly displayName: string;
  readonly avatarUrl?: string;
  readonly contactEmail?: string;
  readonly contactPhone?: string;
  readonly locale: string;
  readonly timezone: string;
}

export interface BuyerAccount {
  readonly accountId: Identifier;
  readonly tenantId: TenantId;
  readonly buyerType: BuyerType;
  readonly lifecycle: BuyerLifecycleState;
  readonly createdAt: ISO8601;
  readonly updatedAt: ISO8601;
}

export interface BuyerAddressReference {
  readonly addressId: Identifier;
  readonly label: string;
  readonly addressRef: SecretReference; // never raw PII inline
  readonly isDefault: boolean;
}

export interface BuyerPaymentReference {
  readonly paymentMethodId: Identifier;
  readonly provider: string;
  readonly tokenRef: SecretReference; // never raw PAN / CVV
  readonly isDefault: boolean;
}

export interface BuyerPreference {
  readonly preferenceId: Identifier;
  readonly accountId: Identifier;
  readonly preferredCurrency: string;
  readonly preferredLocale: string;
  readonly notifyOnOfferResponse: boolean;
  readonly notifyOnShippingUpdate: boolean;
  readonly notifyOnPriceDrop: boolean;
}

export interface BuyerWatchlist {
  readonly watchlistId: Identifier;
  readonly accountId: Identifier;
  readonly listingIds: readonly Identifier[];
  readonly updatedAt: ISO8601;
}

export interface BuyerSavedSearch {
  readonly savedSearchId: Identifier;
  readonly accountId: Identifier;
  readonly name: string;
  readonly query: Record<string, unknown>;
  readonly createdAt: ISO8601;
}

export interface BuyerOfferHistory {
  readonly accountId: Identifier;
  readonly offers: ReadonlyArray<{ readonly offerId: Identifier; readonly at: ISO8601; readonly outcome: string }>;
}

export interface BuyerOrderHistory {
  readonly accountId: Identifier;
  readonly orders: ReadonlyArray<{ readonly orderId: Identifier; readonly at: ISO8601; readonly status: string }>;
}

export interface BuyerReputation {
  readonly reputationId: Identifier;
  readonly accountId: Identifier;
  readonly ratingAverage: number;
  readonly ratingCount: number;
  readonly cancellationRate: number;
  readonly updatedAt: ISO8601;
}

export interface BuyerRiskProfile {
  readonly riskProfileId: Identifier;
  readonly accountId: Identifier;
  readonly riskScore: number;
  readonly signals: readonly string[];
  readonly updatedAt: ISO8601;
}

export interface BuyerEvidence {
  readonly evidence: EvidenceRecord;
  readonly accountId: Identifier;
}

export interface BuyerLifecycle {
  readonly accountId: Identifier;
  readonly currentState: BuyerLifecycleState;
  readonly history: ReadonlyArray<{ readonly state: BuyerLifecycleState; readonly at: ISO8601; readonly reason?: string; readonly actor: ActorReference }>;
}

export interface Buyer {
  readonly buyerId: Identifier;
  readonly tenantId: TenantId;
  readonly account: BuyerAccount;
  readonly profile: BuyerProfile;
  readonly createdAt: ISO8601;
  readonly updatedAt: ISO8601;
}
