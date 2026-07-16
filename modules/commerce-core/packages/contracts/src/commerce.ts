// Pricing, fee, shipping, profit, opportunity contracts.
// Phases 11–16.

import type {
  Confidence,
  EpistemicStatus,
  Identified,
  ISO8601,
  Money,
  MoneyRange,
  OperationResult,
  TenantScoped,
  Timestamped,
} from './internal.ts';
import type { CanonicalCondition, ProductVariant } from './product.ts';

// ---------------------------------------------------------------------------
// Pricing observations
// ---------------------------------------------------------------------------

export type PricingSourceKind =
  | 'RETAILER_LISTING'
  | 'MARKETPLACE_ACTIVE_LISTING'
  | 'MARKETPLACE_SOLD_LISTING'
  | 'AUCTION_RESULT'
  | 'LOCAL_MARKETPLACE'
  | 'WHOLESALE_CATALOG'
  | 'SELLER_PROVIDED_COMP'
  | 'HISTORICAL_RECORD'
  | 'MANUAL_OBSERVATION'
  | 'AFFILIATE_FEED';

export type ListingStatus = 'ACTIVE' | 'SOLD' | 'ENDED' | 'UNKNOWN';

export interface PricingObservation extends Identified, Timestamped, TenantScoped {
  productId: string;
  variantId?: string;
  condition: CanonicalCondition;
  price: Money;
  shipping?: Money;
  feesIfKnown?: Money;
  currency: string;
  quantity: number;
  location?: string;
  source: PricingSourceKind;
  sourceRef?: string;
  listingStatus: ListingStatus;
  listedAt?: ISO8601;
  soldAt?: ISO8601;
  observedAt: ISO8601;
  sellerType?: string;
  confidence: Confidence;
  evidenceRefs: string[];
  /** Number of seconds since observation — used to compute freshness. */
  freshnessSeconds: number;
  authenticityStatus?: 'AUTHENTIC' | 'SUSPECT' | 'COUNTERFEIT' | 'UNVERIFIED';
}

export interface PricingObservationGroup {
  productId: string;
  variantId?: string;
  condition: CanonicalCondition;
  active: PricingObservation[];
  sold: PricingObservation[];
  /** True if any normalization warnings apply (e.g. mixed bundles). */
  normalized: boolean;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Pricing engine
// ---------------------------------------------------------------------------

export type PricingStrategy =
  | 'QUICK_FLIP'
  | 'BALANCED'
  | 'MAX_MARGIN'
  | 'MARKET_MATCH'
  | 'CLEARANCE'
  | 'AGED_INVENTORY'
  | 'ENTERPRISE_POLICY'
  | 'CUSTOM';

export interface PricingInput {
  productId: string;
  variantId?: string;
  condition: CanonicalCondition;
  activeComps: PricingObservation[];
  soldComps: PricingObservation[];
  fees?: FeeAssessment;
  shippingEstimate?: ShippingEstimate;
  desiredMargin?: number;
  desiredRoi?: number;
  timeToSaleDays?: number;
  seasonalityFactor?: number;
  localDemandFactor?: number;
  sellerRules?: PricingSellerRule[];
  minimumPrice?: Money;
  customListingPrice?: Money;
  strategy: PricingStrategy;
  scope: TenantScoped;
}

export interface PricingSellerRule {
  code: string;
  description: string;
  apply: (input: PricingInput, intermediate: PricingIntermediate) => void;
}

export interface PricingIntermediate {
  activeMedian: number;
  activeMean: number;
  activeLow: number;
  activeHigh: number;
  soldMedian: number;
  soldMean: number;
  soldLow: number;
  soldHigh: number;
  activeCount: number;
  soldCount: number;
  /** Total comp weight for confidence (decays with age). */
  effectiveWeight: number;
}

export interface PricingResult {
  estimatedMarketValue: MoneyRange;
  fastSalePrice: Money;
  balancedPrice: Money;
  maximumMarginPrice: Money;
  minimumAcceptablePrice: Money;
  recommendedListPrice: Money;
  recommendedOfferFloor: Money;
  confidenceRange: { low: Confidence; high: Confidence };
  dataFreshnessSeconds: number;
  sourceCoverage: number;
  comparableCount: number;
  explanation: PricingExplanation[];
  warnings: string[];
}

export interface PricingExplanation {
  step: string;
  detail: string;
  evidenceRef?: string;
}

// ---------------------------------------------------------------------------
// Fee engine
// ---------------------------------------------------------------------------

export type FeeType =
  | 'MARKETPLACE_COMMISSION'
  | 'PAYMENT_PROCESSING'
  | 'LISTING_FEE'
  | 'INSERTION_FEE'
  | 'PROMOTION_FEE'
  | 'AUTHENTICATION_FEE'
  | 'FULFILLMENT_FEE'
  | 'STORAGE_FEE'
  | 'WITHDRAWAL_FEE'
  | 'CURRENCY_CONVERSION'
  | 'TAX_WITHHOLDING_ESTIMATE'
  | 'RETURN_RESERVE'
  | 'SHIPPING_LABEL_MARKUP'
  | 'SUBSCRIPTION_ALLOCATION'
  | 'CUSTOM_FEE';

export type FeeModel =
  | 'PERCENTAGE'
  | 'FIXED'
  | 'TIERED'
  | 'CAPPED'
  | 'MINIMUM';

export interface FeeScheduleEntry {
  type: FeeType;
  model: FeeModel;
  /** For PERCENTAGE: fraction in [0, 1]. For FIXED: amount. */
  rate: number;
  /** For TIERED / CAPPED / MINIMUM. */
  tiers?: Array<{ min: number; max?: number; rate: number; fixed?: number }>;
  cap?: number;
  minimum?: number;
  currency: string;
  category?: string;
  sellerTier?: string;
  promotionRef?: string;
  marketplaceRef?: string;
  effectiveFrom: ISO8601;
  effectiveTo?: ISO8601;
  /** Reference to authoritative source of the schedule. */
  sourceRef: string;
}

export interface FeeSchedule extends Identified, Timestamped {
  marketplaceRef: string;
  version: string;
  entries: FeeScheduleEntry[];
  /** True if any entry is past effectiveTo. */
  stale: boolean;
}

export interface FeeAssessment {
  scheduleRef: string;
  scheduleVersion: string;
  /** Final price used as the assessment basis. */
  basis: Money;
  lineItems: FeeLineItem[];
  total: Money;
  /** True if any entry used was estimated or stale. */
  estimated: boolean;
  staleWarnings: string[];
}

export interface FeeLineItem {
  type: FeeType;
  amount: Money;
  model: FeeModel;
  rate?: number;
  scheduleEntryRef?: string;
  /** True if this line item's schedule entry is past effectiveTo. */
  stale?: boolean;
}

// ---------------------------------------------------------------------------
// Shipping estimator
// ---------------------------------------------------------------------------

export interface PackageSpec {
  kind: 'SMALL' | 'MEDIUM' | 'LARGE' | 'FLAT' | 'TUBE' | 'FREIGHT' | 'CUSTOM';
  weight: number; // in units of weightUnit
  weightUnit: 'G' | 'KG' | 'OZ' | 'LB';
  length: number;
  width: number;
  height: number;
  dimensionUnit: 'CM' | 'IN';
}

export interface ShippingEstimateInput {
  packageSpec: PackageSpec;
  originZone?: string;
  destinationZone?: string;
  carrierClass?: 'ECONOMY' | 'STANDARD' | 'EXPEDITED' | 'FREIGHT';
  insurance?: Money;
  signatureRequired?: boolean;
  hazardous?: boolean;
  localPickup?: boolean;
  international?: boolean;
  returnShipping?: boolean;
  scope: TenantScoped;
}

export interface ShippingEstimate {
  billableWeight: number;
  billableWeightUnit: 'LB' | 'KG';
  packagingCost: Money;
  labelCost: Money;
  estimatedRange: MoneyRange;
  confidence: Confidence;
  missingDataWarnings: string[];
  /** Recommended package kind. */
  recommendedPackageKind: PackageSpec['kind'];
}

// ---------------------------------------------------------------------------
// Profit & ROI
// ---------------------------------------------------------------------------

export interface ProfitInput {
  productId: string;
  listingPrice: Money;
  costBasis: Money;
  inboundCost: Money;
  feeAssessment?: FeeAssessment;
  shippingEstimate?: ShippingEstimate;
  packagingCost?: Money;
  laborAllocation?: Money;
  storageAllocation?: Money;
  promotionFees?: Money;
  returnReserve?: Money;
  /** Tax treatment: 'EXCLUDED' means tax is not in price; 'INCLUDED' means tax is in price. */
  taxTreatment: 'EXCLUDED' | 'INCLUDED';
  scope: TenantScoped;
}

export interface ProfitResult {
  grossRevenue: Money;
  productCost: Money;
  inboundCost: Money;
  marketplaceFees: Money;
  paymentFees: Money;
  shipping: Money;
  packaging: Money;
  labor: Money;
  storage: Money;
  promotion: Money;
  returnReserve: Money;
  netProfit: Money;
  margin: number; // fraction in [0, 1] (may be negative)
  roi: number; // fraction (may be negative)
  breakEvenPrice: Money;
  maximumBuyPrice: Money;
  targetBuyPrice?: Money;
  profitPerDay?: Money;
  annualizedReturn?: number;
  /** Per-line epistemic status. */
  statuses: Record<string, EpistemicStatus>;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Opportunity engine
// ---------------------------------------------------------------------------

export type OpportunityDecision =
  | 'BUY'
  | 'STRONG_BUY'
  | 'NEGOTIATE'
  | 'MAYBE'
  | 'PASS'
  | 'RESEARCH_MORE'
  | 'AUTHENTICATE_FIRST'
  | 'INSPECT_FIRST'
  | 'DATA_INSUFFICIENT';

export interface OpportunityInput {
  expectedProfit: Money;
  roi: number;
  margin: number;
  sellThroughProxy?: number;
  comparableCount: number;
  confidence: Confidence;
  inventoryAgeRiskDays?: number;
  conditionRisk?: number;
  authenticityRisk?: number;
  shippingComplexity?: number;
  returnRisk?: number;
  categoryRisk?: number;
  /** Tenant-defined thresholds override defaults. */
  tenantThresholds?: OpportunityThresholds;
  availableCapital?: Money;
  desiredVelocityDays?: number;
  scope: TenantScoped;
}

export interface OpportunityThresholds {
  strongBuyRoi: number; // e.g. 1.0 (100% ROI)
  buyRoi: number; // e.g. 0.4 (40% ROI)
  maybeRoi: number; // e.g. 0.15 (15% ROI)
  minimumConfidence: number; // e.g. 0.6
  minimumComparableCount: number; // e.g. 3
}

export interface OpportunityResult {
  decision: OpportunityDecision;
  reasons: string[];
  risks: string[];
  missingData: string[];
  maximumRecommendedPurchasePrice: Money;
  suggestedNegotiationTarget?: Money;
  recommendedMarketplaces: string[];
  recommendedNextStep: string;
  confidence: Confidence;
}
