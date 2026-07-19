import { describe, it, assertEqual, assertThrows, assertTruthy, assertFalsy } from "./harness";
import { isEnrichmentEligible, toEnrichmentInput } from "../src/adapters/intake-handoff";
import type { IntakeHandoffRecord } from "../src/adapters/intake-handoff";

describe("Intake handoff reconciliation", () => {
  it("marks ACCEPTED and NEEDS_REVIEW as eligible", () => {
    assertTruthy(isEnrichmentEligible({ intakeId: "i1", status: "ACCEPTED" }));
    assertTruthy(isEnrichmentEligible({ intakeId: "i2", status: "NEEDS_REVIEW" }));
  });

  it("marks REJECTED and DUPLICATE as ineligible", () => {
    assertFalsy(isEnrichmentEligible({ intakeId: "i3", status: "REJECTED" }));
    assertFalsy(isEnrichmentEligible({ intakeId: "i4", status: "DUPLICATE" }));
  });

  it("maps an ACCEPTED barcode record to ProductEnrichmentInput", () => {
    const record: IntakeHandoffRecord = {
      intakeId: "intake-001",
      status: "ACCEPTED",
      identifier: {
        rawValue: "0-36000-29145-2",
        normalizedValue: "036000291452",
        identifierType: "GTIN_12",
        isValidFormat: true,
        checksumValid: true,
      },
      sourceContext: { marketplace: "ebay" },
    };

    const input = toEnrichmentInput(record);
    assertEqual(input.intakeId, "intake-001");
    assertEqual(input.identifier?.normalizedValue, "036000291452");
    assertEqual(input.identifier?.identifierType, "GTIN_12");
    assertEqual(input.identifier?.checksumValid, true);
    assertEqual(input.sourceContext, { marketplace: "ebay" });
    assertEqual(input.manualProduct, undefined);
  });

  it("maps a NEEDS_REVIEW manual-entry record, including extra fields", () => {
    const record: IntakeHandoffRecord = {
      intakeId: "intake-002",
      status: "NEEDS_REVIEW",
      manualProduct: {
        title: "Vintage Lamp",
        brand: "Acme",
        mpn: "AC-100",
        color: "Brass",
      },
    };

    const input = toEnrichmentInput(record);
    assertEqual(input.manualProduct?.title, "Vintage Lamp");
    assertEqual(input.manualProduct?.brand, "Acme");
    assertEqual(input.manualProduct?.mpn, "AC-100");
    assertEqual(input.manualProduct?.color, "Brass");
    assertEqual(input.identifier, undefined);
  });

  it("throws InvalidInputError for REJECTED records instead of silently mapping them", () => {
    const record: IntakeHandoffRecord = { intakeId: "intake-003", status: "REJECTED" };
    assertThrows(() => toEnrichmentInput(record), "only ACCEPTED and NEEDS_REVIEW");
  });

  it("throws InvalidInputError for DUPLICATE records instead of silently mapping them", () => {
    const record: IntakeHandoffRecord = { intakeId: "intake-004", status: "DUPLICATE" };
    assertThrows(() => toEnrichmentInput(record), "only ACCEPTED and NEEDS_REVIEW");
  });

  it("omits checksumValid when the intake record does not report it", () => {
    const record: IntakeHandoffRecord = {
      intakeId: "intake-005",
      status: "ACCEPTED",
      identifier: {
        rawValue: "ABC-123",
        normalizedValue: "ABC-123",
        identifierType: "SKU",
        isValidFormat: true,
      },
    };
    const input = toEnrichmentInput(record);
    assertEqual("checksumValid" in (input.identifier ?? {}), false);
  });
});
