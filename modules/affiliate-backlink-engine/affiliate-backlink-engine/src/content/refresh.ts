/**
 * Affiliate Content Refresh Prioritizer (Mission 10).
 *
 * Prioritizes existing content that should be improved before backlink campaigns.
 * Scores based on supplied data such as:
 *  - commercial importance
 *  - ranking position
 *  - content age
 *  - backlink opportunity availability
 *  - competitor gap
 *  - internal linking weakness
 *  - conversion relevance
 *  - content completeness
 *
 * Does NOT fabricate ranking data if none is supplied.
 */
import { TargetPage } from "../domain/site.js";
import { LinkOpportunity } from "../domain/opportunity.js";

export interface RefreshInput {
  page: TargetPage;
  /** Optional ranking position (1..N). If absent, no ranking-based score. */
  rankingPosition?: number;
  /** Commercial importance 0..1. */
  commercialImportance?: number;
  /** Content age in days. */
  contentAgeDays?: number;
  /** Backlink opportunity count available for this page's topic. */
  backlinkOpportunityCount?: number;
  /** Competitor gap strength 0..1. */
  competitorGap?: number;
  /** Internal linking weakness 0..1. */
  internalLinkWeakness?: number;
  /** Conversion relevance 0..1. */
  conversionRelevance?: number;
  /** Content completeness 0..1. */
  contentCompleteness?: number;
}

export interface RefreshPriority {
  pageId: string;
  score: number; // 0..100
  priority: "HIGH" | "MEDIUM" | "LOW";
  recommendedChanges: string[];
  unlockedOpportunities: string[];
  strategicReason: string;
  /** Data sources actually used (so we don't claim ranking data we don't have). */
  dataSourcesUsed: string[];
}

export interface RefreshOptions {
  /** Optional opportunities, used to count unlocked opportunities per page. */
  opportunities?: LinkOpportunity[];
}

export function prioritizeRefresh(input: RefreshInput, opts: RefreshOptions = {}): RefreshPriority {
  const recommendedChanges: string[] = [];
  const unlocked: string[] = [];
  const used: string[] = [];

  let score = 0;
  // Commercial importance (0..1) -> 0..30
  if (input.commercialImportance !== undefined) {
    score += input.commercialImportance * 30;
    used.push("commercialImportance");
    if (input.commercialImportance > 0.6) recommendedChanges.push("Strengthen commercial CTAs and product comparisons.");
  }
  // Ranking position: pages near top of page 2 (11..15) are highest priority
  if (input.rankingPosition !== undefined) {
    used.push("rankingPosition");
    const rp = input.rankingPosition;
    if (rp >= 11 && rp <= 15) score += 25;
    else if (rp >= 6 && rp <= 10) score += 18;
    else if (rp >= 16 && rp <= 20) score += 15;
    else if (rp > 20) score += 8;
    else if (rp <= 5) score += 5; // already ranking, less urgent
    recommendedChanges.push(`Refresh on-page SEO to push from position ${rp}.`);
  } else {
    // No ranking data: do not infer one. Add a neutral note.
    recommendedChanges.push("Refresh content quality (no ranking data supplied).");
  }
  // Content age: older content benefits more.
  if (input.contentAgeDays !== undefined) {
    used.push("contentAgeDays");
    const ageScore = Math.min(15, input.contentAgeDays / 30);
    score += ageScore;
    if (input.contentAgeDays > 365) recommendedChanges.push("Update statistics, dates, and examples (content >1 year old).");
  }
  // Backlink opportunity availability.
  if (input.backlinkOpportunityCount !== undefined) {
    used.push("backlinkOpportunityCount");
    score += Math.min(15, input.backlinkOpportunityCount * 3);
    unlocked.push(`${input.backlinkOpportunityCount} backlink opportunities waiting for refreshed content.`);
  }
  // Competitor gap.
  if (input.competitorGap !== undefined) {
    used.push("competitorGap");
    score += input.competitorGap * 10;
    if (input.competitorGap > 0.5) recommendedChanges.push("Close competitor content gap with deeper coverage.");
  }
  // Internal linking weakness.
  if (input.internalLinkWeakness !== undefined) {
    used.push("internalLinkWeakness");
    score += input.internalLinkWeakness * 10;
    if (input.internalLinkWeakness > 0.5) recommendedChanges.push("Add internal links from related high-authority pages.");
  }
  // Conversion relevance.
  if (input.conversionRelevance !== undefined) {
    used.push("conversionRelevance");
    score += input.conversionRelevance * 10;
  }
  // Content completeness (inverse: less complete -> higher priority).
  if (input.contentCompleteness !== undefined) {
    used.push("contentCompleteness");
    score += (1 - input.contentCompleteness) * 10;
    if (input.contentCompleteness < 0.5) recommendedChanges.push("Expand thin sections and add missing subtopics.");
  }

  // Add unlocked opportunities from supplied list (match by targetPageId).
  if (opts.opportunities) {
    const matched = opts.opportunities.filter((o) => o.targetPageId === input.page.id);
    for (const m of matched) {
      unlocked.push(`${m.kind} opportunity: ${m.id}`);
    }
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const priority: RefreshPriority["priority"] = finalScore >= 70 ? "HIGH" : finalScore >= 40 ? "MEDIUM" : "LOW";
  const strategicReason = composeStrategicReason(input, finalScore, used);

  return {
    pageId: input.page.id,
    score: finalScore,
    priority,
    recommendedChanges,
    unlockedOpportunities: unlocked,
    strategicReason,
    dataSourcesUsed: used
  };
}

export function prioritizeBatch(
  inputs: RefreshInput[],
  opts: RefreshOptions = {}
): RefreshPriority[] {
  return inputs
    .map((i) => prioritizeRefresh(i, opts))
    .sort((a, b) => b.score - a.score);
}

function composeStrategicReason(input: RefreshInput, score: number, used: string[]): string {
  const bits: string[] = [];
  if (used.includes("rankingPosition") && input.rankingPosition !== undefined) {
    bits.push(`currently ranking ~${input.rankingPosition}`);
  }
  if (used.includes("commercialImportance") && input.commercialImportance !== undefined && input.commercialImportance > 0.5) {
    bits.push("high commercial importance");
  }
  if (used.includes("contentAgeDays") && input.contentAgeDays !== undefined && input.contentAgeDays > 365) {
    bits.push(`content is ${Math.round(input.contentAgeDays / 365)} year(s) old`);
  }
  if (bits.length === 0) bits.push("limited data supplied");
  return `Refresh priority ${score}/100 because: ${bits.join(", ")}.`;
}
