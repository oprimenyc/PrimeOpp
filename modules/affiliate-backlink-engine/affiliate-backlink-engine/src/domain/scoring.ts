/**
 * Opportunity Score.
 *
 * Transparency rule: a score is meaningless without its components and explanation.
 * The engine MUST never present a single number without:
 *  - component breakdown
 *  - confidence
 *  - recommended action
 *  - risk flags
 *
 * Provider-supplied metrics (e.g. proprietary "domain authority") MAY be used
 * as one component among many but MUST NOT be the sole driver.
 */
import { RiskFlag } from "./risk.js";

export interface ScoreComponent {
  /** Component name, e.g. "topical_relevance", "evidence_confidence". */
  name: string;
  /** 0..100 normalized score. */
  score: number;
  /** Weight used (0..1). */
  weight: number;
  /** Human-readable explanation. */
  explanation: string;
  /** Optional evidence references. */
  evidenceIds?: string[];
}

export interface OpportunityScore {
  /** 0..100 total score (weighted sum of components). */
  total: number;
  /** Component breakdown. */
  components: ScoreComponent[];
  /** 0..1 confidence in the score itself (lower when evidence is thin). */
  confidence: number;
  /** Recommended next action. */
  recommendedAction: ScoreRecommendedAction;
  /** Risk flags considered. */
  riskFlags: RiskFlag[];
  /** Scoring model version, for reproducibility. */
  modelVersion: string;
  /** Timestamp. */
  scoredAt: number;
}

export type ScoreRecommendedAction =
  | "PURSUE_NOW"
  | "PURSUE_AFTER_REFRESH"
  | "PURSUE_WITH_CAUTION"
  | "DEFER"
  | "REJECT"
  | "NEEDS_EVIDENCE";

export function clampScore(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 100) return 100;
  return Math.round(x * 10) / 10;
}

export function summarizeScore(s: OpportunityScore): string {
  const top = [...s.components].sort((a, b) => b.score * b.weight - a.score * a.weight).slice(0, 3);
  const parts = top.map((c) => `${c.name}=${c.score.toFixed(1)}`);
  return `total=${s.total.toFixed(1)} confidence=${s.confidence.toFixed(2)} action=${s.recommendedAction} top=[${parts.join(", ")}]`;
}
