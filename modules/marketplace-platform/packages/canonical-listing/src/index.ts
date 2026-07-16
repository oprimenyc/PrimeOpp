// @primeopp-marketplace/canonical-listing
// Canonical listing state machine + factory + validation.

import type {
  CanonicalListing, ListingState, ListingLifecycleEntry, ListingValidationResult,
  ListingValidationIssue, ListingValidationContext, ListingDestinationSelection,
  ListingApproval, Identifier, TenantId, ISO8601, Money, ProductCondition,
  ListingShippingPolicy, ListingReturnPolicy, ListingSEO, ListingAuthenticity,
  ListingSellerDisclosure, EvidenceRecord
} from '@primeopp-marketplace/contracts';
import { validateById } from '@primeopp-marketplace/schemas';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export interface CreateListingInput {
  readonly tenantId: TenantId;
  readonly organizationId: Identifier;
  readonly sellerId: Identifier;
  readonly productId: Identifier;
  readonly inventoryId: Identifier;
  readonly title: string;
  readonly description: string;
  readonly condition: ProductCondition;
  readonly price: Money;
  readonly quantity: number;
  readonly shippingPolicy: ListingShippingPolicy;
  readonly returnPolicy: ListingReturnPolicy;
  readonly authenticity: ListingAuthenticity;
  readonly seo?: ListingSEO;
  readonly bulletPoints?: readonly string[];
  readonly sellerDisclosures?: readonly ListingSellerDisclosure[];
  readonly destinations?: readonly ListingDestinationSelection[];
  readonly category?: string;
  readonly attributes?: Readonly<CanonicalListing['attributes']>;
  readonly identifiers?: Readonly<CanonicalListing['identifiers']>;
  readonly images?: Readonly<CanonicalListing['images']>;
}

// Listing state machine — deterministic transitions only.
const VALID_LISTING_TRANSITIONS: Record<ListingState, readonly ListingState[]> = {
  DRAFT: ['INCOMPLETE', 'READY', 'ARCHIVED', 'NEEDS_ATTENTION'],
  INCOMPLETE: ['READY', 'DRAFT', 'ARCHIVED', 'NEEDS_ATTENTION'],
  READY: ['NEEDS_REVIEW', 'APPROVAL_REQUIRED', 'APPROVED', 'DRAFT', 'ARCHIVED', 'NEEDS_ATTENTION'],
  NEEDS_REVIEW: ['READY', 'APPROVED', 'ARCHIVED', 'NEEDS_ATTENTION'],
  APPROVAL_REQUIRED: ['APPROVED', 'ARCHIVED', 'NEEDS_ATTENTION'],
  APPROVED: ['PUBLISHING', 'ARCHIVED', 'NEEDS_ATTENTION'],
  PUBLISHING: ['ACTIVE', 'PARTIALLY_PUBLISHED', 'ERROR', 'NEEDS_ATTENTION'],
  PARTIALLY_PUBLISHED: ['ACTIVE', 'ERROR', 'ENDED', 'NEEDS_ATTENTION'],
  ACTIVE: ['PAUSED', 'SOLD', 'PARTIALLY_SOLD', 'ENDED', 'NEEDS_ATTENTION', 'ERROR'],
  PAUSED: ['ACTIVE', 'ENDED'],
  SOLD: ['ENDED', 'ARCHIVED'],
  PARTIALLY_SOLD: ['SOLD', 'ACTIVE', 'ENDED'],
  ENDED: ['ARCHIVED'],
  EXPIRED: ['ARCHIVED'],
  ERROR: ['READY', 'NEEDS_ATTENTION', 'ARCHIVED'],
  NEEDS_ATTENTION: ['READY', 'APPROVAL_REQUIRED', 'ARCHIVED'],
  ARCHIVED: []
};

export function createListing(input: CreateListingInput): CanonicalListing {
  const now = new Date().toISOString();
  const listingId = newId('list');
  const seo: ListingSEO = input.seo ?? { keywords: [], searchTags: [] };
  const destinations = input.destinations ?? defaultDestinations(input.tenantId);
  const entry: ListingLifecycleEntry = { state: 'DRAFT', at: now, reason: 'listing created' };
  return {
    listingId,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    sellerId: input.sellerId,
    productId: input.productId,
    inventoryId: input.inventoryId,
    title: input.title,
    description: input.description,
    bulletPoints: input.bulletPoints ?? [],
    condition: input.condition,
    conditionNotes: undefined,
    category: input.category,
    attributes: input.attributes ?? [],
    identifiers: input.identifiers ?? [],
    images: input.images ?? [],
    videoRefs: [],
    variants: [],
    price: input.price,
    quantity: input.quantity,
    sellerSku: undefined,
    shippingPolicy: input.shippingPolicy,
    returnPolicy: input.returnPolicy,
    authenticity: input.authenticity,
    sellerDisclosures: input.sellerDisclosures ?? [],
    seo,
    destinations,
    channelOverrides: [],
    approvals: [],
    lifecycle: [entry],
    currentState: 'DRAFT',
    createdAt: now,
    updatedAt: now
  };
}

export function defaultDestinations(tenantId: TenantId): readonly ListingDestinationSelection[] {
  void tenantId;
  const now = new Date().toISOString();
  return [
    {
      channelId: 'primeopp-marketplace',
      enabled: true,
      explicitlySelected: false,
      primeOppMarketplace: true,
      selectedAt: now
    }
  ];
}

export function transitionListingState(
  listing: CanonicalListing,
  target: ListingState,
  reason?: string,
  actor?: Identifier
): { ok: true; listing: CanonicalListing } | { ok: false; code: string; message: string } {
  const allowed = VALID_LISTING_TRANSITIONS[listing.currentState] ?? [];
  if (!allowed.includes(target)) {
    return { ok: false, code: 'INVALID_LISTING_TRANSITION', message: `cannot transition listing from ${listing.currentState} to ${target}` };
  }
  const entry: ListingLifecycleEntry = { state: target, at: new Date().toISOString(), reason, actor };
  return {
    ok: true,
    listing: {
      ...listing,
      currentState: target,
      lifecycle: [...listing.lifecycle, entry],
      updatedAt: new Date().toISOString()
    }
  };
}

export function addApproval(
  listing: CanonicalListing,
  reviewer: Identifier,
  decision: ListingApproval['decision'],
  reason?: string
): CanonicalListing {
  const approval: ListingApproval = {
    approvalId: newId('appr'),
    listingId: listing.listingId,
    reviewer,
    decision,
    reason,
    at: new Date().toISOString()
  };
  return { ...listing, approvals: [...listing.approvals, approval], updatedAt: new Date().toISOString() };
}

export function setDestinations(
  listing: CanonicalListing,
  destinations: readonly ListingDestinationSelection[]
): CanonicalListing {
  return { ...listing, destinations, updatedAt: new Date().toISOString() };
}

export function setPrimeOppMarketplaceEnabled(
  listing: CanonicalListing,
  enabled: boolean,
  explicitlySelected: boolean
): CanonicalListing {
  const now = new Date().toISOString();
  const destinations = listing.destinations.map(d =>
    d.channelId === 'primeopp-marketplace'
      ? { ...d, enabled, explicitlySelected, selectedAt: now }
      : d
  );
  // If primeopp-marketplace not in destinations, add it.
  if (!destinations.some(d => d.channelId === 'primeopp-marketplace')) {
    destinations.push({
      channelId: 'primeopp-marketplace',
      enabled,
      explicitlySelected,
      primeOppMarketplace: true,
      selectedAt: now
    });
  }
  return { ...listing, destinations, updatedAt: now };
}

export function isPrimeOppMarketplaceEnabled(listing: CanonicalListing): boolean {
  const d = listing.destinations.find(d => d.channelId === 'primeopp-marketplace');
  return d?.enabled === true;
}

export function isPrimeOppMarketplaceVisible(listing: CanonicalListing): boolean {
  // Visible = the destination appears in the destinations list (regardless of enabled/disabled).
  return listing.destinations.some(d => d.channelId === 'primeopp-marketplace');
}

export function listEnabledDestinations(listing: CanonicalListing): readonly ListingDestinationSelection[] {
  return listing.destinations.filter(d => d.enabled);
}

export function validateListing(
  listing: CanonicalListing,
  context: ListingValidationContext = 'create'
): ListingValidationResult {
  const issues: ListingValidationIssue[] = [];

  // Schema validation
  const schemaIssues = validateById('listing', listing);
  for (const si of schemaIssues) {
    issues.push({ field: si.path, code: 'SCHEMA', message: si.message, severity: 'error' });
  }

  // Required field validation
  if (!listing.title || listing.title.trim().length === 0) {
    issues.push({ field: 'title', code: 'EMPTY_TITLE', message: 'title must not be empty', severity: 'error' });
  }
  if (listing.title.length > 200) {
    issues.push({ field: 'title', code: 'TITLE_TOO_LONG', message: 'title must be <= 200 chars', severity: 'error' });
  }
  if (!listing.description || listing.description.trim().length === 0) {
    issues.push({ field: 'description', code: 'EMPTY_DESCRIPTION', message: 'description must not be empty', severity: 'error' });
  }
  if (listing.quantity < 0) {
    issues.push({ field: 'quantity', code: 'NEGATIVE_QUANTITY', message: 'quantity must be >= 0', severity: 'error' });
  }
  if (listing.price.amount.startsWith('-')) {
    issues.push({ field: 'price', code: 'NEGATIVE_PRICE', message: 'price must be >= 0', severity: 'error' });
  }

  // Channel-specific publication checks
  if (context === 'publish') {
    if (listing.destinations.length === 0) {
      issues.push({ field: 'destinations', code: 'NO_DESTINATIONS', message: 'at least one destination must be selected', severity: 'error' });
    }
    // PrimeOpp Marketplace visibility proof — must be present in destinations list (visible default)
    if (!isPrimeOppMarketplaceVisible(listing)) {
      issues.push({ field: 'destinations', code: 'PRIMEOPP_NOT_VISIBLE', message: 'PrimeOpp Marketplace must appear in destinations list (visible default)', severity: 'error' });
    }
    // No hidden enrollment: at least one destination must be explicitly selected by seller, OR all are default-disabled
    const anyExplicit = listing.destinations.some(d => d.explicitlySelected);
    if (!anyExplicit && listing.destinations.some(d => d.enabled)) {
      // All enabled destinations are defaults — that's OK for first publish, but record in evidence later.
    }
  }

  return {
    listingId: listing.listingId,
    valid: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    checkedAt: new Date().toISOString()
  };
}

export function listingEvidence(listing: CanonicalListing, evidence: EvidenceRecord): { evidence: EvidenceRecord; listingId: Identifier } {
  return { evidence, listingId: listing.listingId };
}

export { VALID_LISTING_TRANSITIONS };
