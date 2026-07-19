/**
 * Intake -> Enrichment reconciliation adapter.
 *
 * `primeopp-product-intake` and `primeopp-product-enrichment` are separate
 * clean-room modules (see INTEGRATION.md section 2). Each defines its own
 * structural contracts so neither package depends on the other's source.
 * This adapter is the host-side bridge described in INTEGRATION.md: it
 * converts an intake module's output record into this module's
 * `ProductEnrichmentInput`, using a locally-declared structural type that
 * mirrors `ProductIntakeRecord` rather than importing it.
 */

import type { ManualProductEntry, ProductEnrichmentInput, ProductIdentifier } from "../contracts/input";
import { InvalidInputError } from "../errors";

/**
 * Mirrors `IntakeStatus` from primeopp-product-intake. Only `ACCEPTED` and
 * `NEEDS_REVIEW` records are eligible for enrichment (see INTEGRATION.md,
 * "Downstream Module Handoff Contract").
 */
export type IntakeHandoffStatus = "ACCEPTED" | "REJECTED" | "DUPLICATE" | "NEEDS_REVIEW";

/**
 * Mirrors `NormalizedProductIdentifier` from primeopp-product-intake, minus
 * the classification-only fields (`confidence`, `ambiguityNote`,
 * `alternativeTypes`) that enrichment does not consume.
 */
export interface IntakeHandoffIdentifier {
  rawValue: string;
  normalizedValue: string;
  identifierType: ProductIdentifier["identifierType"];
  isValidFormat: boolean;
  checksumValid?: boolean;
}

/** Mirrors `ManualProductData` from primeopp-product-intake. */
export interface IntakeHandoffManualProduct {
  title?: string;
  brand?: string;
  model?: string;
  category?: string;
  description?: string;
  [key: string]: unknown;
}

/** Mirrors the fields of `ProductIntakeRecord` this adapter needs. */
export interface IntakeHandoffRecord {
  intakeId: string;
  status: IntakeHandoffStatus;
  identifier?: IntakeHandoffIdentifier;
  manualProduct?: IntakeHandoffManualProduct;
  sourceContext?: Record<string, unknown>;
}

/**
 * True when the intake record's status permits enrichment, per the
 * downstream handoff contract: only `ACCEPTED` and `NEEDS_REVIEW` records
 * should be routed to enrichment; `REJECTED` and `DUPLICATE` are ignored.
 */
export function isEnrichmentEligible(record: IntakeHandoffRecord): boolean {
  return record.status === "ACCEPTED" || record.status === "NEEDS_REVIEW";
}

/**
 * Convert an intake module output record into this module's
 * `ProductEnrichmentInput`.
 *
 * Throws `InvalidInputError` for `REJECTED` / `DUPLICATE` records rather
 * than silently producing an enrichment input for them — callers must check
 * `isEnrichmentEligible()` (or catch this error) before invoking enrichment.
 */
export function toEnrichmentInput(record: IntakeHandoffRecord): ProductEnrichmentInput {
  if (!isEnrichmentEligible(record)) {
    throw new InvalidInputError(
      `intake record ${record.intakeId} has status ${record.status}; only ACCEPTED and NEEDS_REVIEW records are eligible for enrichment`,
      { intakeId: record.intakeId, status: record.status }
    );
  }

  const identifier: ProductIdentifier | undefined = record.identifier
    ? {
        rawValue: record.identifier.rawValue,
        normalizedValue: record.identifier.normalizedValue,
        identifierType: record.identifier.identifierType,
        isValidFormat: record.identifier.isValidFormat,
        ...(record.identifier.checksumValid !== undefined
          ? { checksumValid: record.identifier.checksumValid }
          : {}),
      }
    : undefined;

  const manualProduct: ManualProductEntry | undefined = record.manualProduct
    ? {
        ...(record.manualProduct.title !== undefined ? { title: record.manualProduct.title } : {}),
        ...(record.manualProduct.brand !== undefined ? { brand: record.manualProduct.brand } : {}),
        ...(record.manualProduct.model !== undefined ? { model: record.manualProduct.model } : {}),
        ...(record.manualProduct.category !== undefined ? { category: record.manualProduct.category } : {}),
        ...(record.manualProduct.description !== undefined
          ? { description: record.manualProduct.description }
          : {}),
        ...(typeof record.manualProduct.mpn === "string" ? { mpn: record.manualProduct.mpn } : {}),
        ...(typeof record.manualProduct.color === "string" ? { color: record.manualProduct.color } : {}),
        ...(typeof record.manualProduct.size === "string" ? { size: record.manualProduct.size } : {}),
      }
    : undefined;

  return {
    intakeId: record.intakeId,
    ...(identifier ? { identifier } : {}),
    ...(manualProduct ? { manualProduct } : {}),
    ...(record.sourceContext ? { sourceContext: record.sourceContext } : {}),
  };
}
