// Offer & Negotiation contracts.
import type { Identifier, TenantId, ISO8601, Money, EvidenceRecord } from './common.js';

export type OfferState =
  | 'CREATED'
  | 'SENT'
  | 'RECEIVED'
  | 'VIEWED'
  | 'COUNTERED'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'WITHDRAWN'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'CONVERTED_TO_ORDER';

export interface Offer {
  readonly offerId: Identifier;
  readonly tenantId: TenantId;
  readonly listingId: Identifier;
  readonly buyerId: Identifier;
  readonly sellerId: Identifier;
  readonly channelId: string;
  readonly offerAmount: Money;
  readonly quantity: number;
  readonly shippingImpact?: Money;
  readonly commissionImpact?: Money;
  readonly messageRef?: Identifier;
  readonly state: OfferState;
  readonly rounds: number;
  readonly expiresAt: ISO8601;
  readonly createdAt: ISO8601;
  readonly updatedAt: ISO8601;
  readonly evidence: readonly EvidenceRecord[];
}

export interface CounterOffer {
  readonly counterId: Identifier;
  readonly offerId: Identifier;
  readonly counterAmount: Money;
  readonly by: 'seller' | 'buyer';
  readonly reason?: string;
  readonly confidence?: number;
  readonly createdAt: ISO8601;
}

export interface NegotiationPolicy {
  readonly policyId: Identifier;
  readonly organizationId: Identifier;
  readonly minimumPrice?: Money;
  readonly targetPrice?: Money;
  readonly autoDeclineFloor?: Money;
  readonly autoAcceptThreshold?: Money;
  readonly maxRounds: number;
  readonly expirationHours: number;
  readonly categorySpecific?: Readonly<Record<string, Partial<NegotiationPolicy>>>;
}

export interface NegotiationDecision {
  readonly decisionId: Identifier;
  readonly offerId: Identifier;
  readonly action: 'accept' | 'decline' | 'counter' | 'manual_review';
  readonly reason: string;
  readonly expectedProfit?: Money;
  readonly commission?: Money;
  readonly sellerRule?: string;
  readonly confidence?: number;
  readonly authority: 'auto' | 'seller' | 'enterprise_policy' | 'manual';
  readonly at: ISO8601;
  readonly evidence: EvidenceRecord;
}
