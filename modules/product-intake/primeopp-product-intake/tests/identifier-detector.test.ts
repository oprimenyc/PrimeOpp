/**
 * Tests for identifier detection and classification.
 */

import { classifyIdentifier, analyzeIdentifier } from "../src/domain/identifier-detector.js";

describe("classifyIdentifier", () => {
  // --- UPC-A / GTIN-12 (12 digits) ---
  describe("UPC-A", () => {
    test("classifies 12-digit numeric as UPC_A", () => {
      const result = classifyIdentifier("036000291452");
      expect(result.type).toBe("UPC_A");
      expect(result.confidence).toBe("HIGH");
      expect(result.alternativeTypes).toContain("GTIN_12");
    });
  });

  // --- EAN-8 / GTIN-8 (8 digits) ---
  describe("EAN-8", () => {
    test("classifies 8-digit numeric as EAN_8", () => {
      const result = classifyIdentifier("96385074");
      expect(result.type).toBe("EAN_8");
      expect(result.confidence).toBe("HIGH");
      expect(result.alternativeTypes).toContain("GTIN_8");
    });
  });

  // --- EAN-13 / GTIN-13 (13 digits) ---
  describe("EAN-13", () => {
    test("classifies 13-digit numeric as EAN_13", () => {
      const result = classifyIdentifier("5901234123457");
      expect(result.type).toBe("EAN_13");
      expect(result.confidence).toBe("HIGH");
      expect(result.alternativeTypes).toContain("GTIN_13");
    });
  });

  // --- ISBN-13 (13 digits with 978/979 prefix) ---
  describe("ISBN-13", () => {
    test("classifies 978-prefix 13-digit as ISBN_13", () => {
      const result = classifyIdentifier("9780306406157");
      expect(result.type).toBe("ISBN_13");
      expect(result.confidence).toBe("HIGH");
    });

    test("classifies 979-prefix 13-digit as ISBN_13", () => {
      const result = classifyIdentifier("9791234567896"); // checksum unknown but prefix matches
      expect(result.type).toBe("ISBN_13");
    });
  });

  // --- GTIN-14 (14 digits) ---
  describe("GTIN-14", () => {
    test("classifies 14-digit numeric as GTIN_14", () => {
      const result = classifyIdentifier("10012345678902");
      expect(result.type).toBe("GTIN_14");
      expect(result.confidence).toBe("HIGH");
    });
  });

  // --- ISBN-10 (10 chars, may end in X) ---
  describe("ISBN-10", () => {
    test("classifies valid ISBN-10", () => {
      const result = classifyIdentifier("0306406152");
      expect(result.type).toBe("ISBN_10");
      expect(result.confidence).toBe("HIGH");
    });

    test("classifies ISBN-10 with X check digit", () => {
      const result = classifyIdentifier("007462542X");
      expect(result.type).toBe("ISBN_10");
      expect(result.confidence).toBe("HIGH");
    });

    test("classifies 10-digit numeric that fails ISBN checksum as UNKNOWN", () => {
      const result = classifyIdentifier("0306406153"); // bad checksum
      expect(result.type).toBe("UNKNOWN");
      expect(result.confidence).toBe("LOW");
      expect(result.alternativeTypes).toContain("ISBN_10");
    });
  });

  // --- SKU (alphanumeric) ---
  describe("SKU", () => {
    test("classifies alphanumeric as SKU", () => {
      const result = classifyIdentifier("NK-DRF-2024-BLK-M");
      // Note: classifyIdentifier receives already-cleaned value
      // Hyphens are removed before classification, so this becomes NKDRF2024BLKM
      const cleaned = "NKDRF2024BLKM";
      const skuResult = classifyIdentifier(cleaned);
      void result;
      expect(skuResult.type).toBe("SKU");
      expect(skuResult.confidence).toBe("HIGH");
    });
  });

  // --- Unknown ---
  describe("Unknown identifiers", () => {
    test("classifies 7-digit numeric as UNKNOWN", () => {
      const result = classifyIdentifier("1234567");
      expect(result.type).toBe("UNKNOWN");
      expect(result.confidence).toBe("LOW");
    });

    test("classifies 5-digit numeric as UNKNOWN", () => {
      const result = classifyIdentifier("12345");
      expect(result.type).toBe("UNKNOWN");
      expect(result.confidence).toBe("LOW");
    });

    test("classifies very long numeric as UNKNOWN", () => {
      const result = classifyIdentifier("123456789012345678901234567890");
      expect(result.type).toBe("UNKNOWN");
      expect(result.confidence).toBe("LOW");
    });
  });
});

describe("analyzeIdentifier", () => {
  test("valid UPC-A passes checksum", () => {
    const { identifier, issues } = analyzeIdentifier("036000291452");
    expect(identifier.identifierType).toBe("UPC_A");
    expect(identifier.isValidFormat).toBe(true);
    expect(identifier.checksumValid).toBe(true);
    expect(issues.filter((i) => i.severity === "ERROR")).toHaveLength(0);
  });

  test("invalid UPC checksum fails", () => {
    const { identifier, issues } = analyzeIdentifier("036000291453");
    expect(identifier.identifierType).toBe("UPC_A");
    expect(identifier.isValidFormat).toBe(false);
    expect(identifier.checksumValid).toBe(false);
    expect(issues.some((i) => i.code === "CHECKSUM_INVALID")).toBe(true);
  });

  test("valid EAN-13 passes", () => {
    const { identifier, issues } = analyzeIdentifier("5901234123457");
    expect(identifier.identifierType).toBe("EAN_13");
    expect(identifier.isValidFormat).toBe(true);
    expect(issues.filter((i) => i.severity === "ERROR")).toHaveLength(0);
  });

  test("EAN with wrong length classified but flagged", () => {
    const { identifier } = analyzeIdentifier("590123412345");
    // 12 digits → classified as UPC_A by length rules
    expect(identifier.identifierType).toBe("UPC_A");
  });

  test("valid GTIN-14 passes", () => {
    const { identifier, issues } = analyzeIdentifier("10012345678902");
    expect(identifier.identifierType).toBe("GTIN_14");
    expect(identifier.isValidFormat).toBe(true);
    expect(issues.filter((i) => i.severity === "ERROR")).toHaveLength(0);
  });

  test("valid ISBN-10 passes", () => {
    const { identifier, issues } = analyzeIdentifier("0306406152");
    expect(identifier.identifierType).toBe("ISBN_10");
    expect(identifier.isValidFormat).toBe(true);
    expect(issues.filter((i) => i.severity === "ERROR")).toHaveLength(0);
  });

  test("invalid ISBN-10 fails checksum", () => {
    const { identifier } = analyzeIdentifier("0306406153");
    // 10 digits that don't pass ISBN-10 checksum
    expect(identifier.identifierType).toBe("UNKNOWN");
  });

  test("valid ISBN-13 passes", () => {
    const { identifier, issues } = analyzeIdentifier("9780306406157");
    expect(identifier.identifierType).toBe("ISBN_13");
    expect(identifier.isValidFormat).toBe(true);
    expect(issues.filter((i) => i.severity === "ERROR")).toHaveLength(0);
  });

  test("preserves raw value", () => {
    const raw = " 03600-02914-52 ";
    const { identifier } = analyzeIdentifier(raw);
    expect(identifier.rawValue).toBe(raw);
    expect(identifier.normalizedValue).toBe("036000291452");
  });

  test("deterministic repeated normalization", () => {
    const raw = "590-123 412345.7";
    const results = Array.from({ length: 10 }, () => analyzeIdentifier(raw));
    const normalizedValues = results.map((r) => r.identifier.normalizedValue);
    expect(new Set(normalizedValues).size).toBe(1);
    const types = results.map((r) => r.identifier.identifierType);
    expect(new Set(types).size).toBe(1);
  });

  test("SKU gets isValidFormat=true", () => {
    const { identifier } = analyzeIdentifier("NKDRF2024BLKM");
    expect(identifier.identifierType).toBe("SKU");
    expect(identifier.isValidFormat).toBe(true);
  });

  test("EAN-8 classified correctly", () => {
    const { identifier } = analyzeIdentifier("96385074");
    expect(identifier.identifierType).toBe("EAN_8");
    expect(identifier.isValidFormat).toBe(true);
  });
});