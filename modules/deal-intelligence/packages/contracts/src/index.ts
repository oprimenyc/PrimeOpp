/**
 * @primeopp-deal-intelligence/contracts
 *
 * Canonical TypeScript types and interfaces for the entire PrimeOpp Deal
 * Intelligence Platform. All other packages depend on this package and
 * MUST NOT redefine these contracts.
 *
 * Design rules (VERIDIAN ecosystem):
 *  - Products consume reusable capabilities, never duplicate them.
 *  - Retailers and data providers are accessed only through adapters.
 *  - No silent failures; every fallback identifies itself and why.
 *  - Every job terminates in an explicit state.
 *  - Runtime evidence outweighs documentation claims.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** ISO-8601 UTC timestamp string. */
export type ISO8601 = string;

/** Opaque branded identifier. */
export type Identifier<T extends string> = string & { readonly __brand: T };

export type RetailerId = Identifier<'retailer'>;
export type ProductId = Identifier<'product'>;
export type OfferId = Identifier<'offer'>;
export type DealId = Identifier<'deal'>;
export type AlertId = Identifier<'alert'>;
export type TenantId = Identifier<'tenant'>;
export type SubmissionId = Identifier<'submission'>;
export type AmosJobId = Identifier<'amos-job'>;
export type EvidenceId = Identifier<'evidence'>;
export type AdapterId = Identifier<'adapter'>;
export type CampaignId = Identifier<'campaign'>;

/** Confidence in an observation or claim, 0..1 inclusive. */
export type Confidence = number;

/** Money in minor units (cents) with explicit currency. */
export interface Money {
  amountMinor: number;
  currency: string; // ISO 4217
}

// ---------------------------------------------------------------------------
// Regions, geography
// ---------------------------------------------------------------------------

export type RegionCode = string; // ISO 3166-1 alpha-2 or custom region tag

export interface Region {
  code: RegionCode;
  name: string;
  parent?: RegionCode;
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export type EvidenceKind =
  | 'screenshot'
  | 'dom-snapshot'
  | 'structured-json'
  | 'http-response'
  | 'api-payload'
  | 'manual-observation'
  | 'community-submission'
  | 'receipt'
  | 'photo'
  | 'computed';

export interface Evidence {
  id: EvidenceId;
  kind: EvidenceKind;
  capturedAt: ISO8601;
  /** Reference to evidence payload (URI or inline base64). Never embed PII. */
  payloadRef: string;
  /** Hash of the payload for tamper detection. */
  payloadHash?: string;
  redacted?: boolean;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Retailer model
// ---------------------------------------------------------------------------

export type RetailerType =
  | 'national-chain'
  | 'regional-chain'
  | 'local-store'
  | 'online-only'
  | 'wholesaler'
  | 'membership-club'
  | 'outlet'
  | 'liquidation'
  | 'manufacturer-store'
  | 'marketplace';

export type RetailerSourceMethod =
  | 'official-api'
  | 'retailer-feed'
  | 'affiliate-feed'
  | 'product-feed'
  | 'rss'
  | 'email-export'
  | 'structured-csv'
  | 'structured-json'
  | 'webhook'
  | 'public-product-page'
  | 'public-category-page'
  | 'search-result-page'
  | 'browser-operator'
  | 'community-submission'
  | 'manual-entry'
  | 'retailer-newsletter'
  | 'authorized-partner-feed';

export type RetailerAccessRestriction =
  | 'none'
  | 'login-required'
  | 'membership-required'
  | 'region-restricted'
  | 'geo-blocked'
  | 'rate-limited'
  | 'captcha-protected'
  | 'browser-required';

export interface RetailerAffiliateProgram {
  available: boolean;
  network?: string;
  programId?: string;
  /** Reference (not the credential itself). */
  credentialRef?: string;
  termsRef?: string;
}

export interface RetailerHealth {
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  lastCheckedAt: ISO8601;
  notes?: string;
}

export interface RetailerTermsReference {
  termsUrl?: string;
  robotsUrl?: string;
  /** Human legal review status. */
  legalReviewStatus: 'pending' | 'in-review' | 'approved' | 'rejected' | 'not-required';
  reviewedAt?: ISO8601;
  reviewer?: string;
}

export interface RetailerFulfillmentMethod {
  type: 'shipping' | 'pickup' | 'delivery' | 'digital';
  regions: RegionCode[];
  restrictions?: string[];
}

export interface RetailerAvailabilityMethod {
  type: 'api' | 'scrape' | 'store-locator' | 'manual' | 'none';
  granularity: 'national' | 'regional' | 'zip' | 'store';
}

export interface RetailerPromotionMethod {
  supportsCoupons: boolean;
  supportsAutomaticPromotions: boolean;
  supportsBOGO: boolean;
  supportsBuyMoreSaveMore: boolean;
  supportsMemberPricing: boolean;
  supportsGiftCardPromos: boolean;
  supportsRebates: boolean;
}

export interface RetailerRegion {
  code: RegionCode;
  fulfillmentMethods: RetailerFulfillmentMethod[];
  availabilityMethod: RetailerAvailabilityMethod;
}

export interface RetailerStore {
  storeId: string;
  retailerId: RetailerId;
  address?: string;
  region: RegionCode;
  zipCode?: string;
  geo?: { lat: number; lon: number };
}

export interface RetailerLocation {
  type: 'national' | 'regional' | 'store';
  regions: RegionCode[];
  stores?: RetailerStore[];
}

export interface RetailerDomain {
  domain: string;
  official: boolean;
  verifiedAt: ISO8601;
}

export interface RetailerBrand {
  brandId: string;
  name: string;
  parentRetailerId?: RetailerId;
}

export interface RetailerPolicy {
  priceMatch?: boolean;
  returnsDays?: number;
  membershipRequired?: boolean;
  paymentMethods?: string[];
  prohibitedCategories?: string[];
}

export interface RetailerEvidence {
  evidenceId: EvidenceId;
  capturedAt: ISO8601;
  summary: string;
}

export interface RetailerAdapter {
  adapterId: AdapterId;
  supportedSourceMethods: RetailerSourceMethod[];
  browserRequired: boolean;
  loginRequired: boolean;
  membershipRequired: boolean;
  rateLimit?: { requestsPerMinute: number };
}

export interface Retailer {
  id: RetailerId;
  name: string;
  type: RetailerType;
  regions: RegionCode[];
  domains: RetailerDomain[];
  sourceMethods: RetailerSourceMethod[];
  accessRestrictions: RetailerAccessRestriction[];
  affiliateProgram: RetailerAffiliateProgram;
  termsReference: RetailerTermsReference;
  permittedAutomationModes: string[];
  rateLimitMetadata?: { requestsPerMinute: number; burst?: number };
  robotsPolicyRef?: string;
  browserRequired: boolean;
  loginRequired: boolean;
  membershipRequired: boolean;
  evidenceFreshness: ISO8601;
  health: RetailerHealth;
  promotionMethod: RetailerPromotionMethod;
  availabilityMethod: RetailerAvailabilityMethod;
  fulfillmentMethods: RetailerFulfillmentMethod[];
  policy?: RetailerPolicy;
  evidence: RetailerEvidence[];
  adapter?: RetailerAdapter;
}

// ---------------------------------------------------------------------------
// Product identifiers and normalization
// ---------------------------------------------------------------------------

export type ProductIdentifierType =
  | 'UPC' | 'EAN' | 'GTIN' | 'ISBN' | 'ASIN' | 'SKU'
  | 'MPN' | 'RETAILER_PRODUCT_ID' | 'MODEL_NUMBER'
  | 'STYLE_CODE' | 'COLOR_CODE' | 'SIZE' | 'PACK_QTY'
  | 'URL' | 'CUSTOM';

export interface ProductIdentifier {
  type: ProductIdentifierType;
  value: string;
  source: string;
}

export type ProductCondition =
  | 'new' | 'used' | 'refurbished' | 'open-box' | 'damaged' | 'unknown';

export interface ProductVariant {
  size?: string;
  color?: string;
  storageCapacity?: string;
  edition?: string;
  packQuantity?: number;
  bundle?: boolean;
}

export interface ProductCandidate {
  id: ProductId;
  canonicalTitle: string;
  sourceTitle: string;
  brand?: string;
  modelNumber?: string;
  identifiers: ProductIdentifier[];
  variants: ProductVariant[];
  condition: ProductCondition;
  category?: string;
  confidence: Confidence;
  evidence: Evidence[];
  createdAt: ISO8601;
}

// ---------------------------------------------------------------------------
// Offer model
// ---------------------------------------------------------------------------

export type AvailabilityState =
  | 'IN_STOCK' | 'LOW_STOCK' | 'LIMITED'
  | 'STORE_ONLY' | 'ONLINE_ONLY' | 'PICKUP_ONLY' | 'DELIVERY_ONLY'
  | 'PREORDER' | 'BACKORDER' | 'RESTOCK_EXPECTED'
  | 'OUT_OF_STOCK' | 'DISCONTINUED'
  | 'UNKNOWN' | 'REQUIRES_LOGIN' | 'REQUIRES_MEMBERSHIP';

export interface OfferPrice {
  base?: Money;
  sale?: Money;
  member?: Money;
  coupon?: Money;
  rebate?: Money;
  giftCardValue?: Money;
  shipping?: Money;
  taxInclusive?: boolean;
}

export interface OfferAvailability {
  state: AvailabilityState;
  regions?: RegionCode[];
  zipCodes?: string[];
  stores?: string[];
  quantityEstimate?: { min: number; max: number };
  confidence: Confidence;
  lastCheckedAt: ISO8601;
  staleAfter?: ISO8601;
  source: string;
}

export interface OfferPromotion {
  id: string;
  type: PromotionType;
  description: string;
  /** Effective discount this promotion applies to the offer. */
  effectiveDiscount?: Money;
  stackable: 'yes' | 'no' | 'unknown';
  minSpend?: Money;
  maxDiscount?: Money;
  categoryRestrictions?: string[];
  brandRestrictions?: string[];
  quantityRestrictions?: { min?: number; max?: number };
  expiration?: ISO8601;
  membershipRequired?: boolean;
  paymentRequired?: string[];
  evidence: Evidence[];
}

export interface OfferCoupon {
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed' | 'shipping' | 'gift' | 'unknown';
  discountValue?: number;
  stackable: 'yes' | 'no' | 'unknown';
  minSpend?: Money;
  maxDiscount?: Money;
  expiration?: ISO8601;
  membershipRequired?: boolean;
  paymentRequired?: string[];
  evidence: Evidence[];
}

export interface OfferRebate {
  id: string;
  description: string;
  amount: Money;
  submissionRequired: boolean;
  expiration?: ISO8601;
  evidence: Evidence[];
}

export interface OfferFulfillment {
  shippingAvailable: boolean;
  pickupAvailable: boolean;
  deliveryAvailable: boolean;
  digitalAvailable: boolean;
  shippingCost?: Money;
  freeShippingThreshold?: Money;
  regions?: RegionCode[];
}

export interface OfferRestriction {
  accountRequired?: boolean;
  membershipRequired?: boolean;
  paymentMethodRequired?: string[];
  subscriptionRequired?: boolean;
  onlineOnly?: boolean;
  storeOnly?: boolean;
  region?: RegionCode[];
  minQuantity?: number;
  maxQuantity?: number;
}

export interface OfferExpiration {
  expiresAt?: ISO8601;
  whileSuppliesLast?: boolean;
}

export interface OfferConfidence {
  price: Confidence;
  availability: Confidence;
  promotion: Confidence;
  coupon: Confidence;
  overall: Confidence;
}

export interface OfferSource {
  sourceMethod: RetailerSourceMethod;
  sourceUrl?: string;
  observedAt: ISO8601;
  extractionMethod: string;
  /** Precedence rank (1 = highest). See source-precedence system. */
  precedence: number;
}

export interface OfferStack {
  promotions: OfferPromotion[];
  coupons: OfferCoupon[];
  rebates: OfferRebate[];
  /** Whether the stack is valid, invalid, or uncertain. */
  status: 'valid' | 'invalid' | 'uncertain';
  reasons: string[];
  effectivePrice: Money;
  requiredSteps: string[];
  risks: string[];
  missingConfirmations: string[];
  evidence: Evidence[];
}

export interface RetailOffer {
  id: OfferId;
  retailerId: RetailerId;
  productId: ProductId;
  prices: OfferPrice;
  availability: OfferAvailability;
  promotions: OfferPromotion[];
  coupons: OfferCoupon[];
  rebates: OfferRebate[];
  fulfillment: OfferFulfillment;
  restrictions: OfferRestriction;
  expiration: OfferExpiration;
  confidence: OfferConfidence;
  source: OfferSource;
  evidence: Evidence[];
  observedAt: ISO8601;
}

// ---------------------------------------------------------------------------
// Promotions
// ---------------------------------------------------------------------------

export type PromotionType =
  | 'percentage' | 'fixed' | 'BOGO' | 'buy-more-save-more'
  | 'category' | 'member' | 'credit-card' | 'gift-card'
  | 'rebate' | 'loyalty-points' | 'store-cash' | 'clearance'
  | 'markdown' | 'bundle' | 'free-shipping' | 'first-order'
  | 'app-only' | 'email-only' | 'regional';

// ---------------------------------------------------------------------------
// Historical pricing
// ---------------------------------------------------------------------------

export interface PriceObservation {
  productId: ProductId;
  retailerId: RetailerId;
  observedAt: ISO8601;
  retailerPrice?: Money;
  effectivePrice?: Money;
  msrpReference?: Money;
  observedSalePrice?: Money;
  couponAdjustedPrice?: Money;
  memberPrice?: Money;
  shippingAdjustedPrice?: Money;
  source: string;
  evidence: Evidence[];
}

export interface PriceHistoryStats {
  lowestObserved?: Money;
  medianObserved?: Money;
  recentAverage?: Money;
  priceFrequency?: number;
  priceVolatility?: number;
  historicalRank?: number;
  discountPercentile?: number;
  observationCount: number;
  firstObservedAt?: ISO8601;
  lastObservedAt?: ISO8601;
  freshness: ISO8601;
}

// ---------------------------------------------------------------------------
// Discount validation
// ---------------------------------------------------------------------------

export type DiscountKind =
  | 'fake-inflated-msrp'
  | 'repeated-sale-price'
  | 'ordinary-recurring-discount'
  | 'genuine-historical-low'
  | 'near-historical-low'
  | 'lowest-observed-price'
  | 'temporary-markdown'
  | 'regional-markdown'
  | 'member-only-markdown'
  | 'clearance'
  | 'liquidation'
  | 'pricing-error'
  | 'likely-stale-price'
  | 'unavailable-teaser-price'
  | 'bundle-value-distortion'
  | 'shipping-offset-discount';

export interface DiscountValidation {
  advertisedDiscountPct?: number;
  effectiveDiscountPct?: number;
  historicalDiscountPct?: number;
  kind: DiscountKind;
  confidence: Confidence;
  riskFlags: string[];
  evidence: Evidence[];
  explanation: string;
  verificationNeeded: string[];
}

// ---------------------------------------------------------------------------
// Deal lifecycle
// ---------------------------------------------------------------------------

export type DealState =
  | 'DISCOVERED' | 'VALIDATING' | 'VERIFIED' | 'VERIFIED_WITH_CONDITIONS'
  | 'COMMUNITY_REPORTED' | 'NEEDS_REVIEW' | 'STALE' | 'DEAD'
  | 'EXPIRED' | 'REJECTED' | 'BLOCKED'
  | 'PUBLISHED' | 'ARCHIVED' | 'FAILED';

export interface DealValidationResult {
  state: DealState;
  reasons: string[];
  missingEvidence: string[];
  evidence: Evidence[];
  validatedAt: ISO8601;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export type ScoreBand =
  | 'EXCEPTIONAL' | 'STRONG' | 'GOOD' | 'CONDITIONAL'
  | 'WATCH' | 'WEAK' | 'REJECT' | 'INSUFFICIENT_DATA';

export interface ScoreFactor {
  key: string;
  weight: number;
  raw: number;       // 0..1
  weighted: number;  // raw * weight
  rationale: string;
}

export interface Score {
  value: number;       // 0..100
  band: ScoreBand;
  factors: ScoreFactor[];
  confidence: Confidence;
  missingData: string[];
  computedAt: ISO8601;
}

export interface DealScoreSet {
  consumerValue: Score;
  resellerOpportunity: Score;
  affiliateOpportunity: Score;
  scarcity: Score;
  confidence: Score;
  urgency: Score;
  contentPotential: Score;
  overall: Score;
}

// ---------------------------------------------------------------------------
// Resale
// ---------------------------------------------------------------------------

export type ResaleRecommendation =
  | 'BUY' | 'STRONG_BUY' | 'NEGOTIATE' | 'MAYBE'
  | 'PASS' | 'RESEARCH_MORE' | 'DATA_INSUFFICIENT';

export interface ResaleAnalysis {
  estimatedMarketRange: { low: Money; high: Money };
  recommendedListPrice: Money;
  fastSalePrice: Money;
  expectedFees: Money;
  expectedShipping: Money;
  expectedProfit: Money;
  roi: number;
  maximumBuyPrice: Money;
  targetBuyPrice: Money;
  recommendedQuantity: number;
  recommendedMarketplaces: string[];
  confidence: Confidence;
  missingData: string[];
  recommendation: ResaleRecommendation;
  evidence: Evidence[];
}

// ---------------------------------------------------------------------------
// Affiliate
// ---------------------------------------------------------------------------

export interface AffiliateNetwork {
  id: string;
  name: string;
  /** Reference to credential (Prime Vault). */
  credentialRef?: string;
}

export interface AffiliateProgram {
  network: AffiliateNetwork;
  merchantId: string;
  merchantName: string;
  defaultCommissionPct?: number;
  termsRef?: string;
}

export interface AffiliateLink {
  id: string;
  program: AffiliateProgram;
  destinationUrl: string;
  trackingUrl: string;
  campaignTags: Record<string, string>;
  expiresAt?: ISO8601;
  disclosureRequired: boolean;
  disclosureText?: string;
  /** Whether the link was validated against the official domain. */
  domainValidated: boolean;
  createdAt: ISO8601;
}

export interface AffiliateAttribution {
  linkId: string;
  clickEventId?: string;
  conversionEventId?: string;
  commissionEstimate?: Money;
  observedAt: ISO8601;
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export type AlertType =
  | 'new-deal' | 'price-drop' | 'historical-low' | 'hidden-markdown'
  | 'restock' | 'low-stock' | 'local-inventory' | 'coupon-stack'
  | 'expiring-promotion' | 'resale-opportunity' | 'hard-to-find'
  | 'community-submitted-deal' | 'enterprise-opportunity'
  | 'dead-deal' | 'correction';

export type AlertChannel =
  | 'website' | 'discord' | 'email' | 'sms' | 'push'
  | 'webhook' | 'rss' | 'social' | 'amos';

export interface AlertRule {
  id: string;
  tenantId: TenantId;
  name: string;
  types: AlertType[];
  channels: AlertChannel[];
  watchlist?: ProductId[];
  categories?: string[];
  retailers?: RetailerId[];
  regions?: RegionCode[];
  minScore?: number;
  minDiscountPct?: number;
  minExpectedProfit?: Money;
  minRoi?: number;
  premiumTier?: string;
  quietHours?: { start: string; end: string; tz: string };
  rateLimit?: { perHour: number };
  mode: 'immediate' | 'digest';
  duplicateSuppressionWindowMin?: number;
}

export interface Alert {
  id: AlertId;
  ruleId: string;
  tenantId: TenantId;
  type: AlertType;
  dealId?: DealId;
  channels: AlertChannel[];
  headline: string;
  body: string;
  createdAt: ISO8601;
  deliveredTo: { channel: AlertChannel; at: ISO8601; success: boolean; adapterId: AdapterId }[];
  suppressed?: boolean;
  suppressionReason?: string;
}

// ---------------------------------------------------------------------------
// Community submissions
// ---------------------------------------------------------------------------

export type SubmissionState =
  | 'RECEIVED' | 'DUPLICATE' | 'VALIDATING' | 'VERIFIED'
  | 'VERIFIED_WITH_CONDITIONS' | 'NEEDS_MORE_EVIDENCE'
  | 'REJECTED' | 'PUBLISHED' | 'EXPIRED';

export interface CommunitySubmission {
  id: SubmissionId;
  tenantId: TenantId;
  contributorId: string;
  url?: string;
  photoRef?: string;
  receiptRef?: string;
  store?: string;
  zipCode?: string;
  observedPrice?: Money;
  quantity?: number;
  observedAt: ISO8601;
  membership?: string;
  comments?: string;
  evidence: Evidence[];
  state: SubmissionState;
  reputationDelta?: number;
  duplicateOf?: SubmissionId;
  moderatedAt?: ISO8601;
  moderatedBy?: string;
}

// ---------------------------------------------------------------------------
// AMOS contracts
// ---------------------------------------------------------------------------

export type AmosJobKind =
  | 'daily-top-deals' | 'store-clearance-roundup' | 'flip-of-the-day'
  | 'sneaker-alert' | 'tool-alert' | 'electronics-alert'
  | 'holiday-arbitrage' | 'regional-clearance' | 'restock-alert'
  | 'hidden-markdown' | 'comparison-video' | 'weekly-deal-recap';

export interface AmosJob {
  id: AmosJobId;
  kind: AmosJobKind;
  title: string;
  hook: string;
  verifiedFacts: string[];
  prohibitedClaims: string[];
  sourceReferences: string[];
  affiliateLinks: AffiliateLink[];
  disclosures: string[];
  thumbnailConcepts: string[];
  shortFormScript: string;
  longFormOutline: string[];
  blogOutline: string[];
  socialCaptions: string[];
  expiration?: ISO8601;
  correctionRequirements: string[];
  evidenceConfidence: Confidence;
  createdAt: ISO8601;
}

// ---------------------------------------------------------------------------
// Tenant
// ---------------------------------------------------------------------------

export interface TenantConfig {
  id: TenantId;
  name: string;
  kind: 'public' | 'affiliate-publisher' | 'reseller-group' | 'discord-community'
      | 'enterprise-retail' | 'nonprofit' | 'regional-community' | 'white-label';
  retailers: RetailerId[];
  premiumTiers?: string[];
  alertRules: AlertRule[];
  affiliateCampaigns?: CampaignId[];
  isolatedData: string[];
  createdAt: ISO8601;
}

// ---------------------------------------------------------------------------
// Observability
// ---------------------------------------------------------------------------

export type ObservabilityEventKind =
  | 'source-check-started' | 'source-check-completed' | 'source-check-failed'
  | 'product-normalized' | 'offer-normalized'
  | 'promotion-detected' | 'coupon-validated'
  | 'price-history-updated'
  | 'deal-discovered' | 'deal-validated' | 'deal-rejected' | 'deal-scored'
  | 'resale-opportunity-scored'
  | 'affiliate-link-created'
  | 'alert-queued' | 'alert-delivered'
  | 'deal-rechecked' | 'deal-corrected' | 'deal-expired' | 'dead-deal-detected'
  | 'community-submission-received' | 'moderation-completed'
  | 'amos-job-created'
  | 'runtime-failed';

export interface ObservabilityEvent {
  kind: ObservabilityEventKind;
  tenantId?: TenantId;
  at: ISO8601;
  payload: Record<string, unknown>;
  level: 'debug' | 'info' | 'warn' | 'error';
  fallback?: { executed: boolean; reason: string };
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// ---------------------------------------------------------------------------
// Adapter SDK base contract
// ---------------------------------------------------------------------------

export interface AdapterCapability {
  id: AdapterId;
  version: string;
  capabilities: string[];
  supportedRetailers: RetailerId[];
  regions: RegionCode[];
  authenticationRequired: boolean;
  termsRestrictions: string[];
  rateLimits?: { requestsPerMinute: number };
  costMetadata?: { perRequest?: Money; monthly?: Money };
  healthCheck: () => Promise<{ status: 'healthy' | 'degraded' | 'down'; detail?: string }>;
  retrySemantics: { maxRetries: number; backoff: 'fixed' | 'exponential' };
  confidence: Confidence;
  freshness: ISO8601;
  evidenceSupport: boolean;
  browserRequired: boolean;
  legalReviewStatus: 'pending' | 'in-review' | 'approved' | 'rejected' | 'not-required';
  /** True if and only if this adapter is a TEST-ONLY adapter. */
  testOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Re-export utilities (money, ids) for downstream packages
// ---------------------------------------------------------------------------

export * from './money.js';
export * from './ids.js';
