/**
 * Public API for primeopp-product-enrichment.
 *
 * Hosts import from this barrel. Internal file paths are NOT part of the
 * stable surface even if they are technically reachable.
 */

// Errors
export {
  ProductEnrichmentError,
  InvalidInputError,
  NoProviderError,
  NotFoundError,
  ProviderTimeoutError,
  ProviderFailureError,
  MalformedProviderResponseError,
  IdentityAmbiguityError,
  InternalFailureError,
} from "./errors";
export type { EnrichmentErrorCode } from "./errors";

// Contracts
export type {
  ProductIdentifierType,
  ProductIdentifier,
  ManualProductEntry,
  ProductEnrichmentInput,
} from "./contracts/input";

export type {
  EnrichedProductProfile,
  EnrichedIdentifiers,
  EnrichedIdentity,
  EnrichedClassification,
} from "./contracts/output";

export type { EnrichmentSourceRecord } from "./contracts/source-record";
export type { NormalizedAttribute } from "./contracts/attribute";
export type { ProductImage } from "./contracts/image";

export type {
  EnrichmentProviderCapability,
  EnrichmentContext,
  FieldCandidate,
  ImageCandidate,
  ProviderEnrichmentResult,
  ProductEnrichmentProvider,
} from "./contracts/provider";

export type { EnrichmentConflict, EnrichmentConflictCandidate } from "./conflicts/types";

// Options
export type { EnrichmentOptions } from "./application/options";
export { defaultEnrichmentOptions } from "./application/options";

// Service + orchestrator
export { ProductEnrichmentService } from "./application/service";
export type { ProductServiceConfig } from "./application/service";
export { ProviderOrchestrator } from "./application/orchestrator";
export type { OrchestratorConfig, OrchestratorRunResult } from "./application/orchestrator";

// Cache
export type { ProductEnrichmentCache } from "./cache";
export { InMemoryEnrichmentCache, computeCacheKey } from "./cache";

// Providers
export { FixtureProductProvider } from "./providers/fixture-provider";
export type { FixtureRecord, FixtureProviderConfig } from "./providers/fixture-provider";
export { ManualInputProvider } from "./providers/manual-provider";
export { GenericHttpProductProvider } from "./providers/http-provider";
export type {
  HttpProviderConfig,
  HttpRequestBuilderResult,
  HttpResponseMapperResult,
} from "./providers/http-provider";
export { IsbnProductProvider } from "./providers/isbn-provider";
export type {
  IsbnMetadataRecord,
  IsbnMetadataSource,
  IsbnProviderConfig,
} from "./providers/isbn-provider";

// Domain + normalization (utility exports)
export {
  normalizeIdentifier,
  detectIdentifierType,
  computeGtinCheckDigit,
  isValidGs1Identifier,
  isValidIsbn10,
  isValidIsbn13,
  isBarcodeIdentifier,
  isIsbnIdentifier,
} from "./domain/identifier";

export {
  normalizeWhitespace,
  normalizeBrand,
  normalizeTitle,
  normalizeModel,
  normalizeManufacturer,
  normalizeCategory,
  normalizeColor,
  normalizeSize,
  normalizeDimensions,
  normalizeWeight,
  dedupeIdentifiers,
  normalizeBullets,
  dedupeImages,
  selectPrimaryImage,
  isValidUrl,
  boundString,
} from "./normalization";

// Confidence + completeness
export {
  computeOverallConfidence,
  computeIdentifierQuality,
  shouldMarkAmbiguous,
  DEFAULT_CONFIDENCE_WEIGHTS,
} from "./confidence/engine";
export type { ConfidenceWeights, ConfidenceInputs } from "./confidence/engine";
export { computeCompleteness, DEFAULT_IMPORTANT_FIELDS } from "./confidence/completeness";
export type { CompletenessResult } from "./confidence/completeness";

// Resolution
export { resolveField } from "./resolution/engine";
export type { ResolvedField, ResolutionOptions } from "./resolution/engine";
