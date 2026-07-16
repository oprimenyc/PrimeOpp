import {
  describe,
  it,
  assert,
  assertEqual,
  assertTruthy,
  assertFalsy,
  assertApprox,
} from "./harness";
import {
  normalizeIdentifier,
  detectIdentifierType,
  computeGtinCheckDigit,
  isValidGs1Identifier,
  isValidIsbn10,
  isValidIsbn13,
  isBarcodeIdentifier,
  isIsbnIdentifier,
} from "../src/domain/identifier";

describe("Identifier detection & validation", () => {
  it("detects GTIN-14", () => {
    assertEqual(detectIdentifierType("01234567890128"), "GTIN_14");
  });

  it("detects GTIN-13 / EAN-13", () => {
    assertEqual(detectIdentifierType("4006381333931"), "GTIN_13");
  });

  it("detects ISBN-13 when starts with 978/979", () => {
    assertEqual(detectIdentifierType("9780132350884"), "ISBN_13");
  });

  it("detects GTIN-12 / UPC-A", () => {
    assertEqual(detectIdentifierType("036000291452"), "GTIN_12");
  });

  it("detects ISBN-10", () => {
    assertEqual(detectIdentifierType("0132350882"), "ISBN_10");
  });

  it("detects ISBN-10 with X check digit", () => {
    assertEqual(detectIdentifierType("080442957X"), "ISBN_10");
  });

  it("treats non-numeric as SKU", () => {
    assertEqual(detectIdentifierType("ABC-123-XYZ"), "SKU");
  });

  it("computes GTIN check digit correctly", () => {
    // 03600029145? -> check 2
    assertEqual(computeGtinCheckDigit("03600029145"), 2);
  });

  it("validates a known-good UPC", () => {
    assertTruthy(isValidGs1Identifier("036000291452"), "036000291452 should be valid");
  });

  it("rejects a known-bad UPC (wrong check digit)", () => {
    assertFalsy(isValidGs1Identifier("036000291453"), "036000291453 should be invalid");
  });

  it("validates ISBN-10 with X", () => {
    assertTruthy(isValidIsbn10("080442957X"));
  });

  it("validates ISBN-13", () => {
    assertTruthy(isValidIsbn13("9780132350884"));
  });

  it("normalizeIdentifier strips dashes from GTIN", () => {
    const id = normalizeIdentifier("0-36000-29145-2");
    assertEqual(id.normalizedValue, "036000291452");
    assertEqual(id.identifierType, "GTIN_12");
    assertEqual(id.checksumValid, true);
  });

  it("normalizeIdentifier uppercases ISBN-10 X", () => {
    const id = normalizeIdentifier("080442957x");
    assertEqual(id.normalizedValue, "080442957X");
    assertEqual(id.identifierType, "ISBN_10");
    assertEqual(id.checksumValid, true);
  });

  it("isBarcodeIdentifier returns true for GS1 family", () => {
    assertTruthy(isBarcodeIdentifier("UPC_A"));
    assertTruthy(isBarcodeIdentifier("GTIN_14"));
    assertFalsy(isBarcodeIdentifier("ISBN_13"));
    assertFalsy(isBarcodeIdentifier("SKU"));
  });

  it("isIsbnIdentifier returns true for ISBN family", () => {
    assertTruthy(isIsbnIdentifier("ISBN_10"));
    assertTruthy(isIsbnIdentifier("ISBN_13"));
    assertFalsy(isIsbnIdentifier("GTIN_13"));
  });

  it("checksum reports false for invalid check digit", () => {
    const id = normalizeIdentifier("036000291459"); // last digit wrong
    assertEqual(id.checksumValid, false);
    assertApprox(id.checksumValid ? 1 : 0, 0);
  });
});
