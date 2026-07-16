/**
 * Field resolution engine.
 *
 * For each field, the engine inspects all candidates and picks a winner
 * using the following (deterministic) rules, in priority order:
 *
 *   1. Manual-authoritative candidates (when `manualTrustLevel === "authoritative"`).
 *   2. Candidates from providers that returned an exact identifier match
 *      (e.g. barcode match) — tracked via `evidence.exactMatch === true`.
 *   3. Candidates that agree with the majority of providers
 *      (majority = >50% of contributing providers).
 *   4. Candidates from the highest-priority provider (lowest priority number).
 *   5. Candidates with the highest source confidence.
 *   6. First-seen candidate (stable tiebreaker).
 *
 * Conflicts are detected and recorded whenever two candidates disagree in
 * a meaningful way (see `detectConflicts`).
 *
 * The engine emits:
 *   - The resolved value (or undefined when no candidates exist).
 *   - A per-field confidence score.
 *   - A list of conflicts for fields with disagreement.
 */

import type { FieldCandidate } from "../contracts/provider";
import type { EnrichmentConflict } from "../conflicts/types";

export interface ResolvedField<T = unknown> {
  field: string;
  value: T | undefined;
  /** Post-normalization form of `value`, when the winner candidate had one. */
  normalizedValue?: unknown;
  confidence: number;
  contributingProviders: string[];
  conflict?: EnrichmentConflict;
}

export interface ResolutionOptions {
  manualTrustLevel: "evidence" | "authoritative";
}

/**
 * Normalize candidate values for comparison. Two values that normalize to
 * the same string are considered "agreeing".
 */
function compareKey(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.toLowerCase().trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((v) => compareKey(v)).join("|");
  try {
    return JSON.stringify(sortKeys(value as Record<string, unknown>));
  } catch {
    return String(value);
  }
}

function sortKeys(obj: Record<string, unknown>): Record<string, unknown> {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    out[k] = sortKeys(obj[k] as Record<string, unknown>);
  }
  return out;
}

/**
 * Resolve a single field. Returns the chosen value, confidence, and any
 * conflict.
 */
export function resolveField(
  field: string,
  candidates: FieldCandidate[],
  opts: ResolutionOptions
): ResolvedField {
  if (candidates.length === 0) {
    return { field, value: undefined, confidence: 0, contributingProviders: [] };
  }

  // Group by normalized comparison key.
  const groups = new Map<string, FieldCandidate[]>();
  for (const c of candidates) {
    const key = compareKey(c.normalizedValue ?? c.value);
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }

  // Majority group: most providers (de-duplicated) supporting the same value.
  // Tiebreaks:
  //   1. Most candidates in the group.
  //   2. If manualTrustLevel === "authoritative", prefer the group containing
  //      a manual candidate.
  //   3. Lowest priority number among the group's strongest candidate.
  //   4. First-seen (stable via Map insertion order).
  let majorityKey = "";
  let majorityProviderCount = -1;
  let majorityCandidateCount = -1;
  let majorityHasManualAuthoritative = false;
  let majorityTopPriority = Number.POSITIVE_INFINITY;
  for (const [key, list] of groups) {
    const providers = new Set(list.map((c) => c.providerId));
    const hasManualAuth =
      opts.manualTrustLevel === "authoritative" &&
      list.some((c) => c.providerId === "manual");
    const topPriority = list.reduce(
      (min, c) => (c.providerPriority < min ? c.providerPriority : min),
      Number.POSITIVE_INFINITY
    );

    let take = false;
    if (providers.size > majorityProviderCount) {
      take = true;
    } else if (providers.size === majorityProviderCount) {
      if (list.length > majorityCandidateCount) {
        take = true;
      } else if (list.length === majorityCandidateCount) {
        // Same provider count AND same candidate count → apply manual / priority tiebreakers.
        if (hasManualAuth && !majorityHasManualAuthoritative) {
          take = true;
        } else if (hasManualAuth === majorityHasManualAuthoritative) {
          if (topPriority < majorityTopPriority) {
            take = true;
          }
        }
      }
    }
    if (take) {
      majorityKey = key;
      majorityProviderCount = providers.size;
      majorityCandidateCount = list.length;
      majorityHasManualAuthoritative = hasManualAuth;
      majorityTopPriority = topPriority;
    }
  }
  const majorityGroup = groups.get(majorityKey)!;
  const majorityProviders = new Set(majorityGroup.map((c) => c.providerId));

  // Candidate selection within the majority group:
  //   1. Manual authoritative
  //   2. Exact-match evidence
  //   3. Lowest priority number
  //   4. Highest source confidence
  //   5. First-seen (stable)
  const sortedMajority = [...majorityGroup].sort((a, b) => {
    const aAuth = opts.manualTrustLevel === "authoritative" && a.providerId === "manual" ? 1 : 0;
    const bAuth = opts.manualTrustLevel === "authoritative" && b.providerId === "manual" ? 1 : 0;
    if (aAuth !== bAuth) return bAuth - aAuth;

    const aExact = a.evidence?.exactMatch === true ? 1 : 0;
    const bExact = b.evidence?.exactMatch === true ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;

    if (a.providerPriority !== b.providerPriority) return a.providerPriority - b.providerPriority;

    if (b.sourceConfidence !== a.sourceConfidence) return b.sourceConfidence - a.sourceConfidence;

    return 0; // preserve original order
  });

  const winner = sortedMajority[0];
  const totalProviders = new Set(candidates.map((c) => c.providerId)).size;
  const agreementRatio = totalProviders > 0 ? majorityProviders.size / totalProviders : 0;

  // Confidence: weighted by agreement ratio and source confidence.
  const avgSourceConf =
    majorityGroup.reduce((s, c) => s + c.sourceConfidence, 0) / majorityGroup.length;
  const baseConf = 0.5 * avgSourceConf + 0.5 * agreementRatio;

  // Bonus when the winner has exact-match evidence.
  const exactBonus = winner.evidence?.exactMatch === true ? 0.1 : 0;

  // Bonus when 3+ providers agree (strong corroboration).
  const corroborationBonus = majorityProviders.size >= 3 ? 0.05 : 0;

  const confidence = clamp01(baseConf + exactBonus + corroborationBonus);

  // Conflict detection: any other group exists with a different value.
  let conflict: EnrichmentConflict | undefined;
  if (groups.size > 1) {
    const candidateEntries = Array.from(groups.values()).map((list) => {
      // Pick the strongest candidate from each disagreeing group for the conflict record.
      const strongest = [...list].sort(
        (a, b) => b.sourceConfidence - a.sourceConfidence
      )[0];
      return {
        value: strongest.value,
        providerId: strongest.providerId,
        confidence: strongest.sourceConfidence,
      };
    });

    // Sort candidates by confidence desc, then providerId asc for determinism.
    candidateEntries.sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return a.providerId.localeCompare(b.providerId);
    });

    const severity = conflictSeverity(field, groups.size, totalProviders);
    conflict = {
      field,
      candidates: candidateEntries,
      severity,
      resolution: `Accepted value from provider "${winner.providerId}" (priority=${winner.providerPriority}, sourceConf=${winner.sourceConfidence.toFixed(2)}, agreement=${majorityProviders.size}/${totalProviders}).`,
    };
  }

  return {
    field,
    value: winner.value,
    normalizedValue: winner.normalizedValue,
    confidence,
    contributingProviders: Array.from(majorityProviders),
    conflict,
  };
}

/**
 * Determine conflict severity based on field and disagreement.
 *
 * Identity fields (brand, model, manufacturer, canonicalTitle) and
 * identifier fields produce HIGH severity when they disagree — these can
 * trigger AMBIGUOUS status.
 *
 * Measurement fields (dimensions, weight) produce MEDIUM severity.
 * Soft fields (color, description, bullets) produce LOW severity.
 */
function conflictSeverity(
  field: string,
  groupCount: number,
  totalProviders: number
): "LOW" | "MEDIUM" | "HIGH" {
  const highSeverityFields = new Set([
    "identity.brand",
    "identity.model",
    "identity.manufacturer",
    "identity.canonicalTitle",
    "identifiers.upc",
    "identifiers.ean",
    "identifiers.gtin",
    "identifiers.isbn",
  ]);
  const mediumSeverityFields = new Set([
    "attributes.dimensions",
    "attributes.weight",
    "classification.category",
    "attributes.mpn",
  ]);

  if (highSeverityFields.has(field)) {
    // Identity disagreement between 2+ providers is high severity.
    if (totalProviders >= 2) return "HIGH";
    return "MEDIUM";
  }
  if (mediumSeverityFields.has(field)) return "MEDIUM";

  // For soft fields, severity is low unless many providers disagree.
  if (groupCount >= 3) return "MEDIUM";
  return "LOW";
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return Math.round(v * 1000) / 1000;
}
