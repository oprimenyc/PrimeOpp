/**
 * IsbnProductProvider — clean adapter boundary suitable for book-metadata
 * providers (e.g. Open Library, Google Books, ISBNdb).
 *
 * This file ships a contract + a fixture-backed default implementation. It
 * does NOT claim any live integration. Hosts that wish to wire a real book
 * metadata provider should:
 *   1. Implement `IsbnMetadataSource` against their chosen backend, OR
 *   2. Construct a `GenericHttpProductProvider` with a book-capable
 *      request/response mapper.
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
import { isIsbnIdentifier } from "../domain/identifier";

export interface IsbnMetadataRecord {
  isbn: string;
  title?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  categories?: string[];
  description?: string;
  pageCount?: number;
  coverImage?: string;
  confidence?: number;
}

export interface IsbnMetadataSource {
  lookup(isbn: string): Promise<IsbnMetadataRecord | null>;
}

export interface IsbnProviderConfig {
  id?: string;
  priority?: number;
  source: IsbnMetadataSource;
}

export class IsbnProductProvider implements ProductEnrichmentProvider {
  readonly id: string;
  readonly capabilities: EnrichmentProviderCapability[] = [
    "ISBN_LOOKUP",
    "ATTRIBUTE_ENRICHMENT",
    "IMAGE_DISCOVERY",
  ];
  private readonly priority: number;
  private readonly source: IsbnMetadataSource;

  constructor(config: IsbnProviderConfig) {
    this.id = config.id ?? "isbn";
    this.priority = config.priority ?? 15;
    this.source = config.source;
  }

  async canHandle(input: ProductEnrichmentInput): Promise<boolean> {
    return Boolean(
      input.identifier && isIsbnIdentifier(input.identifier.identifierType) && input.identifier.isValidFormat
    );
  }

  async enrich(
    input: ProductEnrichmentInput,
    _context: EnrichmentContext
  ): Promise<ProviderEnrichmentResult> {
    const retrievedAt = new Date().toISOString();
    const id = input.identifier;
    if (!id || !isIsbnIdentifier(id.identifierType)) {
      return {
        providerId: this.id,
        found: false,
        confidence: 0,
        candidates: [],
        retrievedAt,
        error: { code: "not-applicable", message: "Input is not an ISBN.", retryable: false },
      };
    }

    let record: IsbnMetadataRecord | null;
    try {
      record = await this.source.lookup(id.normalizedValue);
    } catch (err) {
      return {
        providerId: this.id,
        found: false,
        confidence: 0,
        candidates: [],
        retrievedAt,
        error: {
          code: "isbn-source-failed",
          message: err instanceof Error ? err.message : String(err),
          retryable: true,
        },
      };
    }

    if (!record) {
      return {
        providerId: this.id,
        found: false,
        confidence: 0,
        candidates: [],
        retrievedAt,
        error: { code: "not-found", message: "ISBN not found in source.", retryable: false },
      };
    }

    const candidates: FieldCandidate[] = [];
    const conf = record.confidence ?? 0.85;

    if (record.title) {
      candidates.push({
        field: "identity.canonicalTitle",
        value: record.title,
        normalizedValue: record.title,
        providerId: this.id,
        sourceConfidence: conf,
        providerPriority: this.priority,
        evidence: { exactMatch: true },
      });
    }
    if (record.publisher) {
      candidates.push({
        field: "identity.manufacturer",
        value: record.publisher,
        normalizedValue: record.publisher,
        providerId: this.id,
        sourceConfidence: conf,
        providerPriority: this.priority,
        evidence: { exactMatch: true },
      });
    }
    if (record.description) {
      candidates.push({
        field: "description",
        value: record.description,
        normalizedValue: record.description,
        providerId: this.id,
        sourceConfidence: conf,
        providerPriority: this.priority,
      });
    }
    if (record.categories && record.categories.length > 0) {
      const primary = record.categories[0];
      candidates.push({
        field: "classification.category",
        value: primary,
        normalizedValue: primary,
        providerId: this.id,
        sourceConfidence: conf,
        providerPriority: this.priority,
      });
      candidates.push({
        field: "classification.taxonomyPath",
        value: ["Books", ...record.categories],
        normalizedValue: ["Books", ...record.categories],
        providerId: this.id,
        sourceConfidence: conf,
        providerPriority: this.priority,
      });
    }
    if (record.pageCount) {
      candidates.push({
        field: "attributes.pageCount",
        value: record.pageCount,
        normalizedValue: record.pageCount,
        providerId: this.id,
        sourceConfidence: conf,
        providerPriority: this.priority,
      });
    }
    // ISBN itself goes into the identifiers bucket.
    candidates.push({
      field: "identifiers.isbn",
      value: record.isbn,
      normalizedValue: record.isbn,
      providerId: this.id,
      sourceConfidence: 1.0,
      providerPriority: this.priority,
      evidence: { exactMatch: true },
    });
    if (record.authors && record.authors.length > 0) {
      candidates.push({
        field: "attributes.authors",
        value: record.authors,
        normalizedValue: record.authors,
        providerId: this.id,
        sourceConfidence: conf,
        providerPriority: this.priority,
      });
    }

    const images: ImageCandidate[] = [];
    if (record.coverImage) {
      images.push({ url: record.coverImage, isPrimary: true, confidence: conf });
    }

    return {
      providerId: this.id,
      found: true,
      confidence: conf,
      candidates,
      images,
      externalReference: record.isbn,
      rawReferenceId: record.isbn,
      retrievedAt,
    };
  }
}
