/**
 * Risk flag model.
 *
 * Risk outputs are categorical: LOW | MEDIUM | HIGH | REJECT.
 * The engine MUST never overclaim certainty. Every RiskFlag carries a reason
 * and a confidence (0..1). Confidence < 0.5 means "suspected but unverified".
 */
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "REJECT";

export const RISK_LEVELS: readonly RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "REJECT"] as const;

export const RISK_LEVEL_RANK: Record<RiskLevel, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  REJECT: 3
};

export type RiskSignalKind =
  | "link_farm"
  | "excessive_outbound_links"
  | "irrelevant_domain"
  | "suspicious_directory_network"
  | "thin_content"
  | "adult_gambling_illegal_mismatch"
  | "paid_link_solicitation"
  | "duplicate_domain"
  | "duplicate_opportunity"
  | "stale_opportunity"
  | "unreachable_page"
  | "non_editorial_source"
  | "pbn_suspicion"
  | "low_trust_signals"
  | "robots_blocked"
  | "spam_pattern"
  | "unknown";

export interface RiskFlag {
  kind: RiskSignalKind;
  level: RiskLevel;
  reason: string;
  /** 0..1 confidence in the risk assessment itself. */
  confidence: number;
  /** Optional evidence id backing this flag. */
  evidenceId?: string;
}

export function worstRisk(flags: RiskFlag[]): RiskLevel {
  if (flags.length === 0) return "LOW";
  let worst: RiskLevel = "LOW";
  for (const f of flags) {
    if (RISK_LEVEL_RANK[f.level] > RISK_LEVEL_RANK[worst]) worst = f.level;
  }
  return worst;
}

export function isRejected(flags: RiskFlag[]): boolean {
  return worstRisk(flags) === "REJECT";
}

export function shouldSuppressFromOutreach(flags: RiskFlag[]): boolean {
  const w = worstRisk(flags);
  return w === "REJECT" || w === "HIGH";
}
