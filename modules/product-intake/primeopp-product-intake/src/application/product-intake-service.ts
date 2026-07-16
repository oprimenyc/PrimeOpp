/**
 * Product Intake Service — the primary orchestration engine.
 *
 * Pipeline:
 *   1. Input normalization (clean whitespace, separators)
 *   2. Identifier detection and classification
 *   3. Validation (format, checksum, structure)
 *   4. Duplicate detection (session-scoped)
 *   5. Record creation
 *   6. Persistence through abstractions
 *   7. Result return
 *
 * This service is framework-independent and can be used from any host.
 */

import type {
  RawProductInput,
  ProductIntakeRecord,
  BatchProductIntakeRequest,
  BatchProductIntakeResult,
  IntakeDeduplicationStore,
  IntakeRecordRepository,
  ValidationIssue,
} from "../types/index.js";

import { normalizeInput } from "../normalization/index.js";
import { analyzeIdentifier } from "../domain/identifier-detector.js";
import {
  generateProductFingerprint,
  validateManualProductMinimum,
} from "../domain/fingerprint.js";
import { processBatch } from "../batch/index.js";
import { makeIssue } from "../validation/index.js";

// ---------------------------------------------------------------------------
// Service Configuration
// ---------------------------------------------------------------------------

export interface ProductIntakeServiceConfig {
  deduplicationStore: IntakeDeduplicationStore;
  recordRepository?: IntakeRecordRepository;
  /** Generate unique intake IDs. Defaults to crypto.randomUUID(). */
  idGenerator?: () => string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ProductIntakeService {
  private readonly dedup: IntakeDeduplicationStore;
  private readonly repo: IntakeRecordRepository | undefined;
  private readonly generateId: () => string;

  constructor(config: ProductIntakeServiceConfig) {
    this.dedup = config.deduplicationStore;
    this.repo = config.recordRepository;
    this.generateId = config.idGenerator ?? (() => crypto.randomUUID());
  }

  /**
   * Process a single product intake request through the full pipeline.
   */
  async intake(input: RawProductInput): Promise<ProductIntakeRecord> {
    const issues: ValidationIssue[] = [];
    const intakeId = this.generateId();
    const createdAt = new Date().toISOString();

    // --- Step 1: Normalize input ---
    const normalized = normalizeInput(input);
    issues.push(...normalized.issues);

    // --- Determine if this is identifier-based or manual-product-based ---
    const hasIdentifier = normalized.cleanedIdentifier !== undefined;
    const hasManualProduct = normalized.manualProduct !== undefined;

    if (!hasIdentifier && !hasManualProduct) {
      // Nothing to process
      return this.createRecord({
        intakeId,
        createdAt,
        inputMethod: input.inputMethod,
        status: "REJECTED",
        validationIssues: [
          ...issues,
          makeIssue("NO_INPUT_DATA", "No identifier or manual product data provided.", "ERROR"),
        ],
        sourceContext: input.sourceContext,
      });
    }

    // --- Step 2: Manual product minimum validation ---
    if (hasManualProduct && !hasIdentifier) {
      const sufficient = validateManualProductMinimum(normalized.manualProduct!);
      if (!sufficient) {
        return this.createRecord({
          intakeId,
          createdAt,
          inputMethod: input.inputMethod,
          manualProduct: normalized.manualProduct,
          status: "REJECTED",
          validationIssues: [
            ...issues,
            makeIssue(
              "INSUFFICIENT_MANUAL_DATA",
              "Manual product entry requires at least a title, or both brand and model.",
              "ERROR",
            ),
          ],
          sourceContext: input.sourceContext,
        });
      }
    }

    // --- Step 3: Identifier analysis ---
    let identifier: ProductIntakeRecord["identifier"];

    if (hasIdentifier) {
      const analysis = analyzeIdentifier(normalized.cleanedIdentifier!);
      identifier = analysis.identifier;
      issues.push(...analysis.issues);
    }

    // --- Early rejection for critical validation failures ---
    const criticalIssues = issues.filter((i) => i.severity === "ERROR");
    const hasCriticalIdentifierError = identifier && !identifier.isValidFormat;

    // For UNKNOWN type identifiers with no manual product, reject
    if (identifier && identifier.identifierType === "UNKNOWN" && !hasManualProduct) {
      return this.createRecord({
        intakeId,
        createdAt,
        inputMethod: input.inputMethod,
        identifier,
        status: "REJECTED",
        validationIssues: [
          ...issues,
          makeIssue(
            "UNRECOGNIZED_IDENTIFIER",
            "Identifier could not be classified into a recognized format and no manual product data was provided.",
            "ERROR",
          ),
        ],
        sourceContext: input.sourceContext,
      });
    }

    // --- Step 4: Duplicate detection ---
    if (identifier && identifier.isValidFormat !== false) {
      const existing = await this.dedup.findByIdentifier(identifier.normalizedValue);
      if (existing) {
        const record = this.createRecord({
          intakeId,
          createdAt,
          inputMethod: input.inputMethod,
          identifier,
          manualProduct: normalized.manualProduct,
          status: "DUPLICATE",
          validationIssues: [
            ...issues,
            makeIssue(
              "DUPLICATE_IDENTIFIER",
              `Duplicate identifier: same normalized value already intake'd as ${existing.intakeId}.`,
              "WARNING",
            ),
          ],
          duplicateOf: existing.intakeId,
          sourceContext: input.sourceContext,
        });
        return record;
      }
    }

    // Manual product fingerprint duplicate check
    if (hasManualProduct && !hasIdentifier) {
      const { fingerprint } = generateProductFingerprint(normalized.manualProduct!);
      if (fingerprint) {
        const existing = await this.dedup.findByFingerprint(fingerprint);
        if (existing) {
          const record = this.createRecord({
            intakeId,
            createdAt,
            inputMethod: input.inputMethod,
            manualProduct: normalized.manualProduct,
            status: "DUPLICATE",
            validationIssues: [
              ...issues,
              makeIssue(
                "DUPLICATE_FINGERPRINT",
                `Duplicate manual product fingerprint matches ${existing.intakeId}.`,
                "WARNING",
              ),
            ],
            duplicateOf: existing.intakeId,
            sourceContext: input.sourceContext,
          });
          return record;
        }
      }
    }

    // --- Step 5: Determine final status ---
    let status: ProductIntakeRecord["status"] = "ACCEPTED";

    if (criticalIssues.length > 0 || hasCriticalIdentifierError) {
      status = "NEEDS_REVIEW";
    }

    // --- Step 6: Create record ---
    const record = this.createRecord({
      intakeId,
      createdAt,
      inputMethod: input.inputMethod,
      identifier,
      manualProduct: normalized.manualProduct,
      status,
      validationIssues: issues,
      sourceContext: input.sourceContext,
    });

    // --- Step 7: Persist ---
    if (status === "ACCEPTED" || status === "NEEDS_REVIEW") {
      await this.dedup.save(record);
      if (this.repo) {
        await this.repo.save(record);
      }
    }

    return record;
  }

  /**
   * Process a batch of product intake requests.
   */
  async intakeBatch(request: BatchProductIntakeRequest): Promise<BatchProductIntakeResult> {
    return processBatch(this, request);
  }

  /**
   * Create and optionally persist a ProductIntakeRecord.
   */
  private createRecord(partial: Omit<ProductIntakeRecord, "validationIssues"> & { validationIssues: ValidationIssue[] }): ProductIntakeRecord {
    const record: ProductIntakeRecord = {
      intakeId: partial.intakeId,
      createdAt: partial.createdAt,
      inputMethod: partial.inputMethod,
      status: partial.status,
      validationIssues: partial.validationIssues,
      ...(partial.identifier !== undefined && { identifier: partial.identifier }),
      ...(partial.manualProduct !== undefined && { manualProduct: partial.manualProduct }),
      ...(partial.sourceContext !== undefined && { sourceContext: partial.sourceContext }),
      ...(partial.duplicateOf !== undefined && { duplicateOf: partial.duplicateOf }),
    };
    return record;
  }
}