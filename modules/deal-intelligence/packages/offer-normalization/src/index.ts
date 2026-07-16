/**
 * @primeopp-deal-intelligence/offer-normalization
 *
 * Normalizes raw offer observations into a RetailOffer. Distinguishes
 * base, sale, member, coupon, rebate, gift-card and shipping prices.
 */
import type {
  RetailOffer, OfferPrice, OfferAvailability, OfferFulfillment,
  OfferRestriction, OfferConfidence, OfferSource, OfferExpiration,
  Money, OfferId, RetailerId, ProductId, Evidence, ISO8601,
  AvailabilityState, RetailerSourceMethod
} from '@primeopp-deal-intelligence/contracts';
import { nextId, nowIso } from '@primeopp-deal-intelligence/contracts';

export interface NormalizeOfferInput {
  retailerId: RetailerId;
  productId: ProductId;
  prices?: Partial<OfferPrice>;
  availability?: Partial<OfferAvailability>;
  promotions?: RetailOffer['promotions'];
  coupons?: RetailOffer['coupons'];
  rebates?: RetailOffer['rebates'];
  fulfillment?: Partial<OfferFulfillment>;
  restrictions?: Partial<OfferRestriction>;
  expiration?: OfferExpiration;
  source: {
    sourceMethod: RetailerSourceMethod;
    sourceUrl?: string;
    observedAt?: ISO8601;
    extractionMethod: string;
    precedence: number;
  };
  evidence?: Evidence[];
}

export function normalizeOffer(input: NormalizeOfferInput): RetailOffer {
  if (!input.retailerId) throw new Error('normalizeOffer: retailerId required');
  if (!input.productId) throw new Error('normalizeOffer: productId required');

  const observedAt = input.source.observedAt ?? nowIso();

  const availability: OfferAvailability = {
    state: input.availability?.state ?? 'UNKNOWN',
    confidence: input.availability?.confidence ?? 0.5,
    lastCheckedAt: input.availability?.lastCheckedAt ?? observedAt,
    source: input.availability?.source ?? input.source.extractionMethod,
    regions: input.availability?.regions,
    zipCodes: input.availability?.zipCodes,
    stores: input.availability?.stores,
    quantityEstimate: input.availability?.quantityEstimate,
    staleAfter: input.availability?.staleAfter
  };

  const fulfillment: OfferFulfillment = {
    shippingAvailable: input.fulfillment?.shippingAvailable ?? false,
    pickupAvailable: input.fulfillment?.pickupAvailable ?? false,
    deliveryAvailable: input.fulfillment?.deliveryAvailable ?? false,
    digitalAvailable: input.fulfillment?.digitalAvailable ?? false,
    shippingCost: input.fulfillment?.shippingCost,
    freeShippingThreshold: input.fulfillment?.freeShippingThreshold,
    regions: input.fulfillment?.regions
  };

  const restrictions: OfferRestriction = {
    accountRequired: input.restrictions?.accountRequired ?? false,
    membershipRequired: input.restrictions?.membershipRequired ?? false,
    paymentMethodRequired: input.restrictions?.paymentMethodRequired,
    subscriptionRequired: input.restrictions?.subscriptionRequired ?? false,
    onlineOnly: input.restrictions?.onlineOnly ?? false,
    storeOnly: input.restrictions?.storeOnly ?? false,
    region: input.restrictions?.region,
    minQuantity: input.restrictions?.minQuantity,
    maxQuantity: input.restrictions?.maxQuantity
  };

  // Conservative overall confidence: minimum of sub-confidences, or 0.5 by default.
  const defaultConf = 0.5;
  const confidence: OfferConfidence = {
    price: 0.7,
    availability: availability.confidence,
    promotion: input.promotions?.length ? 0.6 : 1.0,
    coupon: input.coupons?.length ? 0.6 : 1.0,
    overall: Math.min(0.95, Math.max(0.7, availability.confidence))
  };

  const offerSource: OfferSource = {
    sourceMethod: input.source.sourceMethod,
    sourceUrl: input.source.sourceUrl,
    observedAt,
    extractionMethod: input.source.extractionMethod,
    precedence: input.source.precedence
  };

  return {
    id: nextId('offer') as OfferId,
    retailerId: input.retailerId,
    productId: input.productId,
    prices: input.prices ?? {},
    availability,
    promotions: input.promotions ?? [],
    coupons: input.coupons ?? [],
    rebates: input.rebates ?? [],
    fulfillment,
    restrictions,
    expiration: input.expiration ?? {},
    confidence,
    source: offerSource,
    evidence: input.evidence ?? [],
    observedAt
  };
}

/** Compute the effective price the consumer actually pays, before shipping/tax.
 *  Order of precedence: coupon > sale > member > base. */
export function effectivePrice(offer: RetailOffer): Money | undefined {
  const p = offer.prices;
  if (p.coupon) return p.coupon;
  if (p.sale) return p.sale;
  if (p.member) return p.member;
  if (p.base) return p.base;
  return undefined;
}

export function isAvailable(offer: RetailOffer): boolean {
  const available: AvailabilityState[] = ['IN_STOCK','LOW_STOCK','LIMITED','STORE_ONLY','ONLINE_ONLY','PICKUP_ONLY','DELIVERY_ONLY','PREORDER','BACKORDER','RESTOCK_EXPECTED'];
  return available.includes(offer.availability.state);
}

export function isStale(offer: RetailOffer, maxAgeMs: number, now: ISO8601 = nowIso()): boolean {
  const checkedAt = Date.parse(offer.availability.lastCheckedAt);
  const nowMs = Date.parse(now);
  return (nowMs - checkedAt) > maxAgeMs;
}
