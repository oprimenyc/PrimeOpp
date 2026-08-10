/**
 * This worker does not depend on `modules/commerce-core` (a separate,
 * standalone npm project outside the pnpm workspace — see
 * PRIMEOPP_FULL_PLATFORM_SURFACE_MAP.md). Following the same pattern
 * commerce-core itself uses for the primeopp-product-enrichment handoff
 * (`packages/product-identity/src/index.ts`, "local structural mirror of
 * the minimum subset... this bridge needs"), the types below are a local
 * mirror of the minimum subset of `@primeopp/contracts`' `Product` type
 * (`modules/commerce-core/packages/contracts/src/product.ts`) this adapter
 * needs. See PRIMEOPP_COMMERCE_CORE_ADAPTER_CONTRACT.md for the full field
 * map and rationale.
 */

export type CanonicalProductKind =
  | "PHYSICAL"
  | "DIGITAL"
  | "POD"
  | "DROPSHIP"
  | "AFFILIATE"
  | "SERVICE"
  | "BUNDLE"
  | "KIT"
  | "LOT"
  | "MULTIPACK"
  | "SERIALIZED"
  | "UNIQUE_COLLECTIBLE";

export type CanonicalVariantAxis =
  | "SIZE"
  | "COLOR"
  | "MATERIAL"
  | "STYLE"
  | "STORAGE"
  | "CAPACITY"
  | "EDITION"
  | "REGION"
  | "PLATFORM"
  | "SHOE_SIZE"
  | "APPAREL_SIZE"
  | "WIDTH"
  | "CONDITION"
  | "BUNDLE_QTY"
  | "PACKAGE_COUNT"
  | "MODEL_REVISION"
  | "CUSTOM";

export interface CanonicalVariantAttribute {
  axis: CanonicalVariantAxis;
  value: string;
}

export interface CanonicalProductVariant {
  attributes: CanonicalVariantAttribute[];
}

export interface CanonicalProductImage {
  url?: string;
  kind: "PRIMARY" | "GALLERY" | "DEFECT" | "PACKAGING" | "LABEL" | "OTHER";
}

export interface CanonicalProductCategory {
  path: string[];
  leaf: string;
}

export interface CanonicalProductSource {
  kind: "SCAN" | "OCR" | "IMAGE_MATCH" | "MANUAL" | "CATALOG" | "IMPORT" | "AI_ENRICHMENT";
  ref: string;
}

/** Local mirror of `@primeopp/contracts`' `Product` — see file header. */
export interface CanonicalProduct {
  id: string;
  kind: CanonicalProductKind;
  title: string;
  description?: string;
  category?: CanonicalProductCategory;
  images: CanonicalProductImage[];
  variants: CanonicalProductVariant[];
  source: CanonicalProductSource;
  archived?: boolean;
}

/**
 * Price is never part of the canonical `Product` (it comes from a separate
 * pricing engine — see the contract doc). Callers that have a price
 * available (e.g. from a pricing-engine result) supply it alongside the
 * canonical product; the adapter never invents one.
 */
export interface CanonicalProductPriceInput {
  productId: string;
  price: number;
}

// ---------------------------------------------------------------------------
// Live `products` table row shape (destination)
// ---------------------------------------------------------------------------

export type LiveProductType = "pod" | "affiliate";

export interface LiveProductColor {
  name: string;
  hex: string | null;
  price: number | null;
}

/** Row shape this adapter plans to write — matches lib/db/migrations/0001_base_schema.sql. */
export interface LiveProductRow {
  type: LiveProductType;
  title: string;
  description: string | null;
  price: number | null;
  category: string | null;
  thumbnail_url: string | null;
  external_link: string | null;
  stock_level: number | null;
  shipping_info: string | null;
  colors: LiveProductColor[];
  sizes: string[];
  pod_provider: null;
  printful_variant_id: null;
  tapstitch_variant_id: null;
}

/** A minimal existing-row lookup used only for the (title, type) dedupe heuristic. */
export interface ExistingLiveProductRow {
  id: number;
  title: string;
  type: LiveProductType;
}

// ---------------------------------------------------------------------------
// Import plan
// ---------------------------------------------------------------------------

export type ImportAction = "insert" | "update" | "skip" | "error";

export interface ImportPlanEntry {
  canonicalProductId: string;
  action: ImportAction;
  reason?: string;
  matchedExistingId?: number;
  row?: LiveProductRow;
  warnings: string[];
}

export interface ImportPlanSummary {
  total: number;
  insert: number;
  update: number;
  skip: number;
  error: number;
  entries: ImportPlanEntry[];
}
