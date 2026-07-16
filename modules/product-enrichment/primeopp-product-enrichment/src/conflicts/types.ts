/**
 * Conflict-related types. The resolution engine emits these whenever two or
 * more candidates for the same field disagree in a meaningful way.
 */

export interface EnrichmentConflictCandidate {
  value: unknown;
  providerId: string;
  confidence: number;
}

export interface EnrichmentConflict {
  /** Dotted field path (e.g. "identity.brand"). */
  field: string;
  candidates: EnrichmentConflictCandidate[];
  severity: "LOW" | "MEDIUM" | "HIGH";
  /** Human-readable explanation of how the conflict was (or was not) resolved. */
  resolution?: string;
}
