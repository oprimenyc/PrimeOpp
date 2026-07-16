/**
 * FixtureProductProvider — deterministic local provider backed by JSON
 * fixtures.
 *
 * This provider is the primary VERIFIED provider used by tests. It supports:
 *   - BARCODE_LOOKUP: lookup by GTIN/UPC/EAN
 *   - ISBN_LOOKUP: lookup by ISBN
 *   - BRAND_MODEL_SEARCH: lookup by brand + model
 *   - TEXT_SEARCH: lookup by title
 *
 * Fixture format (see /fixtures/*.json):
 *   {
 *     "id": "fixture-electronics-001",
 *     "matchBy": { "gtin": "036000291452" },
 *     "confidence": 0.95,
 *     "exactMatch": true,
 *     "fields": { "identity.brand": "Sony", ... },
 *     "images": [ { "url": "https://...", "isPrimary": true } ]
 *   }
 */

import type { ProductEnrichmentInput } from "../contracts/input";
import type {
  EnrichmentContext,
  EnrichmentProviderCapability,
  ProductEnrichmentProvider,
  ProviderEnrichmentResult,
  FieldCandidate,
  ImageCandidate,
} from "../contracts/provider";
import { isBarcodeIdentifier, isIsbnIdentifier } from "../domain/identifier";

export interface FixtureRecord {
  id: string;
  matchBy: {
    gtin?: string;
    upc?: string;
    ean?: string;
    isbn?: string;
    sku?: string;
    brand?: string;
    model?: string;
    title?: string;
  };
  confidence: number;
  exactMatch?: boolean;
  fields: Record<string, unknown>;
  images?: ImageCandidate[];
  externalReference?: string;
  rawReferenceId?: string;
}

export interface FixtureProviderConfig {
  /** Provider ID. Defaults to "fixture". */
  id?: string;
  /** Static priority (lower = higher priority). Defaults to 10. */
  priority?: number;
  /** Fixture records to serve. */
  records: FixtureRecord[];
}

export class FixtureProductProvider implements ProductEnrichmentProvider {
  readonly id: string;
  readonly capabilities: EnrichmentProviderCapability[] = [
    "BARCODE_LOOKUP",
    "ISBN_LOOKUP",
    "BRAND_MODEL_SEARCH",
    "TEXT_SEARCH",
    "CATEGORY_RESOLUTION",
    "ATTRIBUTE_ENRICHMENT",
    "IMAGE_DISCOVERY",
  ];
  private readonly priority: number;
  private readonly records: FixtureRecord[];

  constructor(config: FixtureProviderConfig) {
    this.id = config.id ?? "fixture";
    this.priority = config.priority ?? 10;
    this.records = config.records;
  }

  async canHandle(input: ProductEnrichmentInput): Promise<boolean> {
    if (input.identifier && input.identifier.isValidFormat) {
      return true;
    }
    const mp = input.manualProduct;
    if (mp && (mp.title || mp.brand || mp.model)) {
      return true;
    }
    return false;
  }

  async enrich(
    input: ProductEnrichmentInput,
    _context: EnrichmentContext
  ): Promise<ProviderEnrichmentResult> {
    const retrievedAt = new Date().toISOString();
    const match = this.findMatch(input);
    if (!match) {
      return {
        providerId: this.id,
        found: false,
        confidence: 0,
        candidates: [],
        retrievedAt,
        error: { code: "NOT_FOUND", message: "No fixture match", retryable: false },
      };
    }

    const candidates: FieldCandidate[] = [];
    for (const [field, value] of Object.entries(match.fields)) {
      if (value === undefined || value === null) continue;
      candidates.push({
        field,
        value,
        normalizedValue: value,
        providerId: this.id,
        sourceConfidence: match.confidence,
        providerPriority: this.priority,
        evidence: {
          exactMatch: match.exactMatch === true,
          fixtureId: match.id,
        },
      });
    }

    // Auto-emit identifier candidate(s) when the match was via identifier.
    // This lets fixtures omit `identifiers.gtin` from their `fields` block
    // without losing the identifier on the final profile.
    //
    // For GS1-family barcodes we emit BOTH the specific bucket (upc/ean)
    // AND the general `identifiers.gtin` bucket, because UPC/EAN are
    // subsets of GTIN and downstream systems often query the GTIN bucket
    // regardless of subtype.
    const id = input.identifier;
    if (id && id.isValidFormat) {
      if (isBarcodeIdentifier(id.identifierType)) {
        const isUpc =
          id.identifierType === "UPC_A" ||
          id.identifierType === "UPC_E" ||
          id.identifierType === "GTIN_12";
        const isEan =
          id.identifierType === "EAN_8" || id.identifierType === "EAN_13";

        const buckets: string[] = ["identifiers.gtin"];
        if (isUpc) buckets.push("identifiers.upc");
        if (isEan) buckets.push("identifiers.ean");

        for (const bucket of buckets) {
          if (!candidates.some((c) => c.field === bucket)) {
            candidates.push({
              field: bucket,
              value: id.normalizedValue,
              normalizedValue: id.normalizedValue,
              providerId: this.id,
              sourceConfidence: 1.0,
              providerPriority: this.priority,
              evidence: {
                exactMatch: true,
                fixtureId: match.id,
                identifierMatch: true,
              },
            });
          }
        }
      } else if (isIsbnIdentifier(id.identifierType)) {
        if (!candidates.some((c) => c.field === "identifiers.isbn")) {
          candidates.push({
            field: "identifiers.isbn",
            value: id.normalizedValue,
            normalizedValue: id.normalizedValue,
            providerId: this.id,
            sourceConfidence: 1.0,
            providerPriority: this.priority,
            evidence: {
              exactMatch: true,
              fixtureId: match.id,
              identifierMatch: true,
            },
          });
        }
      } else if (id.identifierType === "SKU") {
        if (!candidates.some((c) => c.field === "identifiers.sku")) {
          candidates.push({
            field: "identifiers.sku",
            value: id.normalizedValue,
            normalizedValue: id.normalizedValue,
            providerId: this.id,
            sourceConfidence: 0.7,
            providerPriority: this.priority,
            evidence: {
              exactMatch: true,
              fixtureId: match.id,
              identifierMatch: true,
            },
          });
        }
      }
    }

    return {
      providerId: this.id,
      found: true,
      confidence: match.confidence,
      candidates,
      images: match.images,
      externalReference: match.externalReference ?? match.id,
      rawReferenceId: match.rawReferenceId ?? match.id,
      retrievedAt,
    };
  }

  private findMatch(input: ProductEnrichmentInput): FixtureRecord | undefined {
    const id = input.identifier;
    const mp = input.manualProduct;

    // 1. Identifier exact match
    if (id && id.isValidFormat) {
      const norm = id.normalizedValue;
      if (isBarcodeIdentifier(id.identifierType)) {
        for (const r of this.records) {
          const candidates = [r.matchBy.gtin, r.matchBy.upc, r.matchBy.ean].filter(Boolean) as string[];
          if (candidates.includes(norm)) return r;
        }
      }
      if (isIsbnIdentifier(id.identifierType)) {
        for (const r of this.records) {
          if (r.matchBy.isbn && r.matchBy.isbn.replace(/[^0-9Xx]/g, "").toUpperCase() === norm) {
            return r;
          }
        }
      }
      if (id.identifierType === "SKU") {
        for (const r of this.records) {
          if (r.matchBy.sku && r.matchBy.sku.toLowerCase() === norm.toLowerCase()) {
            return r;
          }
        }
      }
    }

    // 2. Brand + model match
    if (mp?.brand && mp?.model) {
      const brandLower = mp.brand.toLowerCase();
      const modelUpper = mp.model.toUpperCase();
      for (const r of this.records) {
        if (
          r.matchBy.brand &&
          r.matchBy.model &&
          r.matchBy.brand.toLowerCase() === brandLower &&
          r.matchBy.model.toUpperCase() === modelUpper
        ) {
          return r;
        }
      }
    }

    // 3. Title contains match (loose)
    if (mp?.title) {
      const titleLower = mp.title.toLowerCase();
      for (const r of this.records) {
        if (r.matchBy.title && titleLower.includes(r.matchBy.title.toLowerCase())) {
          return r;
        }
      }
    }

    return undefined;
  }
}
