/**
 * Normalization facade.
 *
 * Provides the primary normalization entry point that orchestrates
 * whitespace cleanup, separator removal, and canonical representation.
 */

import type {
  RawProductInput,
  ManualProductData,
  ValidationIssue,
} from "../types/index.js";

import {
  normalizeRawIdentifier,
  normalizeField,
  MAX_IDENTIFIER_LENGTH,
  MAX_FIELD_LENGTH,
  validateNonEmpty,
  validateMaxLength,
  makeIssue,
} from "../validation/index.js";

export interface NormalizedInput {
  /** The cleaned raw identifier value (or undefined if no identifier). */
  cleanedIdentifier: string | undefined;
  /** The cleaned manual product data (or undefined). */
  manualProduct: ManualProductData | undefined;
  /** Any issues found during normalization. */
  issues: ValidationIssue[];
}

/**
 * Normalize a RawProductInput into a clean, validated intermediate form.
 *
 * This does NOT classify the identifier (that happens in the domain layer).
 * It only cleans and validates the raw input structure.
 */
export function normalizeInput(raw: RawProductInput): NormalizedInput {
  const issues: ValidationIssue[] = [];

  // --- Normalize identifier ---
  let cleanedIdentifier: string | undefined;

  if (raw.rawValue !== undefined && raw.rawValue !== null) {
    const rawStr = String(raw.rawValue);
    const emptyIssue = validateNonEmpty(rawStr, "rawValue");
    if (emptyIssue) {
      issues.push(emptyIssue);
    } else {
      cleanedIdentifier = normalizeRawIdentifier(rawStr);
      const lengthIssue = validateMaxLength(cleanedIdentifier, MAX_IDENTIFIER_LENGTH, "rawValue");
      if (lengthIssue) {
        issues.push(lengthIssue);
        cleanedIdentifier = undefined;
      }
    }
  }

  // --- Normalize manual product ---
  let manualProduct: ManualProductData | undefined;

  if (raw.manualProduct) {
    const mp = raw.manualProduct;
    const title = normalizeField(mp.title);
    const brand = normalizeField(mp.brand);
    const model = normalizeField(mp.model);
    const category = normalizeField(mp.category);
    const description = normalizeField(mp.description);

    manualProduct = {
      ...(title !== undefined && { title }),
      ...(brand !== undefined && { brand }),
      ...(model !== undefined && { model }),
      ...(category !== undefined && { category }),
      ...(description !== undefined && { description }),
    };

    // Validate field lengths
    if (title && title.length > MAX_FIELD_LENGTH) {
      issues.push(makeIssue("EXCEEDS_MAX_LENGTH", `Title exceeds ${MAX_FIELD_LENGTH} characters.`, "ERROR", "title"));
    }
    if (brand && brand.length > MAX_FIELD_LENGTH) {
      issues.push(makeIssue("EXCEEDS_MAX_LENGTH", `Brand exceeds ${MAX_FIELD_LENGTH} characters.`, "ERROR", "brand"));
    }
    if (description && description.length > MAX_FIELD_LENGTH) {
      issues.push(makeIssue("EXCEEDS_MAX_LENGTH", `Description exceeds ${MAX_FIELD_LENGTH} characters.`, "ERROR", "description"));
    }
  }

  return { cleanedIdentifier, manualProduct, issues };
}