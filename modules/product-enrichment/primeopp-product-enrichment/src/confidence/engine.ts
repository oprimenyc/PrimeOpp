/**
 * Confidence engine.
 *
 * Computes the overall operational confidence for an enriched profile and
 * per-field confidence scores.
 *
 * IMPORTANT: This is an OPERATIONAL confidence score, NOT a scientifically
 * calibrated probability. It is a deterministic, weighted blend of signals
 * that downstream systems can use to gate actions (e.g. require manual
 * review below 0.6).
 *
 * Signals considered (weights are configurable):
 *
 *   1. Identifier quality (0.0 - 1.0)
 *      - 1.0 for a checksum-valid barcode or ISBN.
 *      - 0.6 for a format-valid but checksum-invalid identifier.
 *      - 0.3 for SKU only.
 *      - 0.1 for manual-only input.
 *
 *   2. Identifier agreement across providers
 *      - +0.10 if 2+ providers independently returned the same barcode/ISBN.
 *
 *   3. Average per-field confidence across resolved fields.
 *
 *   4. Provider reliability weight
 *      - Configurable per provider. Defaults to 0.5. Fixture provider is 0.8
 *        to reflect that it is deterministic. Manual provider is 0.6.
 *
 *   5. Conflict penalty
 *      - -0.10 per HIGH severity conflict.
 *      - -0.05 per MEDIUM severity conflict.
 *      - -0.01 per LOW severity conflict (capped at -0.05 total).
 *
 *   6. Completeness multiplier
 *      - final = base * (0.5 + 0.5 * completeness.score)
 *        Half credit when the profile is sparse.
 *
 * The final score is clamped to [0, 1] and rounded to 3 decimal places.
 */

import type { EnrichedProductProfile } from "../contracts/output";
import type { EnrichmentConflict } from "../conflicts/types";
import type { ProductIdentifierType } from "../contracts/input";

export interface ConfidenceWeights {
  identifierQuality: number;
  identifierAgreementBonus: number;
  fieldConfidence: number;
  conflictPenaltyHigh: number;
  conflictPenaltyMedium: number;
  conflictPenaltyLowCap: number;
  completenessMultiplierBase: number;
  completenessMultiplierRange: number;
}

export const DEFAULT_CONFIDENCE_WEIGHTS: ConfidenceWeights = {
  identifierQuality: 0.30,
  identifierAgreementBonus: 0.10,
  fieldConfidence: 0.40,
  conflictPenaltyHigh: 0.10,
  conflictPenaltyMedium: 0.05,
  conflictPenaltyLowCap: 0.05,
  completenessMultiplierBase: 0.5,
  completenessMultiplierRange: 0.5,
};

export interface ConfidenceInputs {
  identifierType?: ProductIdentifierType;
  identifierChecksumValid?: boolean;
  exactIdentifierMatchProviders: number;
  fieldScores: Record<string, number>;
  conflicts: EnrichmentConflict[];
  completenessScore: number;
  weights?: Partial<ConfidenceWeights>;
}

export function computeIdentifierQuality(
  identifierType?: ProductIdentifierType,
  checksumValid?: boolean
): number {
  if (!identifierType || identifierType === "UNKNOWN") return 0.1;
  if (identifierType === "SKU") return 0.3;

  // GS1 / ISBN family
  if (checksumValid === true) return 1.0;
  if (checksumValid === false) return 0.6;
  // Unknown checksum validity
  return 0.6;
}

export function computeOverallConfidence(inputs: ConfidenceInputs): number {
  const w: ConfidenceWeights = { ...DEFAULT_CONFIDENCE_WEIGHTS, ...inputs.weights };

  const identifierQuality = computeIdentifierQuality(
    inputs.identifierType,
    inputs.identifierChecksumValid
  );

  const identifierAgreement =
    inputs.exactIdentifierMatchProviders >= 2 ? w.identifierAgreementBonus : 0;

  const fieldScoreValues = Object.values(inputs.fieldScores);
  const avgFieldConfidence =
    fieldScoreValues.length > 0
      ? fieldScoreValues.reduce((s, v) => s + v, 0) / fieldScoreValues.length
      : 0;

  let conflictPenalty = 0;
  let lowPenalty = 0;
  for (const c of inputs.conflicts) {
    if (c.severity === "HIGH") conflictPenalty += w.conflictPenaltyHigh;
    else if (c.severity === "MEDIUM") conflictPenalty += w.conflictPenaltyMedium;
    else lowPenalty += 0.01;
  }
  lowPenalty = Math.min(lowPenalty, w.conflictPenaltyLowCap);
  conflictPenalty += lowPenalty;

  const base =
    w.identifierQuality * identifierQuality +
    w.fieldConfidence * avgFieldConfidence +
    identifierAgreement;

  const penalized = Math.max(0, base - conflictPenalty);

  const completenessMultiplier =
    w.completenessMultiplierBase +
    w.completenessMultiplierRange * inputs.completenessScore;

  const final = penalized * completenessMultiplier;
  return clamp01(final);
}

export function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return Math.round(v * 1000) / 1000;
}

/**
 * Determine whether a profile contains enough HIGH-severity identity conflicts
 * to warrant AMBIGUOUS status.
 */
export function shouldMarkAmbiguous(
  conflicts: EnrichmentConflict[],
  threshold = 1
): boolean {
  const highIdentityConflicts = conflicts.filter(
    (c) =>
      c.severity === "HIGH" &&
      (c.field.startsWith("identity.") || c.field.startsWith("identifiers."))
  );
  return highIdentityConflicts.length >= threshold;
}
