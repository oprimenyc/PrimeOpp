/**
 * Tests for the normalization layer.
 */

import { normalizeInput } from "../src/normalization/index.js";

describe("normalizeInput", () => {
  test("cleans identifier whitespace", () => {
    const result = normalizeInput({ rawValue: " 12345 ", inputMethod: "MANUAL_IDENTIFIER" });
    expect(result.cleanedIdentifier).toBe("12345");
    expect(result.issues).toHaveLength(0);
  });

  test("removes safe separators from identifier", () => {
    const result = normalizeInput({ rawValue: "03600-02914-52", inputMethod: "MANUAL_IDENTIFIER" });
    expect(result.cleanedIdentifier).toBe("036000291452");
  });

  test("flags empty identifier", () => {
    const result = normalizeInput({ rawValue: "", inputMethod: "MANUAL_IDENTIFIER" });
    expect(result.cleanedIdentifier).toBeUndefined();
    expect(result.issues.some((i) => i.code === "EMPTY_VALUE")).toBe(true);
  });

  test("flags whitespace-only identifier", () => {
    const result = normalizeInput({ rawValue: "   ", inputMethod: "MANUAL_IDENTIFIER" });
    expect(result.cleanedIdentifier).toBeUndefined();
    expect(result.issues.some((i) => i.code === "EMPTY_VALUE")).toBe(true);
  });

  test("flags excessively long identifier", () => {
    const longValue = "1".repeat(51);
    const result = normalizeInput({ rawValue: longValue, inputMethod: "MANUAL_IDENTIFIER" });
    expect(result.cleanedIdentifier).toBeUndefined();
    expect(result.issues.some((i) => i.code === "EXCEEDS_MAX_LENGTH")).toBe(true);
  });

  test("normalizes manual product fields", () => {
    const result = normalizeInput({
      inputMethod: "MANUAL_PRODUCT",
      manualProduct: {
        title: "  Test Product  ",
        brand: "  Brand  ",
        model: "M1",
        category: undefined,
        description: "",
      },
    });
    expect(result.manualProduct?.title).toBe("Test Product");
    expect(result.manualProduct?.brand).toBe("Brand");
    expect(result.manualProduct?.model).toBe("M1");
    expect(result.manualProduct?.category).toBeUndefined();
    expect(result.manualProduct?.description).toBeUndefined();
  });

  test("no identifier and no manual product returns empty result", () => {
    const result = normalizeInput({ inputMethod: "MANUAL_PRODUCT" });
    expect(result.cleanedIdentifier).toBeUndefined();
    expect(result.manualProduct).toBeUndefined();
  });
});