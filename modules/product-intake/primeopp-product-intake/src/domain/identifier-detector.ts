/**
 * Deterministic identifier detection and classification.
 *
 * This module takes a cleaned (normalized) numeric or alphanumeric string
 * and classifies it into a ProductIdentifierType. Because several GTIN-based
 * formats share the same structure, classification uses length-based rules
 * with documented ambiguity handling.
 *
 * Classification priority (when lengths overlap):
 *   8 digits  → EAN_8 / GTIN_8 (synonymous; we report EAN_8)
 *   12 digits → UPC_A / GTIN_12 (we report UPC_A; GTIN_12 as alternative)
 *   13 digits → EAN_13 / GTIN_13 / ISBN_13 (heuristic below)
 *   10 chars  → ISBN_10 (if passes checksum) or UNKNOWN
 *
 * Ambiguity is explicitly noted in the result.
 */

import type {
  ProductIdentifierType,
  ClassificationConfidence,
  NormalizedProductIdentifier,
  ValidationIssue,
} from "../types/index.js";

import {
  isNumeric,
  validateGtinChecksum,
  validateIsbn10Checksum,
  validateIsbn13Checksum,
  makeIssue,
} from "../validation/index.js";

// ---------------------------------------------------------------------------
// Internal classification result
// ---------------------------------------------------------------------------

interface ClassificationResult {
  type: ProductIdentifierType;
  confidence: ClassificationConfidence;
  ambiguityNote?: string;
  alternativeTypes?: ProductIdentifierType[];
}

// ---------------------------------------------------------------------------
// ISBN-10 heuristic
// ---------------------------------------------------------------------------

const ISBN_10_REGEX = /^\d{9}[\dXx]$/;

function isLikelyIsbn10(value: string): boolean {
  return ISBN_10_REGEX.test(value);
}

// ---------------------------------------------------------------------------
// Classification engine
// ---------------------------------------------------------------------------

/**
 * Classify a cleaned identifier string into a ProductIdentifierType.
 *
 * Returns the primary type, confidence level, and any ambiguity notes.
 */
export function classifyIdentifier(value: string): ClassificationResult {
  const len = value.length;
  const numeric = isNumeric(value);

  // --- ISBN-10 (special: may contain X check digit) ---
  if (len === 10) {
    if (isLikelyIsbn10(value) && validateIsbn10Checksum(value)) {
      return {
        type: "ISBN_10",
        confidence: "HIGH",
      };
    }
    // Could be a SKU, or invalid ISBN-10
    if (numeric) {
      return {
        type: "UNKNOWN",
        confidence: "LOW",
        ambiguityNote: "10-digit numeric value did not pass ISBN-10 checksum. Could be a numeric SKU or invalid ISBN.",
        alternativeTypes: ["ISBN_10", "SKU"],
      };
    }
    return {
      type: "SKU",
      confidence: "MEDIUM",
      ambiguityNote: "10-character alphanumeric value classified as SKU. May be ISBN-10 if X-check-digit was intended.",
      alternativeTypes: ["ISBN_10"],
    };
  }

  // --- Numeric-only paths ---
  if (!numeric) {
    return {
      type: "SKU",
      confidence: "HIGH",
    };
  }

  switch (len) {
    case 6:
    case 7:
      return {
        type: "UNKNOWN",
        confidence: "LOW",
        ambiguityNote: `${len}-digit numeric value does not match any standard barcode format.`,
        alternativeTypes: ["SKU"],
      };

    case 8:
      // EAN-8 and GTIN-8 are structurally identical
      return {
        type: "EAN_8",
        confidence: "HIGH",
        alternativeTypes: ["GTIN_8"],
      };

    case 12:
      // UPC-A and GTIN-12 are structurally identical
      return {
        type: "UPC_A",
        confidence: "HIGH",
        alternativeTypes: ["GTIN_12"],
      };

    case 13: {
      // Could be EAN-13, GTIN-13, or ISBN-13
      // ISBN-13 prefix 978 or 979
      if (value.startsWith("978") || value.startsWith("979")) {
        if (validateIsbn13Checksum(value)) {
          return {
            type: "ISBN_13",
            confidence: "HIGH",
            alternativeTypes: ["EAN_13", "GTIN_13"],
          };
        }
        return {
          type: "EAN_13",
          confidence: "MEDIUM",
          ambiguityNote: "13-digit value with ISBN prefix but failed checksum. Classified as EAN-13.",
          alternativeTypes: ["ISBN_13", "GTIN_13"],
        };
      }
      return {
        type: "EAN_13",
        confidence: "HIGH",
        alternativeTypes: ["GTIN_13"],
      };
    }

    case 14:
      return {
        type: "GTIN_14",
        confidence: "HIGH",
      };

    default:
      // Very short or very long numeric
      if (len < 6) {
        return {
          type: "UNKNOWN",
          confidence: "LOW",
          ambiguityNote: `${len}-digit value is too short for any standard barcode format.`,
          alternativeTypes: ["SKU"],
        };
      }
      if (len > 14) {
        return {
          type: "UNKNOWN",
          confidence: "LOW",
          ambiguityNote: `${len}-digit value exceeds maximum GTIN length (14).`,
          alternativeTypes: [],
        };
      }
      return {
        type: "UNKNOWN",
        confidence: "LOW",
        ambiguityNote: `${len}-digit numeric value does not match a recognized format.`,
        alternativeTypes: ["SKU"],
      };
  }
}

// ---------------------------------------------------------------------------
// Full identifier analysis (detect + normalize + validate)
// ---------------------------------------------------------------------------

/**
 * Perform complete identifier analysis: normalize, classify, validate format, check checksum.
 *
 * This is the primary entry point for identifier processing.
 */
export function analyzeIdentifier(
  rawValue: string,
): { identifier: NormalizedProductIdentifier; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];

  // Strip safe separators
  const cleaned = rawValue.replace(/[\s\-\.]/g, "").trim();
  const normalizedValue = cleaned;

  // Detect type
  const classification = classifyIdentifier(normalizedValue);

  // Determine if format is valid
  let isValidFormat = true;
  let checksumValid: boolean | undefined;

  if (classification.type === "UNKNOWN") {
    isValidFormat = false;
    if (classification.ambiguityNote) {
      issues.push(makeIssue("UNRECOGNIZED_FORMAT", classification.ambiguityNote, "WARNING", "rawValue"));
    }
  } else if (classification.type === "SKU") {
    isValidFormat = true; // SKUs have no fixed format
  } else {
    // GTIN-family formats: validate checksum where applicable
    switch (classification.type) {
      case "ISBN_10":
        checksumValid = validateIsbn10Checksum(normalizedValue);
        isValidFormat = checksumValid;
        if (!checksumValid) {
          issues.push(makeIssue("CHECKSUM_INVALID", "ISBN-10 checksum validation failed.", "ERROR", "rawValue"));
        }
        break;

      case "ISBN_13":
        checksumValid = validateIsbn13Checksum(normalizedValue);
        isValidFormat = checksumValid;
        if (!checksumValid) {
          issues.push(makeIssue("CHECKSUM_INVALID", "ISBN-13 checksum validation failed.", "ERROR", "rawValue"));
        }
        break;

      case "UPC_A":
      case "UPC_E":
      case "EAN_8":
      case "EAN_13":
      case "GTIN_8":
      case "GTIN_12":
      case "GTIN_13":
      case "GTIN_14":
        checksumValid = validateGtinChecksum(normalizedValue);
        isValidFormat = checksumValid;
        if (!checksumValid) {
          issues.push(makeIssue("CHECKSUM_INVALID", `${classification.type} checksum validation failed.`, "ERROR", "rawValue"));
        }
        break;

      default:
        isValidFormat = true;
    }
  }

  const identifier: NormalizedProductIdentifier = {
    rawValue,
    normalizedValue,
    identifierType: classification.type,
    isValidFormat,
    checksumValid,
    confidence: classification.confidence,
    ambiguityNote: classification.ambiguityNote,
    alternativeTypes: classification.alternativeTypes,
  };

  return { identifier, issues };
}