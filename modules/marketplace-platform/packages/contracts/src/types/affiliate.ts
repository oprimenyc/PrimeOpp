// Affiliate product contracts (NOT inventory — external retailer products).
import type { Identifier, TenantId, ISO8601, Money, EvidenceRecord } from './common.js';

export type AffiliateKind =
  | 'marketplace_listing'
  | 'external_affiliate_offer'
  | 'sponsored_placement'
  | 'external_retailer_product';

export interface AffiliateOffer {
  readonly affiliateOfferId: Identifier;
  readonly tenantId: TenantId;
  readonly kind: AffiliateKind;
  readonly externalRetailer?: string;
  readonly externalProductId: string;
  readonly externalUrl: string;
  readonly title: string;
  readonly description?: string;
  readonly imageUrl?: string;
  readonly price: Money;
  readonly commissionRate?: number;
  readonly attributionRef?: Identifier;
  readonly disclosureRequired: boolean;
  readonly disclosureText: string;
  readonly evidence: readonly EvidenceRecord[];
  readonly createdAt: ISO8601;
}
