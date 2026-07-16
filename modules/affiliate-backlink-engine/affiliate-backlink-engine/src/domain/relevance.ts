/**
 * Relevance models: topical + commercial + audience alignment.
 *
 * Relevance MUST be explainable, never a single opaque number.
 */
export interface TopicalRelevance {
  /** Free-text topic label, e.g. "affiliate marketing", "kitchen appliances". */
  topic: string;
  /** 0..1 similarity to the target property's declared topic. */
  similarity: number;
  /** Human-readable reason, e.g. "shared keyword cluster: 'best espresso machines'". */
  reason: string;
  /** Optional shared keyword cluster. */
  sharedKeywords?: string[];
}

export interface CommercialRelevance {
  /** 0..1 alignment with the target property's commercial intent. */
  alignment: number;
  /** e.g. "affiliate", "ecommerce", "leadgen", "editorial", "nonprofit". */
  intent: "affiliate" | "ecommerce" | "leadgen" | "editorial" | "nonprofit" | "informational" | "unknown";
  /** Reason for the alignment score. */
  reason: string;
}

export interface AudienceAlignment {
  /** 0..1 estimated audience overlap. */
  overlap: number;
  /** Reason, e.g. "shared demographic: US-based content creators". */
  reason: string;
  /** Optional evidence-backed signals. */
  signals?: string[];
}

export function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
