
// @primeopp-marketplace/listing-transformer
// Deterministic transformation from canonical listing to channel-specific payload.
import type { CanonicalListing, ChannelManifest } from '@primeopp-marketplace/contracts';

export interface TransformationResult {
  readonly channelId: string;
  readonly transformedPayload: Readonly<Record<string, unknown>>;
  readonly omittedFields: readonly string[];
  readonly modifiedFields: readonly string[];
  readonly unsupportedFields: readonly string[];
  readonly warnings: readonly string[];
  readonly requiredSellerActions: readonly string[];
  readonly confidence: number; // 0..1
  readonly evidence: Readonly<Record<string, unknown>>;
}

export function transformListing(listing: CanonicalListing, manifest: ChannelManifest): TransformationResult {
  const omitted: string[] = [];
  const modified: string[] = [];
  const unsupported: string[] = [];
  const warnings: string[] = [];
  const actions: string[] = [];

  // Title length
  let title = listing.title;
  const maxTitle = manifest.mediaRequirements.maxWidth >= 2000 ? 80 : 80;
  if (title.length > maxTitle) {
    title = title.slice(0, maxTitle);
    modified.push('title');
    warnings.push(`title truncated to ${maxTitle} chars`);
  }

  // Description
  let description = listing.description;
  if (description.length > 50000) {
    description = description.slice(0, 50000);
    modified.push('description');
    warnings.push('description truncated to 50000 chars');
  }

  // Bullet limits
  const bullets = listing.bulletPoints.slice(0, 10);
  if (listing.bulletPoints.length > 10) {
    modified.push('bulletPoints');
    warnings.push(`limited to 10 bullet points (had ${listing.bulletPoints.length})`);
  }

  // Image limits
  const images = listing.images.slice(0, manifest.mediaRequirements.maxImages);
  if (listing.images.length > manifest.mediaRequirements.maxImages) {
    modified.push('images');
    warnings.push(`limited to ${manifest.mediaRequirements.maxImages} images`);
  }

  // Video support
  if (listing.videoRefs && listing.videoRefs.length > 0 && !manifest.mediaRequirements.acceptsVideo) {
    omitted.push('videoRefs');
    unsupported.push('videoRefs');
    warnings.push('channel does not support video; videos omitted');
  }

  // Local pickup
  let localPickup = listing.shippingPolicy.localPickup;
  if (!manifest.shippingCapabilities.some(c => c.name === 'local_pickup' && c.supported)) {
    if (localPickup) {
      localPickup = false;
      modified.push('shippingPolicy.localPickup');
      warnings.push('local pickup not supported by channel; disabled');
      actions.push('Confirm shipping-only sale with buyer');
    }
  }

  // Identifier requirements
  const requiredIds = manifest.identifierRequirements.required;
  if (requiredIds.length > 0) {
    const haveKinds = new Set(listing.identifiers.map(i => i.kind));
    for (const req of requiredIds) {
      if (!haveKinds.has(req as 'UPC' | 'EAN' | 'ISBN' | 'GTIN' | 'MPN' | 'ASIN' | 'brand_sku')) {
        warnings.push(`channel requires ${req} identifier which is missing`);
        actions.push(`Add ${req} identifier before publishing`);
      }
    }
  }

  // Prohibited terms (simple substring check)
  const prohibitedTerms = manifest.termsRestrictions;
  const textBlob = (title + ' ' + description + ' ' + bullets.join(' ')).toLowerCase();
  for (const term of prohibitedTerms) {
    if (textBlob.includes(term.toLowerCase())) {
      warnings.push(`prohibited term detected: ${term}`);
      actions.push(`Remove prohibited term: ${term}`);
    }
  }

  // Condition mapping (channel-specific)
  const conditionMap: Record<string, string> = {
    new: 'NEW',
    new_other: 'NEW_OTHER',
    new_open_box: 'NEW_OPEN_BOX',
    manufacturer_refurbished: 'MANUFACTURER_REFURBISHED',
    seller_refurbished: 'SELLER_REFURBISHED',
    used_like_new: 'USED_LIKE_NEW',
    used_very_good: 'USED_VERY_GOOD',
    used_good: 'USED_GOOD',
    used_acceptable: 'USED_ACCEPTABLE',
    for_parts: 'FOR_PARTS',
    vintage: 'VINTAGE',
    collectible: 'COLLECTIBLE'
  };
  const channelCondition = conditionMap[listing.condition] ?? 'USED_GOOD';
  modified.push('condition');

  // Price format
  const price = {
    amount: listing.price.amount,
    currency: listing.price.currency
  };

  // Confidence: 1.0 if no warnings, else scaled down
  const confidence = Math.max(0, 1 - (warnings.length * 0.1));

  const payload: Record<string, unknown> = {
    title,
    description,
    bullets,
    images: images.map(i => i.url),
    condition: channelCondition,
    price,
    quantity: listing.quantity,
    handlingTimeDays: listing.shippingPolicy.handlingTimeDays,
    localPickup,
    freeShipping: listing.shippingPolicy.freeShipping,
    returnsAccepted: listing.returnPolicy.returnsAccepted,
    returnWindowDays: listing.returnPolicy.returnWindowDays,
    sku: listing.sellerSku
  };

  return {
    channelId: manifest.channelId,
    transformedPayload: payload,
    omittedFields: omitted,
    modifiedFields: modified,
    unsupportedFields: unsupported,
    warnings,
    requiredSellerActions: actions,
    confidence,
    evidence: {
      transformedAt: new Date().toISOString(),
      manifestVersion: manifest.version,
      originalListingId: listing.listingId
    }
  };
}

// Category mapping contracts
export interface CategoryMapping {
  readonly canonicalCategory: string;
  readonly marketplaceCategory: string;
  readonly requiredAttributes: readonly string[];
  readonly optionalAttributes: readonly string[];
  readonly prohibitedAttributes: readonly string[];
  readonly categoryConfidence: number; // 0..1
  readonly fallbackCategory?: string;
  readonly humanConfirmationRequired: boolean;
}

export const DEFAULT_CATEGORY_MAPPINGS: readonly CategoryMapping[] = [
  { canonicalCategory: 'sneakers', marketplaceCategory: 'sneakers', requiredAttributes: ['brand','size'], optionalAttributes: ['colorway','release_year'], prohibitedAttributes: [], categoryConfidence: 0.95, fallbackCategory: 'apparel', humanConfirmationRequired: false },
  { canonicalCategory: 'apparel', marketplaceCategory: 'clothing', requiredAttributes: ['brand','size'], optionalAttributes: ['color','material'], prohibitedAttributes: [], categoryConfidence: 0.9, fallbackCategory: 'general', humanConfirmationRequired: false },
  { canonicalCategory: 'electronics', marketplaceCategory: 'electronics', requiredAttributes: ['brand'], optionalAttributes: ['model','warranty'], prohibitedAttributes: [], categoryConfidence: 0.9, fallbackCategory: 'general', humanConfirmationRequired: false },
  { canonicalCategory: 'books', marketplaceCategory: 'books', requiredAttributes: ['isbn'], optionalAttributes: ['author','edition'], prohibitedAttributes: [], categoryConfidence: 0.95, fallbackCategory: 'general', humanConfirmationRequired: false },
  { canonicalCategory: 'collectibles', marketplaceCategory: 'collectibles', requiredAttributes: [], optionalAttributes: ['era','origin'], prohibitedAttributes: [], categoryConfidence: 0.8, fallbackCategory: 'general', humanConfirmationRequired: true },
  { canonicalCategory: 'video_games', marketplaceCategory: 'video_games', requiredAttributes: ['platform'], optionalAttributes: ['rating','publisher'], prohibitedAttributes: [], categoryConfidence: 0.92, fallbackCategory: 'electronics', humanConfirmationRequired: false }
];

export function findCategoryMapping(canonical: string): CategoryMapping | undefined {
  return DEFAULT_CATEGORY_MAPPINGS.find(m => m.canonicalCategory === canonical);
}

