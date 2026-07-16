import {
  describe,
  it,
  assert,
  assertEqual,
  assertTruthy,
  assertFalsy,
  assertIncludes,
  assertApprox,
} from "./harness";
import {
  normalizeWhitespace,
  normalizeBrand,
  normalizeTitle,
  normalizeModel,
  normalizeManufacturer,
  normalizeCategory,
  normalizeColor,
  normalizeSize,
  normalizeDimensions,
  normalizeWeight,
  dedupeIdentifiers,
  normalizeBullets,
  dedupeImages,
  selectPrimaryImage,
  isValidUrl,
  boundString,
} from "../src/normalization";

describe("Normalization primitives", () => {
  it("normalizeWhitespace trims and collapses", () => {
    assertEqual(normalizeWhitespace("  hello   world  "), "hello world");
  });

  it("normalizeWhitespace returns undefined for empty", () => {
    assertEqual(normalizeWhitespace("   "), undefined);
    assertEqual(normalizeWhitespace(null), undefined);
  });

  it("normalizeBrand preserves short all-caps acronyms", () => {
    assertEqual(normalizeBrand("IBM"), "IBM");
    assertEqual(normalizeBrand("HP Inc"), "HP Inc");
  });

  it("normalizeBrand title-cases mixed case", () => {
    assertEqual(normalizeBrand("coca cola"), "Coca Cola");
  });

  it("normalizeBrand preserves hyphens", () => {
    assertEqual(normalizeBrand("coca-cola"), "Coca-Cola");
  });

  it("normalizeTitle preserves original case", () => {
    assertEqual(normalizeTitle("iPhone 15 Pro Max"), "iPhone 15 Pro Max");
  });

  it("normalizeModel uppercases", () => {
    assertEqual(normalizeModel("wh-1000xm4"), "WH-1000XM4");
  });

  it("normalizeManufacturer behaves like brand", () => {
    assertEqual(normalizeManufacturer("the coca-cola company"), "The Coca-Cola Company");
  });

  it("normalizeCategory title-cases", () => {
    assertEqual(normalizeCategory("electronics"), "Electronics");
  });

  it("normalizeColor lowercases", () => {
    assertEqual(normalizeColor("BLACK"), "black");
  });

  it("normalizeSize uppercases", () => {
    assertEqual(normalizeSize("xl"), "XL");
    assertEqual(normalizeSize("32x32"), "32X32");
  });

  it("normalizeDimensions parses LxWxH with units", () => {
    const r = normalizeDimensions("10 x 5 x 2 cm");
    assertEqual(r?.normalized, "10x5x2");
    assertEqual(r?.unit, "cm");
  });

  it("normalizeDimensions handles inch aliases", () => {
    const r = normalizeDimensions("9.94 x 7.91 x 3.94 inches");
    assertEqual(r?.unit, "in");
  });

  it("normalizeDimensions returns original when not parseable", () => {
    const r = normalizeDimensions("varies");
    assertEqual(r?.normalized, "varies");
    assertEqual(r?.unit, undefined);
  });

  it("normalizeWeight converts lb to grams", () => {
    const r = normalizeWeight("1 lb");
    assertApprox(r?.grams ?? 0, 453.59237, 0.01);
    assertEqual(r?.originalUnit, "lb");
  });

  it("normalizeWeight accepts numeric input as grams", () => {
    const r = normalizeWeight(500);
    assertEqual(r?.grams, 500);
    assertEqual(r?.normalized, "500g");
  });

  it("normalizeWeight converts oz", () => {
    const r = normalizeWeight("16 oz");
    assertApprox(r?.grams ?? 0, 453.59237, 0.1);
  });

  it("dedupeIdentifiers dedupes case-insensitively for numeric", () => {
    const out = dedupeIdentifiers(["036000291452", "036000291452", "049000028904"]);
    assertEqual(out.length, 2);
  });

  it("dedupeIdentifiers dedupes case-sensitively for SKU", () => {
    const out = dedupeIdentifiers(["ABC123", "abc123"]);
    assertEqual(out.length, 2);
  });

  it("normalizeBullets trims and dedupes", () => {
    const out = normalizeBullets(["  hello  ", "hello", "world", "", "  "]);
    assertEqual(out, ["hello", "world"]);
  });

  it("dedupeImages drops invalid URLs", () => {
    const out = dedupeImages([
      { url: "https://example.com/a.jpg", sourceProviderId: "p1" },
      { url: "not-a-url", sourceProviderId: "p1" },
      { url: "https://example.com/a.jpg", sourceProviderId: "p2" },
    ]);
    assertEqual(out.length, 1);
  });

  it("selectPrimaryImage prefers explicit isPrimary", () => {
    const images = [
      { url: "https://example.com/a.jpg", sourceProviderId: "p1", confidence: 0.9 },
      { url: "https://example.com/b.jpg", sourceProviderId: "p1", isPrimary: true, confidence: 0.5 },
    ];
    const primary = selectPrimaryImage(images);
    assertEqual(primary?.url, "https://example.com/b.jpg");
  });

  it("selectPrimaryImage falls back to highest confidence", () => {
    const images = [
      { url: "https://example.com/a.jpg", sourceProviderId: "p1", confidence: 0.5 },
      { url: "https://example.com/b.jpg", sourceProviderId: "p1", confidence: 0.9 },
    ];
    const primary = selectPrimaryImage(images);
    assertEqual(primary?.url, "https://example.com/b.jpg");
  });

  it("isValidUrl accepts https", () => {
    assertTruthy(isValidUrl("https://example.com"));
  });

  it("isValidUrl rejects non-http protocols", () => {
    assertFalsy(isValidUrl("javascript:alert(1)"));
    assertFalsy(isValidUrl("ftp://example.com"));
  });

  it("boundString truncates oversized strings", () => {
    const s = "a".repeat(100);
    assertEqual(boundString(s, 10)?.length, 10);
  });

  it("boundString preserves short strings", () => {
    assertEqual(boundString("abc", 10), "abc");
  });
});
