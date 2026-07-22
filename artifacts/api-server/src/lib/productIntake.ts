export const PRODUCT_INTAKE_SOURCES = ["BARCODE", "MANUAL_IDENTIFIER", "SEARCH"] as const;

export type ProductIntakeSource = typeof PRODUCT_INTAKE_SOURCES[number];
export type ClassificationConfidence = "HIGH" | "MEDIUM" | "LOW" | "AMBIGUOUS";
type IntakeIdentifierType =
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
export type ProductIntakeIdentifierType =
  | "UPC_A"
  | "EAN_13"
  | "GTIN"
  | "ISBN"
  | "SKU"
  | "STYLE_CODE"
  | "PRODUCT_NAME"
  | "UNKNOWN";

export type ProductIntakeResult = {
  normalizedIdentifier: string | null;
  identifierType: ProductIntakeIdentifierType;
  valid: boolean;
  classification: {
    type: ProductIntakeIdentifierType;
    confidence: ClassificationConfidence;
    reason: string;
  };
  enrichment: null;
  enrichmentStatus: "PROVIDER_REQUIRED";
  productCandidate: {
    identifiers: Record<string, string>;
    title?: string;
    brand?: string;
    description?: string;
    imageUrl?: string;
    category?: string;
  };
  canCreateListingPackage: boolean;
  providerCalls: false;
  publishEnabled: false;
};

type ContractClassification = {
  normalizedValue: string;
  identifierType: IntakeIdentifierType;
  isValidFormat: boolean;
  confidence: ClassificationConfidence;
  ambiguityNote?: string;
};

function isNumeric(value: string): boolean {
  return /^\d+$/.test(value);
}

function validateGtinChecksum(value: string): boolean {
  if (!isNumeric(value) || value.length < 8 || value.length > 14) return false;
  const digits = value.split("").map(Number);
  const checkDigit = digits.pop();
  if (checkDigit === undefined) return false;
  let sum = 0;
  for (let index = digits.length - 1, position = 0; index >= 0; index -= 1, position += 1) {
    sum += digits[index] * (position % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === checkDigit;
}

function validateIsbn10Checksum(value: string): boolean {
  if (!/^\d{9}[\dXx]$/.test(value)) return false;
  let sum = 0;
  for (let index = 0; index < 10; index += 1) {
    const char = value[index];
    const digit = char.toUpperCase() === "X" ? 10 : Number(char);
    sum += digit * (10 - index);
  }
  return sum % 11 === 0;
}

function validateIsbn13Checksum(value: string): boolean {
  return /^\d{13}$/.test(value) && validateGtinChecksum(value);
}

function analyzeIdentifierByContract(rawValue: string): ContractClassification {
  const normalizedValue = rawValue.replace(/[\s\-.]/g, "").trim();
  const len = normalizedValue.length;
  const numeric = isNumeric(normalizedValue);

  if (len === 10) {
    if (validateIsbn10Checksum(normalizedValue)) {
      return { normalizedValue, identifierType: "ISBN_10", isValidFormat: true, confidence: "HIGH" };
    }
    if (numeric) {
      return {
        normalizedValue,
        identifierType: "UNKNOWN",
        isValidFormat: false,
        confidence: "LOW",
        ambiguityNote: "10-digit numeric value did not pass ISBN-10 checksum. Could be a numeric SKU or invalid ISBN.",
      };
    }
    return {
      normalizedValue,
      identifierType: "SKU",
      isValidFormat: true,
      confidence: "MEDIUM",
      ambiguityNote: "10-character alphanumeric value classified as SKU. May be ISBN-10 if X-check-digit was intended.",
    };
  }

  if (!numeric) {
    return { normalizedValue, identifierType: "SKU", isValidFormat: true, confidence: "HIGH" };
  }

  if (len === 8) {
    return { normalizedValue, identifierType: "EAN_8", isValidFormat: validateGtinChecksum(normalizedValue), confidence: "HIGH" };
  }
  if (len === 12) {
    return { normalizedValue, identifierType: "UPC_A", isValidFormat: validateGtinChecksum(normalizedValue), confidence: "HIGH" };
  }
  if (len === 13) {
    if (normalizedValue.startsWith("978") || normalizedValue.startsWith("979")) {
      const isbnValid = validateIsbn13Checksum(normalizedValue);
      return {
        normalizedValue,
        identifierType: isbnValid ? "ISBN_13" : "EAN_13",
        isValidFormat: isbnValid || validateGtinChecksum(normalizedValue),
        confidence: isbnValid ? "HIGH" : "MEDIUM",
        ambiguityNote: isbnValid ? undefined : "13-digit value with ISBN prefix failed checksum. Classified as EAN-13 if GTIN checksum is valid.",
      };
    }
    return { normalizedValue, identifierType: "EAN_13", isValidFormat: validateGtinChecksum(normalizedValue), confidence: "HIGH" };
  }
  if (len === 14) {
    return { normalizedValue, identifierType: "GTIN_14", isValidFormat: validateGtinChecksum(normalizedValue), confidence: "HIGH" };
  }

  return {
    normalizedValue,
    identifierType: "UNKNOWN",
    isValidFormat: false,
    confidence: "LOW",
    ambiguityNote: `${len}-digit numeric value does not match a recognized product-intake identifier format.`,
  };
}

function mapIdentifierType(type: IntakeIdentifierType): ProductIntakeIdentifierType {
  if (type === "UPC_A") return "UPC_A";
  if (type === "EAN_13") return "EAN_13";
  if (type === "ISBN_10" || type === "ISBN_13") return "ISBN";
  if (type.startsWith("GTIN_") || type === "EAN_8" || type === "UPC_E") return "GTIN";
  if (type === "SKU") return "SKU";
  return "UNKNOWN";
}

function looksLikeProductName(value: string): boolean {
  return /[a-z]/i.test(value) && /\s/.test(value.trim());
}

function looksLikeStyleCode(value: string): boolean {
  return /[a-z]/i.test(value) && /\d/.test(value) && /^[a-z0-9][a-z0-9._ -]{2,79}$/i.test(value.trim());
}

function reasonFor(
  source: ProductIntakeSource,
  rawQuery: string,
  mappedType: ProductIntakeIdentifierType,
  moduleReason?: string,
): string {
  if (source === "SEARCH" && mappedType === "PRODUCT_NAME") {
    return "Search text contains words and is treated as a product-name query. No provider lookup was called.";
  }
  if (mappedType === "STYLE_CODE") {
    return "Alphanumeric product-intake result was narrowed to a style-code candidate by local format rules. No provider lookup was called.";
  }
  if (!rawQuery.trim()) return "Query is empty.";
  return moduleReason ?? "Classified by the local product-intake identifier contract. No provider lookup was called.";
}

export function classifyProductIntake(query: string, source: ProductIntakeSource): ProductIntakeResult {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      normalizedIdentifier: null,
      identifierType: "UNKNOWN",
      valid: false,
      classification: {
        type: "UNKNOWN",
        confidence: "LOW",
        reason: "Query is empty.",
      },
      enrichment: null,
      enrichmentStatus: "PROVIDER_REQUIRED",
      productCandidate: { identifiers: {} },
      canCreateListingPackage: false,
      providerCalls: false,
      publishEnabled: false,
    };
  }

  const analyzed = analyzeIdentifierByContract(trimmed);
  const normalized = analyzed.normalizedValue || trimmed;
  let identifierType = mapIdentifierType(analyzed.identifierType);
  let confidence = analyzed.confidence;

  if (source === "SEARCH" && looksLikeProductName(trimmed)) {
    identifierType = "PRODUCT_NAME";
    confidence = "MEDIUM";
  } else if (identifierType === "SKU" && looksLikeStyleCode(trimmed)) {
    identifierType = "STYLE_CODE";
    confidence = confidence === "LOW" ? "MEDIUM" : confidence;
  }

  const valid = identifierType === "PRODUCT_NAME" || identifierType === "STYLE_CODE" || analyzed.isValidFormat;
  const reason = reasonFor(source, trimmed, identifierType, analyzed.ambiguityNote);

  return {
    normalizedIdentifier: normalized,
    identifierType,
    valid,
    classification: {
      type: identifierType,
      confidence,
      reason,
    },
    enrichment: null,
    enrichmentStatus: "PROVIDER_REQUIRED",
    productCandidate: {
      identifiers: {
        [identifierType.toLowerCase()]: normalized,
      },
    },
    canCreateListingPackage: valid,
    providerCalls: false,
    publishEnabled: false,
  };
}
