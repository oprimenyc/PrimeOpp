// Canonical Listing model — one source of truth distributed to many channels.
import type {
  Identifier, TenantId, ISO8601, Money, EvidenceRecord
} from './common.js';
import type { ProductCondition } from './product.js';
import type { InventoryRecord } from './inventory.js';

export type ListingState =
  | 'DRAFT'
  | 'INCOMPLETE'
  | 'READY'
  | 'NEEDS_REVIEW'
  | 'APPROVAL_REQUIRED'
  | 'APPROVED'
  | 'PUBLISHING'
  | 'PARTIALLY_PUBLISHED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'SOLD'
  | 'PARTIALLY_SOLD'
  | 'ENDED'
  | 'EXPIRED'
  | 'ERROR'
  | 'NEEDS_ATTENTION'
  | 'ARCHIVED';

export interface ListingImage {
  readonly imageId: Identifier;
  readonly url: string;
  readonly alt?: string;
  readonly kind?: 'main' | 'extra' | 'defect' | 'authenticity';
}

export interface ListingIdentifier {
  readonly kind: 'UPC' | 'EAN' | 'ISBN' | 'GTIN' | 'MPN' | 'ASIN' | 'brand_sku';
  readonly value: string;
}

export interface ListingAttribute {
  readonly namespace: string;
  readonly name: string;
  readonly value: string;
  readonly unit?: string;
}

export interface ListingVariant {
  readonly variantId: Identifier;
  readonly name: string;
  readonly value: string;
  readonly sku?: string;
  readonly quantity?: number;
}

export interface ListingShippingPolicy {
  readonly shippingPolicyId: Identifier;
  readonly handlingTimeDays: number;
  readonly localPickup: boolean;
  readonly domesticRate?: Money;
  readonly internationalRate?: Money;
  readonly freeShipping: boolean;
  readonly carrierServices?: readonly string[];
}

export interface ListingReturnPolicy {
  readonly returnPolicyId: Identifier;
  readonly returnsAccepted: boolean;
  readonly returnWindowDays: number;
  readonly restockingFeePercent: number;
  readonly returnShippingPaidBy: 'buyer' | 'seller';
}

export interface ListingSEO {
  readonly title?: string;
  readonly subtitle?: string;
  readonly description?: string;
  readonly keywords: readonly string[];
  readonly searchTags: readonly string[];
  readonly structuredData?: Readonly<Record<string, unknown>>;
}

export interface ListingAuthenticity {
  readonly verifiedAuthentic: boolean;
  readonly verificationMethod?: 'third_party' | 'seller_attestation' | 'receipt' | 'platform_review';
  readonly certificateUrl?: string;
  readonly disclosures?: readonly string[];
}

export interface ListingSellerDisclosure {
  readonly kind: 'defect' | 'modification' | 'history' | 'provenance' | 'warranty' | 'other';
  readonly description: string;
}

export interface ListingDestinationSelection {
  readonly channelId: string;
  readonly enabled: boolean;
  readonly explicitlySelected: boolean; // true if seller explicitly toggled it
  readonly primeOppMarketplace: boolean; // true when channelId === 'primeopp-marketplace'
  readonly feeEstimateRef?: Identifier;
  readonly selectedAt: ISO8601;
  readonly selectionEvidenceId?: Identifier;
}

export interface ListingChannelOverride {
  readonly channelId: string;
  readonly title?: string;
  readonly description?: string;
  readonly price?: Money;
  readonly quantity?: number;
  readonly handlingTimeDays?: number;
  readonly shippingPolicyId?: Identifier;
  readonly returnPolicyId?: Identifier;
}

export interface ListingApproval {
  readonly approvalId: Identifier;
  readonly listingId: Identifier;
  readonly reviewer: Identifier;
  readonly decision: 'approved' | 'rejected' | 'needs_changes';
  readonly reason?: string;
  readonly at: ISO8601;
}

export interface ListingLifecycleEntry {
  readonly state: ListingState;
  readonly at: ISO8601;
  readonly reason?: string;
  readonly actor?: Identifier;
}

export interface CanonicalListing {
  readonly listingId: Identifier;
  readonly tenantId: TenantId;
  readonly organizationId: Identifier;
  readonly sellerId: Identifier;
  readonly productId: Identifier;
  readonly inventoryId: Identifier;
  readonly title: string;
  readonly subtitle?: string;
  readonly description: string;
  readonly bulletPoints: readonly string[];
  readonly condition: ProductCondition;
  readonly conditionNotes?: string;
  readonly category?: string;
  readonly attributes: readonly ListingAttribute[];
  readonly identifiers: readonly ListingIdentifier[];
  readonly images: readonly ListingImage[];
  readonly videoRefs?: readonly string[];
  readonly variants?: readonly ListingVariant[];
  readonly price: Money;
  readonly minimumOffer?: Money;
  readonly quantity: number;
  readonly sellerSku?: string;
  readonly locationId?: Identifier;
  readonly shippingPolicy: ListingShippingPolicy;
  readonly returnPolicy: ListingReturnPolicy;
  readonly authenticity: ListingAuthenticity;
  readonly sellerDisclosures: readonly ListingSellerDisclosure[];
  readonly taxClassificationRef?: Identifier;
  readonly seo: ListingSEO;
  readonly destinations: readonly ListingDestinationSelection[];
  readonly channelOverrides: readonly ListingChannelOverride[];
  readonly approvals: readonly ListingApproval[];
  readonly lifecycle: readonly ListingLifecycleEntry[];
  readonly currentState: ListingState;
  readonly createdAt: ISO8601;
  readonly updatedAt: ISO8601;
}

export interface ListingPublicationReceipt {
  readonly receiptId: Identifier;
  readonly listingId: Identifier;
  readonly tenantId: TenantId;
  readonly destinations: ReadonlyArray<{
    readonly channelId: string;
    readonly outcome: 'published' | 'failed' | 'skipped' | 'pending_approval' | 'human_assisted' | 'browser_assisted';
    readonly channelListingId?: string;
    readonly error?: string;
    readonly publishedAt?: ISO8601;
    readonly evidenceId?: Identifier;
  }>;
  readonly finalState: ListingState;
  readonly evidenceId: Identifier;
  readonly createdAt: ISO8601;
}

export interface ListingEvidence {
  readonly evidence: EvidenceRecord;
  readonly listingId: Identifier;
}

export interface ListingValidationIssue {
  readonly field: string;
  readonly code: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export interface ListingValidationResult {
  readonly listingId: Identifier;
  readonly valid: boolean;
  readonly issues: readonly ListingValidationIssue[];
  readonly checkedAt: ISO8601;
}

export type ListingValidationContext =
  | 'create'
  | 'publish'
  | 'update'
  | 'channel_specific';

export interface ChannelListingMapping {
  readonly channelListingId: string;
  readonly channelId: string;
  readonly canonicalListingId: Identifier;
  readonly tenantId: TenantId;
  readonly channelState: string;
  readonly lastSyncedAt: ISO8601;
  readonly externalUrl?: string;
}

export interface ListingInventoryReference {
  readonly listingId: Identifier;
  readonly inventory: InventoryRecord;
  readonly allocatedQuantity: number;
}
