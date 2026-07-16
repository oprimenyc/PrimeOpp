// Listing, channel, events, tenant, evidence contracts.
// Phases 17–24.

import type {
  Confidence,
  Identified,
  ISO8601,
  OperationResult,
  TenantId,
  TenantScoped,
  Timestamped,
} from './internal.ts';
import type { CanonicalCondition, ProductIdentifier, ProductVariant } from './product.ts';
import type { Money } from './internal.ts';

// ---------------------------------------------------------------------------
// Listing contracts (Phase 17)
// ---------------------------------------------------------------------------

export type ListingLifecycleState =
  | 'DRAFT'
  | 'READY'
  | 'APPROVAL_REQUIRED'
  | 'APPROVED'
  | 'PUBLISHING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'SOLD'
  | 'ENDED'
  | 'ERROR'
  | 'NEEDS_ATTENTION'
  | 'ARCHIVED';

export interface ListingPrice {
  amount: Money;
  minimumOffer?: Money;
  acceptOffers: boolean;
}

export interface ShippingPolicy {
  kind: 'FLAT' | 'CALCULATED' | 'FREE' | 'LOCAL_PICKUP' | 'FREIGHT' | 'CUSTOM';
  cost?: Money;
  handlingTimeBusinessDays?: number;
  localPickupOnly: boolean;
  internationalAllowed: boolean;
  returnAllowed: boolean;
  returnWindowDays?: number;
  restockingFeePercent?: number;
}

export interface CanonicalListing extends Identified, Timestamped, TenantScoped {
  productId: string;
  variantId?: string;
  title: string;
  subtitle?: string;
  description?: string;
  bullets: string[];
  category?: string;
  attributes: Record<string, string>;
  condition: CanonicalCondition;
  conditionNotes?: string;
  images: string[]; // evidence refs
  videoRefs: string[];
  price: ListingPrice;
  quantity: number;
  sku?: string;
  locationId?: string;
  shippingPolicy: ShippingPolicy;
  tags: string[];
  seoKeywords: string[];
  authenticityData?: {
    authenticatorRef?: string;
    certificateRef?: string;
    status: 'AUTHENTIC' | 'SUSPECT' | 'COUNTERFEIT' | 'UNVERIFIED';
  };
  productIdentifiers: ProductIdentifier[];
  sellerDisclosures: string[];
  /** Per-channel overrides; channelRef -> overrides. */
  channelOverrides: Record<string, Record<string, unknown>>;
  /** Selected destinations for this listing. */
  selectedChannels: string[];
  /** Whether PrimeOpp Marketplace is included by default. */
  alsoListOnPrimeOppMarketplace: boolean;
  /** Seller acceptance evidence of the selected destinations. */
  sellerAcceptanceEvidenceRef?: string;
  state: ListingLifecycleState;
  /** Per-channel current state. */
  channelStates: Record<string, ListingLifecycleState>;
  /** Version for optimistic concurrency. */
  version: number;
}

// ---------------------------------------------------------------------------
// Channel contracts (Phase 18)
// ---------------------------------------------------------------------------

export type ChannelCapability =
  | 'PUBLISH_LISTING'
  | 'UPDATE_LISTING'
  | 'PAUSE_LISTING'
  | 'END_LISTING'
  | 'MARK_SOLD'
  | 'SYNC_INVENTORY'
  | 'SYNC_PRICE'
  | 'RECEIVE_OFFER'
  | 'RESPOND_TO_OFFER'
  | 'RECEIVE_ORDER'
  | 'RECEIVE_RETURN'
  | 'RETRIEVE_LISTING_STATUS'
  | 'RETRIEVE_ERRORS'
  | 'RETRIEVE_FEES'
  | 'RETRIEVE_CATEGORY_REQUIREMENTS';

export interface ChannelCapabilityManifest {
  channelRef: string;
  capabilities: ChannelCapability[];
  /** Marketplace-specific condition labels mapped to canonical conditions. */
  conditionMappings: Record<CanonicalCondition, string>;
  /** Per-category required attributes. */
  categoryRequirements: Record<string, string[]>;
  /** True if this is a test-only adapter (must be clearly labeled). */
  testOnly: boolean;
  /** Effective fee schedule reference. */
  feeScheduleRef?: string;
}

export interface ChannelPublishRequest {
  listing: CanonicalListing;
  scope: TenantScoped;
  /** True if user explicitly accepted publication to this channel. */
  userAccepted: boolean;
  acceptanceEvidenceRef?: string;
}

export interface ChannelPublishResult {
  channelRef: string;
  success: boolean;
  externalListingId?: string;
  warnings: string[];
  errors: string[];
  publishedAt?: ISO8601;
}

export interface ChannelSyncInventoryRequest {
  channelRef: string;
  externalListingId: string;
  quantityDelta: number;
  scope: TenantScoped;
}

export interface ChannelSyncResult {
  channelRef: string;
  success: boolean;
  syncedAt: ISO8601;
  warnings: string[];
  errors: string[];
}

export interface MarketplaceChannelAdapter {
  readonly adapterId: string;
  readonly version: string;
  readonly channelRef: string;
  readonly testOnly: boolean;
  readonly capabilities: ChannelCapability[];
  getCapabilityManifest(): ChannelCapabilityManifest;
  publishListing(request: ChannelPublishRequest): Promise<ChannelPublishResult>;
  updateListing?(request: ChannelPublishRequest): Promise<ChannelPublishResult>;
  pauseListing?(externalListingId: string, scope: TenantScoped): Promise<ChannelSyncResult>;
  endListing?(externalListingId: string, scope: TenantScoped): Promise<ChannelSyncResult>;
  markSold?(externalListingId: string, qty: number, scope: TenantScoped): Promise<ChannelSyncResult>;
  syncInventory?(request: ChannelSyncInventoryRequest): Promise<ChannelSyncResult>;
  syncPrice?(externalListingId: string, price: Money, scope: TenantScoped): Promise<ChannelSyncResult>;
}

// ---------------------------------------------------------------------------
// Commerce events (Phase 20)
// ---------------------------------------------------------------------------

export type CommerceEventType =
  | 'product.scanned'
  | 'product.resolution.started'
  | 'product.resolution.completed'
  | 'product.resolution.failed'
  | 'product.created'
  | 'product.updated'
  | 'product.merged'
  | 'product.split'
  | 'condition.assessed'
  | 'price.observed'
  | 'pricing.calculated'
  | 'opportunity.scored'
  | 'inventory.created'
  | 'inventory.adjusted'
  | 'inventory.reserved'
  | 'inventory.released'
  | 'inventory.sold'
  | 'inventory.transferred'
  | 'listing.created'
  | 'listing.approved'
  | 'listing.publish.requested'
  | 'listing.channel.updated'
  | 'listing.sold'
  | 'profit.calculated'
  | 'evidence.recorded';

export type EventSensitivity = 'PUBLIC' | 'TENANT' | 'ORGANIZATION' | 'SELLER_PRIVATE' | 'COST_BASIS' | 'SECRET';

export interface CommerceEvent<T = unknown> {
  eventId: string;
  schemaVersion: string;
  tenantId: TenantId;
  organizationId?: string;
  correlationId: string;
  timestamp: ISO8601;
  source: string;
  subject: string;
  type: CommerceEventType;
  payload: T;
  evidenceRefs: string[];
  sensitivity: EventSensitivity;
}

export interface CommerceEventSink {
  emit<T>(event: CommerceEvent<T>): Promise<void>;
}

// ---------------------------------------------------------------------------
// Tenant & enterprise (Phase 21)
// ---------------------------------------------------------------------------

export interface Organization extends Identified, Timestamped {
  tenantId: TenantId;
  name: string;
  businessUnits: string[];
  defaultAlsoListOnPrimeOppMarketplace: boolean;
  defaultApprovalThresholds?: Record<string, number>;
}

export interface SellerAccount extends Identified, Timestamped, TenantScoped {
  organizationId?: string;
  name: string;
  teamIds: string[];
  role: string;
  locationIds: string[];
}

export interface Location extends Identified, Timestamped, TenantScoped {
  organizationId?: string;
  label: string;
  kind: 'WAREHOUSE' | 'STORE' | 'VEHICLE' | 'BIN' | 'VIRTUAL' | 'CONSIGNMENT' | 'DONOR';
  address?: string;
}

export interface Role extends Identified {
  tenantId: TenantId;
  name: string;
  permissions: string[];
}

export interface Team extends Identified, Timestamped, TenantScoped {
  organizationId?: string;
  name: string;
  memberUserIds: string[];
}

// ---------------------------------------------------------------------------
// Evidence (Phase 22 / 23)
// ---------------------------------------------------------------------------

export interface EvidenceRecord extends Identified, Timestamped {
  tenantId: TenantId;
  organizationId?: string;
  kind: 'SCAN' | 'OCR' | 'IMAGE' | 'PRICE_OBSERVATION' | 'CONDITION_ASSESSMENT' | 'SELLER_ACCEPTANCE' | 'AUDIT' | 'OTHER';
  /** Content hash for integrity verification. */
  contentHash: string;
  /** Reference to actual content (file path, blob ref, etc.). */
  contentRef: string;
  /** Optional content-type. */
  contentType?: string;
  description?: string;
  /** Sensitivity classification. */
  sensitivity: EventSensitivity;
  /** Reference to the operation that produced this evidence. */
  correlationId?: string;
}

// ---------------------------------------------------------------------------
// Adapter SDK (Phase 24)
// ---------------------------------------------------------------------------

export interface AdapterManifest {
  adapterId: string;
  version: string;
  capabilities: string[];
  authenticationRequirements: 'NONE' | 'API_KEY' | 'OAUTH' | 'SECRET_REF';
  rateLimitMetadata?: { requestsPerMinute?: number; requestsPerDay?: number };
  costMetadata?: { perCall?: number; currency?: string };
  supportedRegions?: string[];
  supportedCategories?: string[];
  freshness?: { maxAgeSeconds: number };
  confidenceModel?: string;
  retrySemantics?: { maxRetries: number; backoffMs: number };
  dataSensitivity?: EventSensitivity;
  termsRestrictions?: string[];
}

export interface AdapterHealthCheckResult {
  healthy: boolean;
  checkedAt: ISO8601;
  details?: Record<string, unknown>;
}
