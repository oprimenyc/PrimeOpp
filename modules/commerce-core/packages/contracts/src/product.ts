// Canonical Product Model — Phase 2.
// Capable of representing physical, digital, POD, dropship, affiliate,
// services, bundles, kits, lots, multipacks, variants, serialized items,
// unique collectibles, used, open-box, refurbished, damaged, local-pickup-only.

import type {
  Confidence,
  Identified,
  ISO8601,
  OrganizationId,
  TenantId,
  TenantScoped,
  Timestamped,
} from './internal.ts';

// ---------------------------------------------------------------------------
// Product kind and lifecycle
// ---------------------------------------------------------------------------

export type ProductKind =
  | 'PHYSICAL'
  | 'DIGITAL'
  | 'POD'
  | 'DROPSHIP'
  | 'AFFILIATE'
  | 'SERVICE'
  | 'BUNDLE'
  | 'KIT'
  | 'LOT'
  | 'MULTIPACK'
  | 'SERIALIZED'
  | 'UNIQUE_COLLECTIBLE';

export type ProductListingState =
  | 'UNLISTED'
  | 'DRAFT'
  | 'READY'
  | 'LISTED'
  | 'PARTIALLY_LISTED'
  | 'SOLD'
  | 'PARTIALLY_SOLD'
  | 'ENDED'
  | 'ARCHIVED';

export type ProductFulfillmentMode =
  | 'SELLER_FULFILLED'
  | 'CHANNEL_FULFILLED'
  | 'SUPPLIER_FULFILLED'
  | 'POD_FULFILLED'
  | 'DIGITAL_DELIVERY'
  | 'LOCAL_PICKUP'
  | 'NO_FULFILLMENT'; // affiliate

export type ProductChannelState =
  | 'NOT_PUBLISHED'
  | 'PUBLISHED'
  | 'PAUSED'
  | 'ENDED'
  | 'ERROR';

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

export type IdentifierType =
  | 'UPC'
  | 'UPC_A'
  | 'UPC_E'
  | 'EAN'
  | 'EAN_8'
  | 'EAN_13'
  | 'GTIN'
  | 'GTIN_14'
  | 'ISBN'
  | 'ISBN_10'
  | 'ISBN_13'
  | 'ASIN'
  | 'SKU'
  | 'MPN'
  | 'MODEL_NUMBER'
  | 'SERIAL_NUMBER'
  | 'MARKETPLACE_LISTING_ID'
  | 'RETAILER_PRODUCT_ID'
  | 'INTERNAL_ID'
  | 'CUSTOM_SELLER_ID'
  | 'URL'
  | 'CUSTOM';

export type IdentifierVerificationStatus =
  | 'UNVERIFIED'
  | 'CHECK_DIGIT_VALID'
  | 'PROVIDER_VERIFIED'
  | 'HUMAN_CONFIRMED'
  | 'CONFLICTED'
  | 'INVALID';

export interface ProductIdentifier {
  type: IdentifierType;
  value: string;
  source: string;
  verification: IdentifierVerificationStatus;
  confidence: Confidence;
  observedAt: ISO8601;
  expiresAt?: ISO8601;
  evidenceRef?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Brand, model, category
// ---------------------------------------------------------------------------

export interface ProductBrand {
  name: string;
  normalized: string;
  confidence: Confidence;
  source: string;
}

export interface ProductModel {
  name: string;
  normalized: string;
  brand?: string;
  confidence: Confidence;
  source: string;
}

export interface ProductCategory {
  taxonomy: string; // e.g. 'default', 'google', 'amazon'
  path: string[]; // ordered path from root to leaf
  leaf: string;
  confidence: Confidence;
}

// ---------------------------------------------------------------------------
// Variant attributes
// ---------------------------------------------------------------------------

export type VariantAxis =
  | 'SIZE'
  | 'COLOR'
  | 'MATERIAL'
  | 'STYLE'
  | 'STORAGE'
  | 'CAPACITY'
  | 'EDITION'
  | 'REGION'
  | 'PLATFORM'
  | 'SHOE_SIZE'
  | 'APPAREL_SIZE'
  | 'WIDTH'
  | 'CONDITION'
  | 'BUNDLE_QTY'
  | 'PACKAGE_COUNT'
  | 'MODEL_REVISION'
  | 'CUSTOM';

export interface VariantAttribute {
  axis: VariantAxis;
  value: string;
  normalized?: string;
  unit?: string;
  source: string;
  confidence: Confidence;
}

export interface ProductVariant {
  id: string;
  productId: string;
  attributes: VariantAttribute[];
  /** Hash of normalized attributes; used for variant equality. */
  attributeHash: string;
  displayName?: string;
  sku?: string;
}

// ---------------------------------------------------------------------------
// Condition
// ---------------------------------------------------------------------------

export type CanonicalCondition =
  | 'NEW'
  | 'NEW_WITH_TAGS'
  | 'NEW_WITHOUT_TAGS'
  | 'NEW_OPEN_BOX'
  | 'LIKE_NEW'
  | 'EXCELLENT'
  | 'VERY_GOOD'
  | 'GOOD'
  | 'FAIR'
  | 'POOR'
  | 'FOR_PARTS'
  | 'REFURBISHED'
  | 'SELLER_REFURBISHED'
  | 'MANUFACTURER_REFURBISHED'
  | 'DAMAGED'
  | 'CUSTOM';

export interface ConditionAssessment {
  condition: CanonicalCondition;
  confidence: Confidence;
  observedDefects: string[];
  missingAccessories: string[];
  packagingCondition?: string;
  functionalStatus?: string;
  cosmeticStatus?: string;
  odorSmokeExposure?: string;
  repairHistory?: string;
  authenticityStatus?: 'AUTHENTIC' | 'SUSPECT' | 'COUNTERFEIT' | 'UNVERIFIED';
  photoRefs: string[];
  sellerNotes?: string;
  reviewer?: string;
  evidenceRefs: string[];
  assessedAt: ISO8601;
}

// ---------------------------------------------------------------------------
// Images, documents
// ---------------------------------------------------------------------------

export interface ProductImage {
  id: string;
  url?: string;
  /** Reference to evidence storage. URL is optional to keep this offline-capable. */
  evidenceRef: string;
  kind: 'PRIMARY' | 'GALLERY' | 'DEFECT' | 'PACKAGING' | 'LABEL' | 'OTHER';
  width?: number;
  height?: number;
  hash?: string;
}

export interface ProductDocument {
  id: string;
  kind: 'MANUAL' | 'SPEC_SHEET' | 'RECEIPT' | 'CERTIFICATE' | 'OTHER';
  evidenceRef: string;
  filename?: string;
}

// ---------------------------------------------------------------------------
// Source, provenance, ownership
// ---------------------------------------------------------------------------

export interface ProductSource {
  kind: 'SCAN' | 'OCR' | 'IMAGE_MATCH' | 'MANUAL' | 'CATALOG' | 'IMPORT' | 'AI_ENRICHMENT';
  ref: string;
  observedAt: ISO8601;
  confidence: Confidence;
}

export interface ProductProvenance {
  originSource: ProductSource;
  observations: ProductSource[];
  lineage: ProductLineageEntry[];
}

export interface ProductLineageEntry {
  action: string;
  at: ISO8601;
  actor: string;
  evidenceRef?: string;
}

export interface ProductOwnership {
  tenantId: TenantId;
  organizationId?: OrganizationId;
  sellerId?: string;
  /** If true, this product record is private to the tenant. */
  private: boolean;
  /** For consignment: the original owner. */
  consignor?: string;
}

// ---------------------------------------------------------------------------
// Cost basis and acquisition
// ---------------------------------------------------------------------------

export type AcquisitionMethod =
  | 'RETAIL_PURCHASE'
  | 'ONLINE_PURCHASE'
  | 'THRIFT_PURCHASE'
  | 'ESTATE_SALE'
  | 'GARAGE_SALE'
  | 'AUCTION'
  | 'LIQUIDATION_PALLET'
  | 'WHOLESALE'
  | 'CONSIGNMENT'
  | 'DONATION'
  | 'TRADE'
  | 'PERSONAL_INVENTORY'
  | 'MANUFACTURED_POD'
  | 'DROPSHIP'
  | 'AFFILIATE'
  | 'TRANSFER';

export interface CostLineItem {
  label: string;
  amount: number;
  currency: string;
  status: 'ACTUAL' | 'AUTHORITATIVE' | 'ESTIMATED' | 'USER_ENTERED' | 'UNKNOWN';
  evidenceRef?: string;
}

export interface ProductCostBasis {
  acquisitionMethod: AcquisitionMethod;
  purchasePrice?: CostLineItem;
  tax?: CostLineItem;
  inboundShipping?: CostLineItem;
  buyerFees?: CostLineItem;
  inspection?: CostLineItem;
  repair?: CostLineItem;
  cleaning?: CostLineItem;
  authentication?: CostLineItem;
  storage?: CostLineItem;
  labor?: CostLineItem;
  packaging?: CostLineItem;
  other?: CostLineItem[];
  /** If part of a lot, the lot total and unit allocation. */
  lotAllocation?: {
    lotId: string;
    lotTotal: number;
    unitsInLot: number;
    allocatedPerUnit: number;
  };
  perUnitCostBasis: number;
  currency: string;
  exchangeRateRef?: string;
  evidenceRefs: string[];
  /** True if any component is estimated rather than actual. */
  hasEstimated: boolean;
}

export interface ProductAcquisition {
  method: AcquisitionMethod;
  at: ISO8601;
  seller?: string;
  location?: string;
  lotId?: string;
  evidenceRefs: string[];
  costBasis?: ProductCostBasis;
}

// ---------------------------------------------------------------------------
// Location
// ---------------------------------------------------------------------------

export type LocationKind = 'WAREHOUSE' | 'STORE' | 'VEHICLE' | 'BIN' | 'VIRTUAL' | 'CONSIGNMENT' | 'DONOR' | 'SUPPLIER';

export interface ProductLocation {
  id: string;
  kind: LocationKind;
  label: string;
  address?: string;
  /** For virtual locations (POD, dropship, affiliate). */
  virtualRef?: string;
  tenantId: TenantId;
  organizationId?: OrganizationId;
}

export interface ProductLot {
  id: string;
  label: string;
  unitsTotal: number;
  unitsRemaining: number;
  unitCost: number;
  currency: string;
  tenantId: TenantId;
  acquiredAt: ISO8601;
}

export interface ProductBundle {
  id: string;
  productId: string;
  componentProductIds: string[];
  /** If true, components are physically inseparable (sealed multipack). */
  sealed: boolean;
  quantityPerComponent: Record<string, number>;
}

export type ProductRelationshipKind =
  | 'VARIANT_OF'
  | 'ACCESSORY_OF'
  | 'COMPATIBLE_WITH'
  | 'BUNDLE_OF'
  | 'UPGRADE_OF'
  | 'DOWNGRADE_OF'
  | 'REPLACES'
  | 'REPLACED_BY'
  | 'SAME_AS'
  | 'CUSTOM';

export interface ProductRelationship {
  kind: ProductRelationshipKind;
  fromProductId: string;
  toProductId: string;
  confidence: Confidence;
  evidenceRef?: string;
}

export interface ProductEvidence {
  evidenceRefs: string[];
  confidence: Confidence;
  /** Summary of why this confidence was chosen. */
  rationale?: string;
}

export interface ProductConfidence {
  overall: Confidence;
  identity: Confidence;
  variant: Confidence;
  condition: Confidence;
  pricing: Confidence;
  rationale?: string;
}

// ---------------------------------------------------------------------------
// Canonical Product
// ---------------------------------------------------------------------------

export interface Product extends Identified, Timestamped, TenantScoped {
  schemaVersion: string;
  kind: ProductKind;
  title: string;
  brand?: ProductBrand;
  model?: ProductModel;
  category?: ProductCategory;
  description?: string;
  attributes: VariantAttribute[];
  identifiers: ProductIdentifier[];
  variants: ProductVariant[];
  condition?: ConditionAssessment;
  images: ProductImage[];
  documents: ProductDocument[];
  source: ProductSource;
  provenance: ProductProvenance;
  ownership: ProductOwnership;
  listingState: ProductListingState;
  fulfillmentMode: ProductFulfillmentMode;
  channelState: Record<string, ProductChannelState>;
  evidence: ProductEvidence;
  confidence: ProductConfidence;
  costBasis?: ProductCostBasis;
  acquisition?: ProductAcquisition;
  locations?: ProductLocation[];
  lot?: ProductLot;
  bundle?: ProductBundle;
  relationships?: ProductRelationship[];
  /** Soft-delete marker. */
  archived?: boolean;
  /** Version for optimistic concurrency. */
  version: number;
}

export const PRODUCT_SCHEMA_VERSION = '1.0.0';
