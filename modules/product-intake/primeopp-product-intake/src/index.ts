/**
 * primeopp-product-intake
 *
 * Standalone, portable module for converting barcode scans, typed identifiers,
 * or manual product entry into normalized, validated product-intake records.
 *
 * This is the first module in the PrimeOpp commerce-intelligence pipeline:
 *   SCAN / INPUT → IDENTIFY → NORMALIZE → PREPARE FOR ENRICHMENT
 */

// --- Types (stable contracts for downstream consumers) ---
export type {
  ProductIdentifierType,
  InputMethod,
  ValidationSeverity,
  ValidationIssue,
  ManualProductData,
  RawProductInput,
  BatchProductIntakeRequest,
  ClassificationConfidence,
  NormalizedProductIdentifier,
  IntakeStatus,
  ProductIntakeRecord,
  BatchProductIntakeResult,
  ScannerEvent,
  IntakeDeduplicationStore,
  IntakeRecordRepository,
  ProductFingerprint,
} from "./types/index.js";

// --- Application Service ---
export { ProductIntakeService } from "./application/index.js";
export type { ProductIntakeServiceConfig } from "./application/index.js";

// --- Domain ---
export {
  classifyIdentifier,
  analyzeIdentifier,
  generateProductFingerprint,
  validateManualProductMinimum,
} from "./domain/index.js";

// --- Validation ---
export {
  normalizeRawIdentifier,
  normalizeField,
  isNumeric,
  validateGtinChecksum,
  validateIsbn10Checksum,
  validateIsbn13Checksum,
  validateLength,
  validateNonEmpty,
  validateMaxLength,
  validateNumeric,
  makeIssue,
  MAX_IDENTIFIER_LENGTH,
  MAX_FIELD_LENGTH,
} from "./validation/index.js";

// --- Normalization ---
export { normalizeInput } from "./normalization/index.js";
export type { NormalizedInput } from "./normalization/index.js";

// --- Deduplication ---
export { InMemoryDeduplicationStore } from "./deduplication/index.js";

// --- Adapters ---
export {
  InMemoryIntakeRecordRepository,
  scannerEventToInput,
  hardwareScannerStringToEvent,
  cameraScanToEvent,
  apiSubmissionToInput,
} from "./adapters/index.js";

// --- Batch ---
export { processBatch } from "./batch/index.js";

// --- Errors ---
export {
  IntakeError,
  InvalidInputError,
  DuplicateIntakeError,
  AdapterError,
  UnsupportedInputError,
  InternalIntakeError,
} from "./errors/index.js";