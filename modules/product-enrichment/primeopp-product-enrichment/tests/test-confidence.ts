import {
  describe,
  it,
  assertEqual,
  assertTruthy,
  assertApprox,
} from "./harness";
import {
  computeOverallConfidence,
  computeIdentifierQuality,
  shouldMarkAmbiguous,
  DEFAULT_CONFIDENCE_WEIGHTS,
} from "../src/confidence/engine";
import type { EnrichmentConflict } from "../src/conflicts/types";

describe("Confidence engine", () => {
  it("identifier quality: barcode with valid checksum = 1.0", () => {
    assertApprox(computeIdentifierQuality("GTIN_13", true), 1.0);
  });

  it("identifier quality: SKU = 0.3", () => {
    assertApprox(computeIdentifierQuality("SKU", undefined), 0.3);
  });

  it("identifier quality: UNKNOWN = 0.1", () => {
    assertApprox(computeIdentifierQuality("UNKNOWN", undefined), 0.1);
  });

  it("identifier quality: barcode with invalid checksum = 0.6", () => {
    assertApprox(computeIdentifierQuality("GTIN_13", false), 0.6);
  });

  it("overall confidence is bounded to 0-1", () => {
    const v = computeOverallConfidence({
      identifierType: "GTIN_13",
      identifierChecksumValid: true,
      exactIdentifierMatchProviders: 5,
      fieldScores: { "identity.brand": 1, "identity.model": 1 },
      conflicts: [],
      completenessScore: 1,
      weights: {
        ...DEFAULT_CONFIDENCE_WEIGHTS,
        identifierAgreementBonus: 5, // intentionally huge
      },
    });
    assertTruthy(v >= 0 && v <= 1);
  });

  it("conflict penalty reduces confidence", () => {
    const high: EnrichmentConflict = {
      field: "identity.brand",
      candidates: [],
      severity: "HIGH",
    };
    const without = computeOverallConfidence({
      identifierType: "GTIN_13",
      identifierChecksumValid: true,
      exactIdentifierMatchProviders: 1,
      fieldScores: { "identity.brand": 0.9 },
      conflicts: [],
      completenessScore: 1,
    });
    const withConflict = computeOverallConfidence({
      identifierType: "GTIN_13",
      identifierChecksumValid: true,
      exactIdentifierMatchProviders: 1,
      fieldScores: { "identity.brand": 0.9 },
      conflicts: [high],
      completenessScore: 1,
    });
    assertTruthy(withConflict < without);
  });

  it("agreement between 2+ providers boosts confidence", () => {
    const single = computeOverallConfidence({
      identifierType: "GTIN_13",
      identifierChecksumValid: true,
      exactIdentifierMatchProviders: 1,
      fieldScores: { "identity.brand": 0.9 },
      conflicts: [],
      completenessScore: 1,
    });
    const multi = computeOverallConfidence({
      identifierType: "GTIN_13",
      identifierChecksumValid: true,
      exactIdentifierMatchProviders: 2,
      fieldScores: { "identity.brand": 0.9 },
      conflicts: [],
      completenessScore: 1,
    });
    assertTruthy(multi > single);
  });

  it("lower completeness reduces confidence", () => {
    const full = computeOverallConfidence({
      identifierType: "GTIN_13",
      identifierChecksumValid: true,
      exactIdentifierMatchProviders: 1,
      fieldScores: { "identity.brand": 0.9 },
      conflicts: [],
      completenessScore: 1,
    });
    const sparse = computeOverallConfidence({
      identifierType: "GTIN_13",
      identifierChecksumValid: true,
      exactIdentifierMatchProviders: 1,
      fieldScores: { "identity.brand": 0.9 },
      conflicts: [],
      completenessScore: 0.2,
    });
    assertTruthy(sparse < full);
  });

  it("shouldMarkAmbiguous true when 1+ HIGH identity conflict", () => {
    const conflicts: EnrichmentConflict[] = [
      { field: "identity.brand", candidates: [], severity: "HIGH" },
    ];
    assertTruthy(shouldMarkAmbiguous(conflicts));
  });

  it("shouldMarkAmbiguous false for non-identity fields", () => {
    const conflicts: EnrichmentConflict[] = [
      { field: "attributes.color", candidates: [], severity: "HIGH" },
    ];
    assertTruthy(!shouldMarkAmbiguous(conflicts));
  });
});
