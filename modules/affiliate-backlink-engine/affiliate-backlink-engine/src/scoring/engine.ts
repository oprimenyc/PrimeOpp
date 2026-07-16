/**
 * Opportunity Scoring Engine (Mission 7).
 *
 * Transparent scoring model. Components:
 *  - topical_relevance
 *  - audience_alignment
 *  - target_page_fit
 *  - commercial_relevance
 *  - evidence_confidence
 *  - competitor_overlap
 *  - editorial_legitimacy
 *  - acquisition_difficulty (inverse)
 *  - content_readiness
 *  - relationship_potential
 *  - risk_inverse (penalizes risk)
 *  - freshness
 *  - strategic_value
 *
 * Provider-supplied metrics MAY contribute but never dominate.
 */
import {
  OpportunityScore,
  ScoreComponent,
  ScoreRecommendedAction,
  clampScore
} from "../domain/scoring.js";
import { LinkOpportunity } from "../domain/opportunity.js";
import { RiskFlag, worstRisk, RISK_LEVEL_RANK } from "../domain/risk.js";
import { TargetPage, ContentAsset } from "../domain/site.js";
import { EvidenceRecord } from "../domain/evidence.js";
import { shouldRevalidate } from "../domain/verification.js";

export const SCORING_MODEL_VERSION = "transparent-v1";

export interface ScoringWeights {
  topical_relevance: number;
  audience_alignment: number;
  target_page_fit: number;
  commercial_relevance: number;
  evidence_confidence: number;
  competitor_overlap: number;
  editorial_legitimacy: number;
  acquisition_difficulty: number; // higher = harder
  content_readiness: number;
  relationship_potential: number;
  risk_inverse: number;
  freshness: number;
  strategic_value: number;
  /** Optional provider metric (e.g. authority). Capped weight. */
  provider_authority: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  topical_relevance: 0.18,
  audience_alignment: 0.06,
  target_page_fit: 0.1,
  commercial_relevance: 0.08,
  evidence_confidence: 0.1,
  competitor_overlap: 0.08,
  editorial_legitimacy: 0.08,
  acquisition_difficulty: 0.06,
  content_readiness: 0.06,
  relationship_potential: 0.04,
  risk_inverse: 0.06,
  freshness: 0.04,
  strategic_value: 0.04,
  provider_authority: 0.02
};

export interface ScoringContext {
  /** Target page on our property (if matched). */
  matchedTargetPage?: TargetPage;
  /** Matched content asset (if any). */
  matchedAsset?: ContentAsset;
  /** Whether content refresh is required before outreach. */
  contentRefreshRequired?: boolean;
  /** Whether content already exists and is suitable. */
  contentReady?: boolean;
  /** Provider-supplied authority (0..100), if any. */
  providerAuthority?: number;
  /** Strategic value multiplier 0..2 (default 1). */
  strategicValueMultiplier?: number;
  /** Relationship prior 0..1 (existing relationship). */
  relationshipPrior?: number;
  /** Acquisition difficulty 0..1 (higher = harder). */
  acquisitionDifficulty?: number;
  /** Audience alignment 0..1. */
  audienceAlignment?: number;
  /** All evidence records (to assess confidence). */
  evidence: EvidenceRecord[];
  now?: number;
  /** Optional weights override. */
  weights?: Partial<ScoringWeights>;
}

export function scoreOpportunity(
  opp: LinkOpportunity,
  ctx: ScoringContext
): OpportunityScore {
  const weights: ScoringWeights = { ...DEFAULT_WEIGHTS, ...(ctx.weights ?? {}) };
  const now = ctx.now ?? Date.now();
  const components: ScoreComponent[] = [];

  // 1. Topical relevance
  const topSim = opp.topical?.similarity ?? 0;
  components.push({
    name: "topical_relevance",
    score: topSim * 100,
    weight: weights.topical_relevance,
    explanation: opp.topical?.reason ?? "No topical relevance computed.",
    evidenceIds: opp.evidenceIds
  });

  // 2. Audience alignment
  const audAlign = opp.audience?.overlap ?? ctx.audienceAlignment ?? 0.5;
  components.push({
    name: "audience_alignment",
    score: audAlign * 100,
    weight: weights.audience_alignment,
    explanation: opp.audience?.reason ?? "Audience alignment not directly measured; default 0.5."
  });

  // 3. Target page fit
  const fitScore = ctx.matchedTargetPage ? (ctx.contentReady ? 100 : 60) : 0;
  components.push({
    name: "target_page_fit",
    score: fitScore,
    weight: weights.target_page_fit,
    explanation: ctx.matchedTargetPage
      ? `Matched target page: ${ctx.matchedTargetPage.url}`
      : "No matched target page on our property."
  });

  // 4. Commercial relevance
  const commAlign = opp.commercial?.alignment ?? 0.3;
  components.push({
    name: "commercial_relevance",
    score: commAlign * 100,
    weight: weights.commercial_relevance,
    explanation: opp.commercial?.reason ?? "Commercial relevance unknown; default 0.3."
  });

  // 5. Evidence confidence
  const evConfidence = computeEvidenceConfidence(opp, ctx.evidence, now);
  components.push({
    name: "evidence_confidence",
    score: evConfidence * 100,
    weight: weights.evidence_confidence,
    explanation: `Evidence base: ${opp.evidenceIds.length} record(s), confidence ${evConfidence.toFixed(2)}.`,
    evidenceIds: opp.evidenceIds
  });

  // 6. Competitor overlap
  const overlap =
    opp.kind === "competitor_backlink_gap" ? opp.competitorOverlap : 0;
  const overlapScore = Math.min(100, overlap * 25);
  components.push({
    name: "competitor_overlap",
    score: overlapScore,
    weight: weights.competitor_overlap,
    explanation:
      opp.kind === "competitor_backlink_gap"
        ? `${overlap} competitor(s) link from this source.`
        : "Not a competitor-gap opportunity."
  });

  // 7. Editorial legitimacy (inverse of risk)
  const worst = worstRisk(opp.riskFlags);
  const legitScore = 100 - RISK_LEVEL_RANK[worst] * 25;
  components.push({
    name: "editorial_legitimacy",
    score: legitScore,
    weight: weights.editorial_legitimacy,
    explanation: `Worst risk level: ${worst}.`
  });

  // 8. Acquisition difficulty (inverse)
  const difficulty = ctx.acquisitionDifficulty ?? defaultDifficulty(opp);
  const diffScore = (1 - difficulty) * 100;
  components.push({
    name: "acquisition_difficulty",
    score: diffScore,
    weight: weights.acquisition_difficulty,
    explanation: `Estimated acquisition difficulty: ${difficulty.toFixed(2)} (higher = harder).`
  });

  // 9. Content readiness
  const ready = ctx.contentReady ?? !(ctx.contentRefreshRequired ?? false);
  components.push({
    name: "content_readiness",
    score: ready ? 100 : 30,
    weight: weights.content_readiness,
    explanation: ready
      ? "Existing content is suitable for outreach."
      : "Content refresh or creation required before outreach."
  });

  // 10. Relationship potential
  const rel = ctx.relationshipPrior ?? 0;
  components.push({
    name: "relationship_potential",
    score: rel * 100,
    weight: weights.relationship_potential,
    explanation: rel > 0 ? `Existing relationship prior: ${rel.toFixed(2)}.` : "No prior relationship."
  });

  // 11. Risk inverse (penalty)
  const riskPenalty = RISK_LEVEL_RANK[worst] * 25;
  components.push({
    name: "risk_inverse",
    score: 100 - riskPenalty,
    weight: weights.risk_inverse,
    explanation: `Risk penalty: -${riskPenalty} based on worst flag ${worst}.`
  });

  // 12. Freshness
  const ageMs = now - (opp.discoveredAt ?? now);
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  const freshnessScore = Math.max(0, 100 - ageDays * 5);
  components.push({
    name: "freshness",
    score: freshnessScore,
    weight: weights.freshness,
    explanation: `Discovered ${ageDays.toFixed(1)} days ago.`
  });

  // 13. Strategic value
  const stratMult = ctx.strategicValueMultiplier ?? 1;
  components.push({
    name: "strategic_value",
    score: clampScore(Math.min(100, 50 * stratMult)),
    weight: weights.strategic_value,
    explanation: `Strategic value multiplier: ${stratMult}.`
  });

  // 14. Provider authority (optional, capped weight)
  const pa = ctx.providerAuthority ?? 0;
  components.push({
    name: "provider_authority",
    score: pa,
    weight: weights.provider_authority,
    explanation: ctx.providerAuthority !== undefined ? `Provider authority: ${pa}/100.` : "No provider authority supplied."
  });

  // Weighted total
  const total = clampScore(
    components.reduce((sum, c) => sum + c.score * c.weight, 0)
  );

  const confidence = Math.min(1, evConfidence + (opp.evidenceIds.length > 0 ? 0.1 : 0));
  const recommendedAction = recommendAction(total, worst, ctx.contentReady ?? true, evConfidence);
  const score: OpportunityScore = {
    total,
    components,
    confidence,
    recommendedAction,
    riskFlags: opp.riskFlags,
    modelVersion: SCORING_MODEL_VERSION,
    scoredAt: now
  };
  return score;
}

function computeEvidenceConfidence(
  opp: LinkOpportunity,
  evidence: EvidenceRecord[],
  now: number
): number {
  if (opp.evidenceIds.length === 0) return 0.1;
  const relevant = evidence.filter((e) => opp.evidenceIds.includes(e.id));
  if (relevant.length === 0) return 0.2;
  let confSum = 0;
  for (const r of relevant) {
    let c = r.verification === "VERIFIED" ? 1 : r.verification === "DISCOVERED" ? 0.6 : r.verification === "INFERRED" ? 0.4 : 0.2;
    // Penalty if stale.
    if (r.verification === "VERIFIED" && shouldRevalidate(r.observedAt, now)) c *= 0.5;
    confSum += c;
  }
  return Math.min(1, confSum / relevant.length);
}

function defaultDifficulty(opp: LinkOpportunity): number {
  switch (opp.kind) {
    case "broken_link":
      return 0.3; // easier, since we have a clear win-win
    case "resource_page":
      return 0.4;
    case "unlinked_mention":
      return 0.25; // easiest, they already mention us
    case "competitor_backlink_gap":
      return 0.6;
    case "linkable_asset":
      return 0.7;
    case "internal_link":
      return 0.05; // trivial, we control both ends
    default:
      return 0.5;
  }
}

function recommendAction(
  total: number,
  worstRiskLevel: ReturnType<typeof worstRisk>,
  contentReady: boolean,
  evidenceConfidence: number
): ScoreRecommendedAction {
  if (worstRiskLevel === "REJECT") return "REJECT";
  if (worstRiskLevel === "HIGH") return "DEFER";
  if (evidenceConfidence < 0.3) return "NEEDS_EVIDENCE";
  if (!contentReady) return "PURSUE_AFTER_REFRESH";
  if (total >= 70) return "PURSUE_NOW";
  if (total >= 50) return "PURSUE_WITH_CAUTION";
  return "DEFER";
}

/**
 * Sort opportunities by total score (descending). Stable.
 */
export function rankByScore(scored: Array<{ opp: LinkOpportunity; score: OpportunityScore }>): Array<{
  opp: LinkOpportunity;
  score: OpportunityScore;
}> {
  return [...scored].sort((a, b) => b.score.total - a.score.total);
}
