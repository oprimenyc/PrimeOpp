// Listing contracts — Phase 17.
// Canonical listing model + PrimeOpp Marketplace default listing support.

import type {
  CanonicalListing,
  ListingLifecycleState,
  ShippingPolicy,
  TenantScoped,
} from '@primeopp/contracts';
import { hashString, nowUtc, uuid } from '@primeopp/contracts';

/**
 * Build a canonical listing with sane defaults.
 * `alsoListOnPrimeOppMarketplace` defaults to TRUE per Phase 19 (visible default).
 * The user MUST explicitly opt out via `disablePrimeOppMarketplace()`.
 */
export function createCanonicalListing(opts: {
  productId: string;
  title: string;
  tenantId: string;
  organizationId?: string;
  variantId?: string;
  price: CanonicalListing['price'];
  quantity: number;
  condition: CanonicalListing['condition'];
  selectedChannels: string[];
  shippingPolicy?: ShippingPolicy;
  description?: string;
  bullets?: string[];
  images?: string[];
  sku?: string;
  locationId?: string;
  attributes?: Record<string, string>;
  tags?: string[];
  seoKeywords?: string[];
  sellerDisclosures?: string[];
  productIdentifiers?: CanonicalListing['productIdentifiers'];
  channelOverrides?: Record<string, Record<string, unknown>>;
  /** Whether PrimeOpp Marketplace is also listed (default true). */
  alsoListOnPrimeOppMarketplace?: boolean;
}): CanonicalListing {
  const now = nowUtc();
  const alsoList = opts.alsoListOnPrimeOppMarketplace ?? true;

  const selectedChannels = opts.selectedChannels.slice();
  if (alsoList && !selectedChannels.includes('primeopp-marketplace')) {
    selectedChannels.push('primeopp-marketplace');
  }

  return {
    id: uuid(),
    tenantId: opts.tenantId,
    ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
    productId: opts.productId,
    ...(opts.variantId ? { variantId: opts.variantId } : {}),
    title: opts.title,
    ...(opts.description ? { description: opts.description } : {}),
    bullets: opts.bullets ?? [],
    attributes: opts.attributes ?? {},
    condition: opts.condition,
    images: opts.images ?? [],
    videoRefs: [],
    price: opts.price,
    quantity: opts.quantity,
    ...(opts.sku ? { sku: opts.sku } : {}),
    ...(opts.locationId ? { locationId: opts.locationId } : {}),
    shippingPolicy: opts.shippingPolicy ?? defaultShippingPolicy(),
    tags: opts.tags ?? [],
    seoKeywords: opts.seoKeywords ?? [],
    productIdentifiers: opts.productIdentifiers ?? [],
    sellerDisclosures: opts.sellerDisclosures ?? [],
    channelOverrides: opts.channelOverrides ?? {},
    selectedChannels,
    alsoListOnPrimeOppMarketplace: alsoList,
    state: 'DRAFT',
    channelStates: {},
    version: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function defaultShippingPolicy(): ShippingPolicy {
  return {
    kind: 'CALCULATED',
    handlingTimeBusinessDays: 1,
    localPickupOnly: false,
    internationalAllowed: false,
    returnAllowed: true,
    returnWindowDays: 30,
  };
}

/**
 * Opt the listing OUT of the PrimeOpp Marketplace.
 * Records the user's explicit decision and produces evidence.
 * Returns a new listing object + an evidence record reference.
 */
export function disablePrimeOppMarketplace(listing: CanonicalListing, opts: { reason?: string; userRef: string }): { listing: CanonicalListing; evidenceRef: string } {
  const evidenceRef = `evidence/seller-acceptance/${uuid()}`;
  return {
    listing: {
      ...listing,
      alsoListOnPrimeOppMarketplace: false,
      selectedChannels: listing.selectedChannels.filter((c) => c !== 'primeopp-marketplace'),
      sellerAcceptanceEvidenceRef: evidenceRef,
      updatedAt: nowUtc(),
    },
    evidenceRef,
  };
}

/**
 * Explicitly accept the selected channels and produce evidence of acceptance.
 * This MUST be called before publication.
 */
export function acceptSelectedChannels(listing: CanonicalListing, opts: { userRef: string; note?: string }): { listing: CanonicalListing; evidenceRef: string } {
  const evidenceRef = `evidence/seller-acceptance/${uuid()}`;
  return {
    listing: {
      ...listing,
      sellerAcceptanceEvidenceRef: evidenceRef,
      updatedAt: nowUtc(),
    },
    evidenceRef,
  };
}

/**
 * Transition a listing to a new lifecycle state.
 * Enforces valid transitions.
 */
export function transitionListingState(listing: CanonicalListing, newState: ListingLifecycleState): CanonicalListing {
  const valid: Record<ListingLifecycleState, ListingLifecycleState[]> = {
    DRAFT: ['READY', 'ARCHIVED'],
    READY: ['APPROVAL_REQUIRED', 'APPROVED', 'DRAFT'],
    APPROVAL_REQUIRED: ['APPROVED', 'DRAFT'],
    APPROVED: ['PUBLISHING'],
    PUBLISHING: ['ACTIVE', 'ERROR', 'NEEDS_ATTENTION'],
    ACTIVE: ['PAUSED', 'SOLD', 'ENDED', 'NEEDS_ATTENTION'],
    PAUSED: ['ACTIVE', 'ENDED'],
    SOLD: ['ENDED', 'ARCHIVED'],
    ENDED: ['ARCHIVED'],
    ERROR: ['DRAFT', 'READY'],
    NEEDS_ATTENTION: ['ACTIVE', 'PAUSED', 'ENDED'],
    ARCHIVED: [],
  };
  if (!valid[listing.state].includes(newState)) {
    throw new Error(`INVALID_TRANSITION: ${listing.state} → ${newState}`);
  }
  return { ...listing, state: newState, updatedAt: nowUtc(), version: listing.version + 1 };
}

/**
 * Validate a listing before publication.
 */
export function validateListingForPublication(listing: CanonicalListing): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!listing.title || listing.title.length === 0) errors.push('title required');
  if (listing.title.length > 80) warnings.push('title longer than 80 chars may be truncated by some channels');
  if (listing.quantity < 0) errors.push('quantity cannot be negative');
  if (listing.price.amount.amount <= 0) errors.push('price must be positive');
  if (listing.images.length === 0) warnings.push('no images — many channels require at least one image');
  if (listing.selectedChannels.length === 0) errors.push('at least one channel must be selected');
  if (listing.sellerAcceptanceEvidenceRef === undefined) errors.push('seller acceptance evidence required before publication');

  // PrimeOpp Marketplace default check.
  if (listing.alsoListOnPrimeOppMarketplace && !listing.selectedChannels.includes('primeopp-marketplace')) {
    errors.push('alsoListOnPrimeOppMarketplace=true but primeopp-marketplace missing from selectedChannels');
  }
  if (!listing.alsoListOnPrimeOppMarketplace && listing.selectedChannels.includes('primeopp-marketplace')) {
    warnings.push('primeopp-marketplace in selectedChannels but alsoListOnPrimeOppMarketplace=false — inconsistent');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Listing preview showing all selected channels and their disclosure.
 */
export function listingPreview(listing: CanonicalListing): string {
  const lines: string[] = [];
  lines.push(`Listing: ${listing.title}`);
  lines.push(`  Price: ${listing.price.amount.amount} ${listing.price.amount.currency}`);
  lines.push(`  Condition: ${listing.condition}`);
  lines.push(`  Quantity: ${listing.quantity}`);
  lines.push(`  Selected channels:`);
  for (const c of listing.selectedChannels) {
    const marker = c === 'primeopp-marketplace' ? (listing.alsoListOnPrimeOppMarketplace ? ' (PrimeOpp default ON)' : ' (PrimeOpp default OFF)') : '';
    lines.push(`    - ${c}${marker}`);
  }
  if (listing.sellerAcceptanceEvidenceRef) {
    lines.push(`  Seller acceptance: ${listing.sellerAcceptanceEvidenceRef}`);
  } else {
    lines.push(`  Seller acceptance: PENDING`);
  }
  return lines.join('\n');
}
