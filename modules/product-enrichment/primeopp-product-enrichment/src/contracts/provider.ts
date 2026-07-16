import type { ProductEnrichmentInput } from "./input";

/**
 * Provider capability taxonomy. Each provider declares which capability
 * buckets it can serve. The orchestrator uses this to decide which providers
 * to consult for a given input.
 */
export type EnrichmentProviderCapability =
  | "BARCODE_LOOKUP"
  | "ISBN_LOOKUP"
  | "TEXT_SEARCH"
  | "BRAND_MODEL_SEARCH"
  | "CATEGORY_RESOLUTION"
  | "ATTRIBUTE_ENRICHMENT"
  | "IMAGE_DISCOVERY";

/**
 * Provider-declared execution context. The orchestrator passes this to
 * `Provider.enrich()` so that providers can read timeouts, hints, and
 * feature flags without coupling to internal orchestrator state.
 */
export interface EnrichmentContext {
  /** Per-call timeout in milliseconds for this provider. */
  timeoutMs: number;
  /** Whether to include images in the response. */
  includeImages: boolean;
  /** Arbitrary hints forwarded from `EnrichmentOptions.hints`. */
  hints?: Record<string, unknown>;
  /** Host-supplied logger. Providers should treat it as opaque. */
  log?: (level: "info" | "warn" | "error", message: string, meta?: unknown) => void;
}

/**
 * A single candidate field contribution. The resolution engine compares
 * candidates rather than blindly accepting the first provider's value.
 */
export interface FieldCandidate<T = unknown> {
  /** Dotted field path (e.g. "identity.brand"). */
  field: string;
  /** Raw value from the provider. */
  value: T;
  /** Normalized value (post normalization layer). */
  normalizedValue?: unknown;
  /** Provider that contributed this candidate. */
  providerId: string;
  /** Provider-declared confidence for this candidate, 0.0 - 1.0. */
  sourceConfidence: number;
  /** Static priority assigned at registration. Lower number = higher priority. */
  providerPriority: number;
  /** Optional evidence bag (redacted). */
  evidence?: Record<string, unknown>;
}

/**
 * Image candidate emitted by a provider. Subject to deduplication and
 * primary-image selection by the merging layer.
 */
export interface ImageCandidate {
  url: string;
  width?: number;
  height?: number;
  isPrimary?: boolean;
  confidence?: number;
}

/**
 * Structured result returned by a provider. The orchestrator collects these
 * into a candidate pool and then runs normalization + resolution.
 */
export interface ProviderEnrichmentResult {
  providerId: string;
  /** Whether the provider returned a usable record. */
  found: boolean;
  /** Provider-declared overall confidence for the record, 0.0 - 1.0. */
  confidence: number;
  /** Field candidates contributed by this provider. */
  candidates: FieldCandidate[];
  /** Image candidates contributed by this provider. */
  images?: ImageCandidate[];
  /** Stable external reference (e.g. provider's product ID). */
  externalReference?: string;
  /** Bounded raw reference ID (max 256 chars). */
  rawReferenceId?: string;
  /**
   * If the provider encountered a recoverable error, it returns `found=false`
   * and populates `error`. The orchestrator treats this as provider-local
   * failure and continues with other providers.
   */
  error?: {
    code: string;
    message: string;
    /** Whether the error is retryable. */
    retryable: boolean;
  };
  /** ISO-8601 UTC timestamp the provider returned the result. */
  retrievedAt: string;
}

/**
 * The provider abstraction. Implementations must be side-effect free aside
 * from I/O they explicitly perform (HTTP, file read for fixtures, etc.).
 */
export interface ProductEnrichmentProvider {
  readonly id: string;
  readonly capabilities: EnrichmentProviderCapability[];

  canHandle(input: ProductEnrichmentInput): boolean | Promise<boolean>;

  enrich(
    input: ProductEnrichmentInput,
    context: EnrichmentContext
  ): Promise<ProviderEnrichmentResult>;
}
