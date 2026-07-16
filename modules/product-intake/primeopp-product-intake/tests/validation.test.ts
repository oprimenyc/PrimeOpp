/**
 * Tests for validation utilities.
 */

import {
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
} from "../src/validation/index.js";

describe("normalizeRawIdentifier", () => {
  test("trims leading/trailing whitespace", () => {
    expect(normalizeRawIdentifier("  12345  ")).toBe("12345");
  });

  test("removes hyphens", () => {
    expect(normalizeRawIdentifier("03600-02914-52")).toBe("036000291452");
  });

  test("removes dots", () => {
    expect(normalizeRawIdentifier("03600.02914.52")).toBe("036000291452");
  });

  test("removes internal spaces", () => {
    expect(normalizeRawIdentifier("03600 02914 52")).toBe("036000291452");
  });

  test("removes mixed separators", () => {
    expect(normalizeRawIdentifier(" 03600-02914 52 ")).toBe("036000291452");
  });

  test("handles already-clean input", () => {
    expect(normalizeRawIdentifier("036000291452")).toBe("036000291452");
  });

  test("deterministic: same input always produces same output", () => {
    const input = "  590-123 412345.7  ";
    const results = Array.from({ length: 5 }, () => normalizeRawIdentifier(input));
    expect(new Set(results).size).toBe(1);
  });
});

describe("normalizeField", () => {
  test("trims whitespace", () => {
    expect(normalizeField("  hello  ")).toBe("hello");
  });

  test("returns undefined for undefined", () => {
    expect(normalizeField(undefined)).toBeUndefined();
  });

  test("returns undefined for empty string", () => {
    expect(normalizeField("")).toBeUndefined();
  });

  test("returns undefined for whitespace-only", () => {
    expect(normalizeField("   ")).toBeUndefined();
  });
});

describe("isNumeric", () => {
  test("returns true for pure digits", () => {
    expect(isNumeric("12345")).toBe(true);
  });

  test("returns false for alphanumeric", () => {
    expect(isNumeric("NK-123")).toBe(false);
  });

  test("returns false for empty string", () => {
    expect(isNumeric("")).toBe(false);
  });

  test("returns false for with spaces", () => {
    expect(isNumeric("123 456")).toBe(false);
  });
});

describe("validateGtinChecksum", () => {
  test("valid UPC-A: 036000291452", () => {
    expect(validateGtinChecksum("036000291452")).toBe(true);
  });

  test("invalid checksum: 036000291453", () => {
    expect(validateGtinChecksum("036000291453")).toBe(false);
  });

  test("valid EAN-13: 5901234123457", () => {
    expect(validateGtinChecksum("5901234123457")).toBe(true);
  });

  test("valid GTIN-14: 10012345678902", () => {
    expect(validateGtinChecksum("10012345678902")).toBe(true);
  });

  test("too short returns false", () => {
    expect(validateGtinChecksum("123")).toBe(false);
  });

  test("non-numeric returns false", () => {
    expect(validateGtinChecksum("abcdefgh")).toBe(false);
  });
});

describe("validateIsbn10Checksum", () => {
  test("valid ISBN-10: 0306406152", () => {
    expect(validateIsbn10Checksum("0306406152")).toBe(true);
  });

  test("invalid ISBN-10: 0306406153", () => {
    expect(validateIsbn10Checksum("0306406153")).toBe(false);
  });

  test("valid ISBN-10 with X: 007462542X", () => {
    expect(validateIsbn10Checksum("007462542X")).toBe(true);
  });

  test("valid ISBN-10 with lowercase x: 007462542x", () => {
    expect(validateIsbn10Checksum("007462542x")).toBe(true);
  });

  test("wrong length returns false", () => {
    expect(validateIsbn10Checksum("030640615")).toBe(false);
  });
});

describe("validateIsbn13Checksum", () => {
  test("valid ISBN-13: 9780306406157", () => {
    expect(validateIsbn13Checksum("9780306406157")).toBe(true);
  });

  test("invalid ISBN-13", () => {
    expect(validateIsbn13Checksum("9780306406150")).toBe(false);
  });

  test("wrong length returns false", () => {
    expect(validateIsbn13Checksum("978030640615")).toBe(false);
  });
});

describe("validateLength", () => {
  test("returns null for valid length", () => {
    expect(validateLength("123456", 6, 14)).toBeNull();
  });

  test("returns issue for too short", () => {
    const result = validateLength("123", 6, 14);
    expect(result).not.toBeNull();
    expect(result!.code).toBe("TOO_SHORT");
  });

  test("returns issue for too long", () => {
    const result = validateLength("123456789012345", 6, 14);
    expect(result).not.toBeNull();
    expect(result!.code).toBe("TOO_LONG");
  });
});

describe("validateNonEmpty", () => {
  test("returns null for non-empty", () => {
    expect(validateNonEmpty("hello", "field")).toBeNull();
  });

  test("returns issue for empty string", () => {
    const result = validateNonEmpty("", "field");
    expect(result).not.toBeNull();
    expect(result!.code).toBe("EMPTY_VALUE");
  });

  test("returns issue for undefined", () => {
    const result = validateNonEmpty(undefined, "field");
    expect(result).not.toBeNull();
  });
});

describe("validateMaxLength", () => {
  test("returns null when under limit", () => {
    expect(validateMaxLength("abc", 10)).toBeNull();
  });

  test("returns issue when over limit", () => {
    const result = validateMaxLength("abcdefghijk", 10);
    expect(result).not.toBeNull();
    expect(result!.code).toBe("EXCEEDS_MAX_LENGTH");
  });
});

describe("validateNumeric", () => {
  test("returns null for numeric", () => {
    expect(validateNumeric("12345")).toBeNull();
  });

  test("returns issue for non-numeric", () => {
    const result = validateNumeric("12a45");
    expect(result).not.toBeNull();
    expect(result!.code).toBe("NOT_NUMERIC");
  });
});

describe("makeIssue", () => {
  test("creates issue with all fields", () => {
    const issue = makeIssue("TEST_CODE", "Test message", "WARNING", "testField");
    expect(issue).toEqual({
      code: "TEST_CODE",
      message: "Test message",
      severity: "WARNING",
      field: "testField",
    });
  });
});