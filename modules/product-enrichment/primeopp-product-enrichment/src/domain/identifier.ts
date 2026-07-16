/**
 * Product identifier validation utilities.
 *
 * The intake module is the primary validator, but the enrichment layer
 * re-validates defensively because intake output may have been persisted
 * for some time and because direct callers may bypass intake.
 */

import type {
  ProductIdentifier,
  ProductIdentifierType,
} from "../contracts/input";

/**
 * GS1 check-digit calculation. The same algorithm is used for UPC-A,
 * EAN-8, EAN-13, GTIN-12, GTIN-13, and GTIN-14.
 *
 * Algorithm (right-to-left, alternating weights 3 and 1):
 *   1. Starting from the rightmost data digit (excluding the check digit),
 *      assign weights alternating 3, 1, 3, 1, ...
 *   2. Sum all weighted digits.
 *   3. Check digit = (10 - (sum mod 10)) mod 10.
 *
 * @param dataDigits numeric string WITHOUT the check digit
 */
export function computeGtinCheckDigit(dataDigits: string): number {
  if (!/^\d+$/.test(dataDigits)) {
    throw new Error("computeGtinCheckDigit: non-numeric input");
  }
  let sum = 0;
  for (let i = 0; i < dataDigits.length; i++) {
    const digit = dataDigits.charCodeAt(dataDigits.length - 1 - i) - 48;
    const weight = i % 2 === 0 ? 3 : 1;
    sum += digit * weight;
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * Validate a GS1-family identifier (UPC-A / EAN-8 / EAN-13 / GTIN-8/12/13/14)
 * including check digit.
 */
export function isValidGs1Identifier(normalized: string): boolean {
  if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(normalized)) {
    return false;
  }
  const data = normalized.slice(0, -1);
  const check = normalized.slice(-1);
  return String(computeGtinCheckDigit(data)) === check;
}

/**
 * ISBN-10 check digit. The check digit is base-11 with 'X' representing 10.
 *
 * sum = (10*d1 + 9*d2 + 8*d3 + ... + 2*d9 + 1*d10) mod 11
 */
export function isValidIsbn10(normalized: string): boolean {
  if (!/^\d{9}[\dXx]$/.test(normalized)) {
    return false;
  }
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += (10 - i) * (normalized.charCodeAt(i) - 48);
  }
  const last = normalized.charAt(9);
  const check = last === "X" || last === "x" ? 10 : last.charCodeAt(0) - 48;
  sum += check;
  return sum % 11 === 0;
}

/**
 * ISBN-13 check digit. Same algorithm as GS1 (978/979 prefix).
 */
export function isValidIsbn13(normalized: string): boolean {
  if (!/^\d{13}$/.test(normalized)) {
    return false;
  }
  return isValidGs1Identifier(normalized);
}

/**
 * Detect identifier type from a raw string. The detection is intentionally
 * conservative — when ambiguous, it prefers the GS1 family over SKU.
 */
export function detectIdentifierType(raw: string): ProductIdentifierType {
  const cleaned = (raw || "").replace(/[^0-9Xx]/g, "");
  if (/^\d{8}$/.test(cleaned)) return "GTIN_8";
  if (/^\d{12}$/.test(cleaned)) return "GTIN_12";
  if (/^\d{13}$/.test(cleaned)) {
    if (cleaned.startsWith("978") || cleaned.startsWith("979")) return "ISBN_13";
    return "GTIN_13";
  }
  if (/^\d{14}$/.test(cleaned)) return "GTIN_14";
  if (/^\d{9}[\dXx]$/.test(cleaned)) return "ISBN_10";
  // Anything else with non-digit characters is treated as SKU.
  return "SKU";
}

/**
 * Map a raw identifier to a normalized ProductIdentifier object.
 *
 * Normalization rules:
 *  - UPC/EAN/GTIN/ISBN: strip non-alphanumeric, uppercase X.
 *  - SKU: trim whitespace, collapse internal whitespace.
 *  - UNKNOWN: passthrough trimmed.
 */
export function normalizeIdentifier(raw: string): ProductIdentifier {
  const rawValue = String(raw ?? "");
  const identifierType = detectIdentifierType(rawValue);

  let normalizedValue: string;
  if (identifierType === "SKU") {
    normalizedValue = rawValue.trim().replace(/\s+/g, " ");
  } else {
    normalizedValue = rawValue.replace(/[^0-9Xx]/g, "").toUpperCase();
  }

  let checksumValid: boolean | undefined;
  switch (identifierType) {
    case "ISBN_10":
      checksumValid = isValidIsbn10(normalizedValue);
      break;
    case "ISBN_13":
    case "GTIN_8":
    case "GTIN_12":
    case "GTIN_13":
    case "GTIN_14":
    case "UPC_A":
    case "UPC_E":
    case "EAN_8":
    case "EAN_13":
      checksumValid = isValidGs1Identifier(normalizedValue);
      break;
    default:
      checksumValid = undefined;
  }

  return {
    rawValue,
    normalizedValue,
    identifierType,
    isValidFormat: normalizedValue.length > 0,
    checksumValid,
  };
}

/**
 * True if the identifier is a barcode (GS1 family) — used by the
 * orchestrator to decide which providers are eligible.
 */
export function isBarcodeIdentifier(t: ProductIdentifierType): boolean {
  return (
    t === "UPC_A" ||
    t === "UPC_E" ||
    t === "EAN_8" ||
    t === "EAN_13" ||
    t === "GTIN_8" ||
    t === "GTIN_12" ||
    t === "GTIN_13" ||
    t === "GTIN_14"
  );
}

export function isIsbnIdentifier(t: ProductIdentifierType): boolean {
  return t === "ISBN_10" || t === "ISBN_13";
}
