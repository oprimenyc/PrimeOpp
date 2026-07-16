/**
 * Core domain types for the PrimeOpp Product Intake module.
 *
 * These contracts define the stable interface that downstream PrimeOpp modules
 * (enrichment, comps, profit engine, listing generator) will consume.
 */

// ---------------------------------------------------------------------------
// Identifier Types
// ---------------------------------------------------------------------------

export type ProductIdentifierType =
  | "UPC_A"
  | "UPC_E"
  | "EAN_8"
  | "EAN_13"
  | "GTIN_8"
  | "GTIN_12"
  | "GTIN_13"
  | "GTIN_14"
  | "ISBN_10"
  | "ISBN_13"
  | "SKU"
  | "UNKNOWN";

export type InputMethod =
  | "CAMERA_SCAN"
  | "HARDWARE_SCANNER"
  | "MANUAL_IDENTIFIER"
  | "MANUAL_PRODUCT"
  | "BATCH_IMPORT"
  | "API";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type ValidationSeverity = "INFO" | "WARNING" | "ERROR";

export interface ValidationIssue {
  code: string;
  message: string;
  severity: ValidationSeverity;
  field?: string;
}

// ---------------------------------------------------------------------------
// Input Contracts
// ---------------------------------------------------------------------------

export interface ManualProductData {
  title?: string;
  brand?: string;
  model?: string;
  category?: string;
  description?: string;
  [key: string]: unknown;
}

export interface RawProductInput {
  rawValue?: string;
  inputMethod: InputMethod;
  manualProduct?: ManualProductData;
  sourceContext?: Record<string, unknown>;
}

export interface BatchProductIntakeRequest {
  items: RawProductInput[];
}

// ---------------------------------------------------------------------------
// Normalized Identifier
// ---------------------------------------------------------------------------

export type ClassificationConfidence =
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "AMBIGUOUS";

export interface NormalizedProductIdentifier {
  rawValue: string;
  normalizedValue: string;
  identifierType: ProductIdentifierType;
  isValidFormat: boolean;
  checksumValid?: boolean;
  confidence: ClassificationConfidence;
  /** Notes about ambiguity when classification is not HIGH. */
  ambiguityNote?: string;
  /** Other types that this identifier could also match. */
  alternativeTypes?: ProductIdentifierType[];
}

// ---------------------------------------------------------------------------
// Intake Record (output contract)
// ---------------------------------------------------------------------------

export type IntakeStatus =
  | "ACCEPTED"
  | "REJECTED"
  | "DUPLICATE"
  | "NEEDS_REVIEW";

export interface ProductIntakeRecord {
  intakeId: string;
  createdAt: string;
  inputMethod: InputMethod;
  identifier?: NormalizedProductIdentifier;
  manualProduct?: ManualProductData;
  status: IntakeStatus;
  validationIssues: ValidationIssue[];
  sourceContext?: Record<string, unknown>;
  /** The intakeId of the original record if this was detected as a duplicate. */
  duplicateOf?: string;
}

// ---------------------------------------------------------------------------
// Batch Result
// ---------------------------------------------------------------------------

export interface BatchProductIntakeResult {
  batchId: string;
  createdAt: string;
  totalReceived: number;
  accepted: number;
  rejected: number;
  duplicates: number;
  needsReview: number;
  items: ProductIntakeRecord[];
}

// ---------------------------------------------------------------------------
// Scanner Adapter Contracts
// ---------------------------------------------------------------------------

export interface ScannerEvent {
  value: string;
  symbology?: string;
  capturedAt: string;
  deviceId?: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Deduplication Store Contract
// ---------------------------------------------------------------------------

export interface IntakeDeduplicationStore {
  findByIdentifier(normalizedValue: string): Promise<ProductIntakeRecord | undefined>;
  findByFingerprint(fingerprint: string): Promise<ProductIntakeRecord | undefined>;
  save(record: ProductIntakeRecord): Promise<void>;
  clear?(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Intake Repository Contract (persistence abstraction)
// ---------------------------------------------------------------------------

export interface IntakeRecordRepository {
  save(record: ProductIntakeRecord): Promise<void>;
  findById(intakeId: string): Promise<ProductIntakeRecord | undefined>;
  findAll(): Promise<ProductIntakeRecord[]>;
}

// ---------------------------------------------------------------------------
// Fingerprint
// ---------------------------------------------------------------------------

export interface ProductFingerprint {
  fingerprint: string;
  fieldsUsed: string[];
}