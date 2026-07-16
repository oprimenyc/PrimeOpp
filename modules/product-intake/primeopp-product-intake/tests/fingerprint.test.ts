/**
 * Tests for the fingerprint utility.
 */

import {
  generateProductFingerprint,
  validateManualProductMinimum,
} from "../src/domain/fingerprint.js";

describe("generateProductFingerprint", () => {
  test("generates fingerprint from title", () => {
    const result = generateProductFingerprint({ title: "Test Product" });
    expect(result.fingerprint).toBe("test product");
    expect(result.fieldsUsed).toEqual(["title"]);
  });

  test("generates fingerprint from title + brand + model", () => {
    const result = generateProductFingerprint({
      title: "Widget Pro",
      brand: "Acme",
      model: "WP-100",
    });
    expect(result.fingerprint).toBe("widget pro|acme|wp-100");
    expect(result.fieldsUsed).toEqual(["title", "brand", "model"]);
  });

  test("ignores undefined fields", () => {
    const result = generateProductFingerprint({ brand: "Acme" });
    expect(result.fingerprint).toBe("acme");
    expect(result.fieldsUsed).toEqual(["brand"]);
  });

  test("is case-insensitive", () => {
    const a = generateProductFingerprint({ title: "Hello World" });
    const b = generateProductFingerprint({ title: "hello world" });
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  test("is deterministic", () => {
    const data = { title: "Test", brand: "Brand", model: "M1" };
    const results = Array.from({ length: 5 }, () => generateProductFingerprint(data));
    const fps = results.map((r) => r.fingerprint);
    expect(new Set(fps).size).toBe(1);
  });

  test("empty object returns empty fingerprint", () => {
    const result = generateProductFingerprint({});
    expect(result.fingerprint).toBe("");
    expect(result.fieldsUsed).toEqual([]);
  });
});

describe("validateManualProductMinimum", () => {
  test("title alone is sufficient", () => {
    expect(validateManualProductMinimum({ title: "Test" })).toBe(true);
  });

  test("brand + model is sufficient", () => {
    expect(validateManualProductMinimum({ brand: "A", model: "B" })).toBe(true);
  });

  test("title + brand is sufficient", () => {
    expect(validateManualProductMinimum({ title: "T", brand: "B" })).toBe(true);
  });

  test("category alone is insufficient", () => {
    expect(validateManualProductMinimum({ category: "Misc" })).toBe(false);
  });

  test("empty object is insufficient", () => {
    expect(validateManualProductMinimum({})).toBe(false);
  });

  test("brand alone is insufficient", () => {
    expect(validateManualProductMinimum({ brand: "Brand" })).toBe(false);
  });

  test("model alone is insufficient", () => {
    expect(validateManualProductMinimum({ model: "M1" })).toBe(false);
  });
});