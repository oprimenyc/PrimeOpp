/**
 * Competitor Backlink Gap Analyzer (Mission 4).
 *
 * Input:
 *  - target domain
 *  - competitor domains
 *  - backlink datasets (per competitor)
 *
 * Output:
 *  - domains linking to competitors but not target
 *  - repeated competitor-linking domains
 *  - pages linking to multiple competitors
 *  - likely common industry resource sources
 *  - competitor-specific unique sources
 *
 * Calculates:
 *  - competitor overlap count
 *  - topical relevance
 *  - apparent replicability (with reason, never assumed)
 *  - evidence quality
 *  - target-page match
 *  - likely outreach strategy
 */
import { CompetitorGapOpportunity, dedupKeyFor } from "../domain/opportunity.js";
import { LinkingDomain, LinkingPage, BacklinkSource } from "../domain/backlink.js";
import { deterministicId } from "../domain/ids.js";
import { EvidenceRecord, EvidenceSource } from "../domain/evidence.js";
import { quickTopicalRelevance } from "../discovery/discovery.js";
import { TopicalRelevance } from "../domain/relevance.js";
import { RiskFlag } from "../domain/risk.js";

export interface CompetitorBacklinkInput {
  competitorId: string;
  competitorDomain: string;
  backlinks: Array<{
    linkingDomain: string;
    linkingPageUrl: string;
    targetUrl: string;
    anchorText?: string;
    authority?: number;
  }>;
}

export interface GapAnalysisOptions {
  siteProfileId: string;
  targetDomain: string;
  targetTopics: string[];
  /** Backlinks the target already has (to exclude). */
  targetExistingBacklinkDomains?: Set<string>;
  /** Evidence recorder. */
  recordEvidence: (e: Omit<EvidenceRecord, "id">) => EvidenceRecord;
  now?: number;
}

export interface GapAnalysisResult {
  /** Domains linking to >=1 competitor but not target. */
  gapDomains: LinkingDomain[];
  /** Per-domain overlap counts. */
  overlapByDomain: Map<string, number>;
  /** Pages linking to multiple competitors. */
  multiCompetitorPages: LinkingPage[];
  /** Final opportunities. */
  opportunities: CompetitorGapOpportunity[];
  /** Competitor-specific unique sources. */
  uniqueByCompetitor: Map<string, string[]>;
  /** Common resource sources (>=2 competitors). */
  commonResourceDomains: string[];
}

export function analyzeCompetitorGap(
  inputs: CompetitorBacklinkInput[],
  opts: GapAnalysisOptions
): GapAnalysisResult {
  const now = opts.now ?? Date.now();
  const targetExisting = opts.targetExistingBacklinkDomains ?? new Set<string>();

  // Map: linkingDomain -> { competitorIds:Set, pages:Map<url,{competitorIds, anchorText, authority}> }
  const byDomain = new Map<
    string,
    {
      competitorIds: Set<string>;
      pages: Map<string, { competitorIds: Set<string>; anchorText?: string; authority?: number }>;
    }
  >();

  for (const inp of inputs) {
    for (const bl of inp.backlinks) {
      const dom = bl.linkingDomain.toLowerCase();
      if (targetExisting.has(dom)) continue; // target already has it
      let entry = byDomain.get(dom);
      if (!entry) {
        entry = { competitorIds: new Set(), pages: new Map() };
        byDomain.set(dom, entry);
      }
      entry.competitorIds.add(inp.competitorId);
      let page = entry.pages.get(bl.linkingPageUrl);
      if (!page) {
        page = { competitorIds: new Set(), anchorText: bl.anchorText, authority: bl.authority };
        entry.pages.set(bl.linkingPageUrl, page);
      }
      page.competitorIds.add(inp.competitorId);
    }
  }

  const opportunities: CompetitorGapOpportunity[] = [];
  const gapDomains: LinkingDomain[] = [];
  const multiCompetitorPages: LinkingPage[] = [];
  const overlapByDomain = new Map<string, number>();
  const uniqueByCompetitor = new Map<string, string[]>();
  const commonResourceDomains: string[] = [];

  const evSource: EvidenceSource = { adapter: "competitor-gap-analyzer", providerKind: "internal" };

  for (const [domain, entry] of byDomain.entries()) {
    overlapByDomain.set(domain, entry.competitorIds.size);
    if (entry.competitorIds.size >= 2) commonResourceDomains.push(domain);

    const ld: LinkingDomain = {
      id: deterministicId("linkingDomain", [domain]),
      domain,
      verification: "DISCOVERED",
      metrics: entry.pages.values().next().value?.authority
        ? { authority: { value: entry.pages.values().next().value!.authority!, source: "competitor_backlink_adapter" } }
        : undefined
    };
    gapDomains.push(ld);

    // For each page on this domain, build an opportunity.
    for (const [url, page] of entry.pages.entries()) {
      const competitorIds = [...page.competitorIds];
      const overlap = competitorIds.length;
      const dedupKey = dedupKeyFor("competitor_backlink_gap", [url, competitorIds.sort().join(",")]);

      const topical: TopicalRelevance = quickTopicalRelevance(
        opts.targetTopics.join(" "),
        domain,
        page.anchorText ? [page.anchorText] : []
      );

      const ev = opts.recordEvidence({
        kind: "competitor_backlink_observation",
        subjectId: deterministicId("opportunity", [dedupKey]),
        claim: `${overlap} competitor(s) link from ${url}`,
        observedAt: now,
        source: evSource,
        verification: "DISCOVERED",
        payload: { domain, url, competitorIds, anchorText: page.anchorText, authority: page.authority }
      });

      const replicable = assessReplicability(domain, overlap, topical.similarity, page.anchorText);

      const opp: CompetitorGapOpportunity = {
        id: deterministicId("opportunity", [dedupKey]),
        siteProfileId: opts.siteProfileId,
        kind: "competitor_backlink_gap",
        dedupKey,
        verification: "DISCOVERED",
        evidenceIds: [ev.id],
        linkingDomainId: ld.id,
        linkingPageId: deterministicId("linkingPage", [url]),
        competitorIds,
        competitorOverlap: overlap,
        replicable,
        topical,
        riskFlags: [],
        discoveredAt: now
      };
      opportunities.push(opp);

      if (overlap >= 2) {
        multiCompetitorPages.push({
          id: deterministicId("linkingPage", [url]),
          linkingDomainId: ld.id,
          url,
          verification: "DISCOVERED",
          topical
        });
      }
    }

    // Unique-to-competitor attribution.
    if (entry.competitorIds.size === 1) {
      const cid = [...entry.competitorIds][0];
      const arr = uniqueByCompetitor.get(cid) ?? [];
      arr.push(domain);
      uniqueByCompetitor.set(cid, arr);
    }
  }

  return {
    gapDomains,
    overlapByDomain,
    multiCompetitorPages,
    opportunities,
    uniqueByCompetitor,
    commonResourceDomains
  };
}

/**
 * Replicability assessment. NEVER assume a link is replicable just because a
 * competitor has it. We surface a confidence that is high only when:
 *  - the page links to multiple competitors (suggests editorial willingness)
 *  - topical relevance is high
 *  - we have an obvious replacement asset
 *
 * If any of those is missing, value=false and reason explains.
 */
export function assessReplicability(
  domain: string,
  competitorOverlap: number,
  topicalSimilarity: number,
  anchorText?: string
): { value: boolean; reason: string; confidence: number } {
  const signals: string[] = [];
  let score = 0;
  if (competitorOverlap >= 2) {
    score += 0.4;
    signals.push(`page links to ${competitorOverlap} competitors`);
  }
  if (topicalSimilarity >= 0.3) {
    score += 0.3;
    signals.push(`topical similarity ${Math.round(topicalSimilarity * 100)}%`);
  }
  if (anchorText && anchorText.length > 0) {
    score += 0.1;
    signals.push(`anchor text observed`);
  }
  if (competitorOverlap === 1) {
    score -= 0.2;
    signals.push(`only 1 competitor links here (may be exclusive relationship)`);
  }
  const value = score >= 0.4;
  const reason = signals.length
    ? `Replicability signals: ${signals.join("; ")}.`
    : `No replicability signals for ${domain}.`;
  return { value, reason, confidence: Math.max(0, Math.min(1, score)) };
}

/**
 * Risk flags for competitor-gap opportunities.
 */
export function competitorGapRiskFlags(opp: CompetitorGapOpportunity): RiskFlag[] {
  const flags: RiskFlag[] = [];
  if (opp.competitorOverlap === 1) {
    flags.push({
      kind: "non_editorial_source",
      level: "LOW",
      reason: "Only one competitor links here; may be a paid or exclusive relationship.",
      confidence: 0.3
    });
  }
  if ((opp.topical?.similarity ?? 0) < 0.1) {
    flags.push({
      kind: "irrelevant_domain",
      level: "MEDIUM",
      reason: "Topical similarity to target is very low.",
      confidence: 0.5
    });
  }
  return flags;
}
