// AMOS (marketplace marketing/promotional) contracts.
import type { Identifier, TenantId, ISO8601, EvidenceRecord } from './common.js';

export type AmosCampaignKind =
  | 'new_listing_spotlight'
  | 'seller_story'
  | 'deal_to_marketplace_story'
  | 'trending_category'
  | 'unique_item'
  | 'flip_of_the_day'
  | 'marketplace_launch_campaign'
  | 'grand_opening_fee_campaign'
  | 'enterprise_seller_campaign'
  | 'nonprofit_marketplace_campaign';

export interface AmosJob {
  readonly amosJobId: Identifier;
  readonly tenantId: TenantId;
  readonly kind: AmosCampaignKind;
  readonly listingRefs: readonly Identifier[];
  readonly sellerConsentId: Identifier;
  readonly verifiedFacts: ReadonlyArray<{ readonly fact: string; readonly evidenceId: Identifier }>;
  readonly publicUrls: readonly string[];
  readonly prohibitedClaims: readonly string[];
  readonly disclosures: readonly string[];
  readonly expiresAt: ISO8601;
  readonly thumbnailConcepts: readonly string[];
  readonly shortScript?: string;
  readonly longFormOutline?: readonly string[];
  readonly captions?: readonly string[];
  readonly seoMetadata?: Readonly<Record<string, unknown>>;
  readonly status: 'draft' | 'approved' | 'in_production' | 'published' | 'expired' | 'cancelled';
  readonly evidence: readonly EvidenceRecord[];
  readonly createdAt: ISO8601;
}
