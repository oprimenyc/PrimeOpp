/**
 * Normalization rules for product identifiers.
 *
 * This module is responsible for taking raw input strings and producing
 * stable, canonical representations. Normalization is deterministic:
 * identical raw input always produces the same normalized output.
 *
 * Rules:
 * - Leading/trailing whitespace is trimmed.
 * - Safe separators (spaces, hyphens, dots between digit groups) are removed.
 * - Destructive transformations (e.g., dropping digits) are NEVER applied.
 * - The original raw value is preserved separately.
 */

import type { ValidationIssue, ValidationSeverity } from "../types/index.js";

// ---------------------------------------------------------------------------
// Whitespace and Separator Cleanup
// ---------------------------------------------------------------------------

/** Characters considered safe to strip from within numeric identifiers. */
const SAFE_SEPARATORS = /[\s\-\.]/g;

/** Maximum allowed length for any identifier input (protective). */
export const MAX_IDENTIFIER_LENGTH = 50;

/** Maximum allowed length for any single field in manual product data. */
export const MAX_FIELD_LENGTH = 500;

/**
 * Normalize raw identifier string: trim whitespace, remove safe separators.
 * Returns the cleaned string ready for classification.
 */
export function normalizeRawIdentifier(raw: string): string {
  const trimmed = raw.trim();
  const cleaned = trimmed.replace(SAFE_SEPARATORS, "");
  return cleaned;
}

/**
 * Trim a single field value (for manual product fields).
 */
export function normalizeField(value: string | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Check if a string is purely numeric digits.
 */
export function isNumeric(s: string): boolean {
  return /^\d+$/.test(s);
}

/**
 * Validate length constraints for identifier-like input.
 */
export function validateLength(
  value: string,
  min: number,
  max: number,
  field?: string,
): ValidationIssue | null {
  const len = value.length;
  if (len < min) {
    return {
      code: "TOO_SHORT",
      message: `Value length ${len} is below minimum ${min}.`,
      severity: "ERROR",
      field,
    };
  }
  if (len > max) {
    return {
      code: "TOO_LONG",
      message: `Value length ${len} exceeds maximum ${max}.`,
      severity: "ERROR",
      field,
    };
  }
  return null;
}

/**
 * Validate that input is non-empty after trimming.
 */
export function validateNonEmpty(
  value: string | undefined,
  field: string,
): ValidationIssue | null {
  if (value === undefined || value === null || value.trim().length === 0) {
    return {
      code: "EMPTY_VALUE",
      message: `Field '${field}' is required but was empty or missing.`,
      severity: "ERROR",
      field,
    };
  }
  return null;
}

/**
 * Check if value exceeds maximum allowed length.
 */
export function validateMaxLength(
  value: string,
  max: number,
  field?: string,
): ValidationIssue | null {
  if (value.length > max) {
    return {
      code: "EXCEEDS_MAX_LENGTH",
      message: `Field '${field ?? "value"}' length ${value.length} exceeds maximum ${max}.`,
      severity: "ERROR",
      field,
    };
  }
  return null;
}

/**
 * Validate that a value is purely numeric.
 */
export function validateNumeric(value: string, field?: string): ValidationIssue | null {
  if (!isNumeric(value)) {
    return {
      code: "NOT_NUMERIC",
      message: `Value contains non-numeric characters.`,
      severity: "ERROR",
      field,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Checksum Validation
// ---------------------------------------------------------------------------

/**
 * Validate GTIN-compatible checksum (used by UPC-A, EAN-13, GTIN-8, GTIN-12, GTIN-13, GTIN-14).
 *
 * Algorithm (GS1 standard):
 * Counting from the RIGHT (excluding check digit), alternating weights 3 and 1.
 * Equivalently from the LEFT: the weight pattern depends on total code length.
 *   - Odd total length (8, 13): left-odd positions get weight 1, left-even get weight 3.
 *   - Even total length (12, 14): left-odd positions get weight 3, left-even get weight 1.
 */
export function validateGtinChecksum(digits: string): boolean {
  if (!/^\d+$/.test(digits) || digits.length < 8) return false;

  const totalLength = digits.length;
  const dataDigits = digits.slice(0, -1); // everything except check digit
  const checkDigit = parseInt(digits[totalLength - 1]!, 10);

  // For odd-length codes (8, 13): odd positions from left → weight 1
  // For even-length codes (12, 14): odd positions from left → weight 3
  const oddWeight = totalLength % 2 === 1 ? 1 : 3;
  const evenWeight = totalLength % 2 === 1 ? 3 : 1;

  let sum = 0;
  for (let i = 0; i < dataDigits.length; i++) {
    const digit = parseInt(dataDigits[i]!, 10);
    const weight = (i + 1) % 2 === 1 ? oddWeight : evenWeight;
    sum += digit * weight;
  }

  const expectedCheck = (10 - (sum % 10)) % 10;
  return checkDigit === expectedCheck;
}

/**
 * Validate ISBN-10 checksum.
 *
 * The check digit is the last character. For digits 0-8 it's the weighted sum
 * mod 11. 'X' represents 10.
 */
export function validateIsbn10Checksum(isbn: string): boolean {
  if (isbn.length !== 10) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const ch = isbn[i]!;
    if (!/^\d$/.test(ch)) return false;
    sum += parseInt(ch, 10) * (10 - i);
  }

  const checkChar = isbn[9]!.toUpperCase();
  let checkValue: number;
  if (checkChar === "X") {
    checkValue = 10;
  } else if (/^\d$/.test(checkChar)) {
    checkValue = parseInt(checkChar, 10);
  } else {
    return false;
  }

  return (sum + checkValue) % 11 === 0;
}

/**
 * Validate ISBN-13 checksum (same as GTIN/EAN-13 checksum).
 */
export function validateIsbn13Checksum(isbn: string): boolean {
  return isbn.length === 13 && validateGtinChecksum(isbn);
}

// ---------------------------------------------------------------------------
// Issue factory helpers
// ---------------------------------------------------------------------------

export function makeIssue(
  code: string,
  message: string,
  severity: ValidationSeverity,
  field?: string,
): ValidationIssue {
  return { code, message, severity, field };
}