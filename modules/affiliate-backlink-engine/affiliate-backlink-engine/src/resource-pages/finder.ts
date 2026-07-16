/**
 * Resource-Page Opportunity Finder (Mission 6).
 *
 * Identifies pages likely to curate useful resources.
 * Classifies:
 *  - industry resources
 *  - educational resources
 *  - product guides
 *  - nonprofit resources
 *  - directories
 *  - expert resources
 *  - statistics/reference pages
 *  - niche community resources
 *
 * Scores relevance to the target property.
 * Avoids low-quality generic directories by default.
 */
import { ResourcePageOpportunity, dedupKeyFor } from "../domain/opportunity.js";
import { LinkingDomain, LinkingPage } from "../domain/backlink.js";
import { deterministicId } from "../domain/ids.js";
import { EvidenceRecord, EvidenceSource } from "../domain/evidence.js";
import { quickTopicalRelevance } from "../discovery/discovery.js";
import { RiskFlag } from "../domain/risk.js";
import { normalizeUrl } from "../utils/url.js";

export interface ResourcePageInput {
  url: string;
  title?: string;
  snippet?: string;
  hint?: string;
}

export interface ResourcePageOptions {
  siteProfileId: string;
  targetTopics: string[];
  recordEvidence: (e: Omit<EvidenceRecord, "id">) => EvidenceRecord;
  now?: number;
  /** Minimum similarity to be considered relevant. */
  minSimilarity?: number;
}

export interface ResourcePageResult {
  opportunity: ResourcePageOpportunity;
  linkingDomain: LinkingDomain;
  linkingPage: LinkingPage;
  relevanceScore: number; // 0..1
  riskFlags: RiskFlag[];
}

export function analyzeResourcePages(
  inputs: ResourcePageInput[],
  opts: ResourcePageOptions
): ResourcePageResult[] {
  const now = opts.now ?? Date.now();
  const minSim = opts.minSimilarity ?? 0.05;
  const evSource: EvidenceSource = { adapter: "resource-page-finder", providerKind: "internal" };

  const results: ResourcePageResult[] = [];
  for (const input of inputs) {
    const n = normalizeUrl(input.url);
    if (!n) continue;
    const classification = classifyResourcePage(n.href, input.title ?? "", input.snippet ?? "", input.hint);
    const topical = quickTopicalRelevance(opts.targetTopics.join(" "), input.title ?? input.snippet ?? n.href, []);
    if (topical.similarity < minSim) continue;
    const riskFlags = resourcePageRiskFlags(n.href, input.title ?? "", classification);
    if (riskFlags.some((f) => f.level === "REJECT")) continue;

    const ld: LinkingDomain = {
      id: deterministicId("linkingDomain", [n.rootDomain]),
      domain: n.rootDomain,
      verification: "DISCOVERED"
    };
    const lp: LinkingPage = {
      id: deterministicId("linkingPage", [n.href]),
      linkingDomainId: ld.id,
      url: n.href,
      title: input.title,
      verification: "DISCOVERED",
      topical
    };

    const dedupKey = dedupKeyFor("resource_page", [n.href]);
    const ev = opts.recordEvidence({
      kind: "resource_page_observation",
      subjectId: deterministicId("opportunity", [dedupKey]),
      claim: `Resource page (${classification}): ${n.href}`,
      observedAt: now,
      source: evSource,
      verification: "DISCOVERED",
      payload: { url: n.href, title: input.title, classification }
    });

    const opp: ResourcePageOpportunity = {
      id: deterministicId("opportunity", [dedupKey]),
      siteProfileId: opts.siteProfileId,
      kind: "resource_page",
      dedupKey,
      verification: "DISCOVERED",
      evidenceIds: [ev.id],
      linkingDomainId: ld.id,
      linkingPageId: lp.id,
      classification,
      acceptsSubmissionsInferred: classification === "directory" || classification === "niche_community_resource",
      topical,
      riskFlags,
      discoveredAt: now
    };
    results.push({
      opportunity: opp,
      linkingDomain: ld,
      linkingPage: lp,
      relevanceScore: topical.similarity,
      riskFlags
    });
  }
  return results;
}

export function classifyResourcePage(
  url: string,
  title: string,
  snippet: string,
  hint?: string
): ResourcePageOpportunity["classification"] {
  const hay = `${url} ${title} ${snippet} ${hint ?? ""}`.toLowerCase();
  if (hay.includes("statistics") || hay.includes("data source") || hay.includes("reference data")) return "statistics_reference";
  if (hay.includes("nonprofit") || hay.includes("ngo") || hay.includes("charity")) return "nonprofit_resource";
  if (hay.includes("expert") || hay.includes("roundup")) return "expert_resource";
  if (hay.includes("education") || hay.includes("tutorial") || hay.includes("learn")) return "educational_resource";
  if (hay.includes("product guide") || hay.includes("buying guide")) return "product_guide";
  if (hay.includes("community") || hay.includes("forum")) return "niche_community_resource";
  if (hay.includes("directory") || hay.includes("list of") || hay.includes("sites that")) return "directory";
  return "industry_resource";
}

/**
 * Resource-page risk flags. Avoid low-quality generic directories by default.
 */
export function resourcePageRiskFlags(
  url: string,
  title: string,
  classification: ResourcePageOpportunity["classification"]
): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const hay = `${url} ${title}`.toLowerCase();
  // Generic low-quality directory signals.
  if (/(free|submit|add your site|cheap|pay-?for|buy backlink)/.test(hay)) {
    flags.push({
      kind: "paid_link_solicitation",
      level: "HIGH",
      reason: `Page contains paid-link solicitation language: "${hay.slice(0, 80)}..."`,
      confidence: 0.7
    });
  }
  if (classification === "directory") {
    const path = new URL(url).pathname.toLowerCase();
    // Generic top-level "submit-your-site" directories are usually low value.
    if (path === "/" || path === "/directory" || path === "/submit") {
      flags.push({
        kind: "suspicious_directory_network",
        level: "MEDIUM",
        reason: "Generic top-level directory; likely low editorial value.",
        confidence: 0.6
      });
    }
  }
  // Thin content heuristic: title length extremely short.
  if (title && title.trim().length < 5) {
    flags.push({
      kind: "thin_content",
      level: "LOW",
      reason: "Page title is suspiciously short.",
      confidence: 0.4
    });
  }
  return flags;
}
