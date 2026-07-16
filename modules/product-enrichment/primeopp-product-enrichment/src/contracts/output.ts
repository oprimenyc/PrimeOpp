/**
 * Output contracts for primeopp-product-enrichment.
 */

import type { EnrichmentConflict } from "../conflicts/types";
import type { EnrichmentSourceRecord } from "./source-record";
import type { NormalizedAttribute } from "./attribute";
import type { ProductImage } from "./image";

/**
 * Identifier bucket. Each bucket is a de-duplicated list of normalized
 * identifier strings. Multiple GTINs are kept when they refer to different
 * packaging levels of the same product.
 */
export interface EnrichedIdentifiers {
  upc?: string[];
  ean?: string[];
  gtin?: string[];
  isbn?: string[];
  sku?: string[];
  mpn?: string[];
}

/**
 * Resolved identity fields. These are the highest-confidence canonical
 * values after candidate resolution.
 */
export interface EnrichedIdentity {
  canonicalTitle?: string;
  brand?: string;
  manufacturer?: string;
  model?: string;
}

/**
 * Resolved classification. `taxonomyPath` is an ordered list from broadest
 * to narrowest (e.g. ["Electronics", "Audio", "Headphones", "Over-Ear"]).
 */
export interface EnrichedClassification {
  category?: string;
  subcategory?: string;
  taxonomyPath?: string[];
}

/**
 * Top-level enriched product profile produced by the module.
 *
 * The shape is intentionally stable so that downstream modules
 * (resolve / confidence / comps) can rely on it.
 */
export interface EnrichedProductProfile {
  enrichmentId: string;
  intakeId?: string;

  identifiers: EnrichedIdentifiers;

  identity: EnrichedIdentity;

  classification: EnrichedClassification;

  attributes: Record<string, NormalizedAttribute>;

  description?: string;

  bullets?: string[];

  media: {
    images: ProductImage[];
  };

  sources: EnrichmentSourceRecord[];

  conflicts: EnrichmentConflict[];

  confidence: {
    /** Overall operational confidence in 0.0 - 1.0. */
    overall: number;
    /** Per-field confidence scores in 0.0 - 1.0. */
    fieldScores: Record<string, number>;
  };

  completeness: {
    /** Completeness score in 0.0 - 1.0. */
    score: number;
    /** Field names from the configured important-fields list that are missing. */
    missingFields: string[];
  };

  status:
    | "ENRICHED"
    | "PARTIAL"
    | "AMBIGUOUS"
    | "NOT_FOUND"
    | "FAILED";

  createdAt: string;
}
