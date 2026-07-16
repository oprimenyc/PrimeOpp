/**
 * Backlink Prospect Discovery (Mission 3).
 *
 * Provider-agnostic discovery layer. Uses SearchDataAdapter implementations
 * (fixture, search, SEO, crawl, import, future browser executor) to find
 * candidate backlink opportunities.
 *
 * Every candidate preserves evidence of how it was discovered.
 */
import {
  LinkOpportunity,
  CompetitorGapOpportunity,
  BrokenLinkOpportunity,
  ResourcePageOpportunity,
  MentionWithoutLinkOpportunity,
  LinkableAssetOpportunity,
  dedupKeyFor
} from "../domain/opportunity.js";
import { LinkingDomain, LinkingPage } from "../domain/backlink.js";
import { deterministicId } from "../domain/ids.js";
import { VerificationStatus } from "../domain/verification.js";
import { normalizeUrl } from "../utils/url.js";
import { SearchDataAdapter, AdapterResult, BacklinkResultItem, BrokenLinkResultItem, ResourcePageResultItem, MentionResultItem } from "../adapters/adapter.js";
import { EvidenceRecord, EvidenceSource } from "../domain/evidence.js";
import { TopicalRelevance } from "../domain/relevance.js";

export interface DiscoveryContext {
  siteProfileId: string;
  targetDomain: string;
  /** Optional declared target topics. */
  topics: string[];
  /** Adapter to use (fixture / search / seo / composite). */
  adapter: SearchDataAdapter;
  /** Evidence recorder. */
  recordEvidence: (e: Omit<EvidenceRecord, "id">) => EvidenceRecord;
  /** Optional linking-domain cache so multiple opportunities share entities. */
  domainCache?: Map<string, LinkingDomain>;
  /** Optional linking-page cache. */
  pageCache?: Map<string, LinkingPage>;
  /** Optional AI adapter for relevance explanation (optional). */
  ai?: import("../ai/boundary.js").AiAdapter;
  /** Discovery timestamp override (for tests). */
  now?: number;
}

export interface DiscoveryResult {
  opportunities: LinkOpportunity[];
  linkingDomains: LinkingDomain[];
  linkingPages: LinkingPage[];
}

function ensureLinkingDomain(
  domain: string,
  ctx: DiscoveryContext,
  source: EvidenceSource
): LinkingDomain {
  const cache = ctx.domainCache ?? new Map<string, LinkingDomain>();
  ctx.domainCache = cache;
  const existing = cache.get(domain);
  if (existing) return existing;
  const ld: LinkingDomain = {
    id: deterministicId("linkingDomain", [domain]),
    domain,
    verification: "DISCOVERED"
  };
  cache.set(domain, ld);
  const ev = ctx.recordEvidence({
    kind: "backlink_observation",
    subjectId: ld.id,
    claim: `Discovered linking domain ${domain}`,
    observedAt: ctx.now ?? Date.now(),
    source,
    verification: "DISCOVERED",
    payload: { domain }
  });
  void ev;
  return ld;
}

function ensureLinkingPage(
  url: string,
  domain: string,
  ctx: DiscoveryContext,
  source: EvidenceSource
): LinkingPage {
  const cache = ctx.pageCache ?? new Map<string, LinkingPage>();
  ctx.pageCache = cache;
  const existing = cache.get(url);
  if (existing) return existing;
  const lp: LinkingPage = {
    id: deterministicId("linkingPage", [url]),
    linkingDomainId: deterministicId("linkingDomain", [domain]),
    url,
    verification: "DISCOVERED"
  };
  cache.set(url, lp);
  ctx.recordEvidence({
    kind: "link_observation",
    subjectId: lp.id,
    claim: `Discovered linking page ${url}`,
    observedAt: ctx.now ?? Date.now(),
    source,
    verification: "DISCOVERED",
    payload: { url, domain }
  });
  return lp;
}

/**
 * Discover competitor-backlink opportunities.
 * The adapter returns backlinks pointing at a competitor domain; the engine
 * treats those linking pages as candidates we could also earn links from.
 */
export async function discoverCompetitorBacklinkOpportunities(
  competitor: { id: string; domain: string },
  ctx: DiscoveryContext
): Promise<DiscoveryResult> {
  if (!ctx.adapter.searchBacklinks) {
    return { opportunities: [], linkingDomains: [], linkingPages: [] };
  }
  const result: AdapterResult<BacklinkResultItem[]> = await ctx.adapter.searchBacklinks({
    targetDomain: competitor.domain
  });
  const source: EvidenceSource = {
    adapter: result.provenance.adapter,
    providerKind: result.provenance.providerKind,
    reference: result.provenance.reference,
    fetchedAt: result.provenance.fetchedAt
  };
  const opportunities: CompetitorGapOpportunity[] = [];
  const domains = new Map<string, LinkingDomain>();
  const pages = new Map<string, LinkingPage>();
  for (const item of result.data) {
    const nPage = normalizeUrl(item.linkingPageUrl);
    if (!nPage) continue;
    const ld = ensureLinkingDomain(nPage.rootDomain, ctx, source);
    domains.set(ld.id, ld);
    const lp = ensureLinkingPage(nPage.href, nPage.rootDomain, ctx, source);
    pages.set(lp.id, lp);
    const dedupKey = dedupKeyFor("competitor_backlink_gap", [nPage.href, competitor.id]);
    const ev = ctx.recordEvidence({
      kind: "competitor_backlink_observation",
      subjectId: deterministicId("opportunity", [dedupKey]),
      claim: `Competitor ${competitor.domain} has a backlink from ${nPage.href}`,
      observedAt: ctx.now ?? Date.now(),
      source,
      verification: "DISCOVERED",
      payload: { competitorDomain: competitor.domain, linkingPage: nPage.href, anchorText: item.anchorText }
    });
    const opp: CompetitorGapOpportunity = {
      id: deterministicId("opportunity", [dedupKey]),
      siteProfileId: ctx.siteProfileId,
      kind: "competitor_backlink_gap",
      dedupKey,
      verification: "DISCOVERED",
      evidenceIds: [ev.id],
      linkingDomainId: ld.id,
      linkingPageId: lp.id,
      competitorIds: [competitor.id],
      competitorOverlap: 1,
      replicable: {
        value: false,
        reason: "Replicability not yet assessed; competitor has the link but we have not.",
        confidence: 0
      },
      riskFlags: [],
      discoveredAt: ctx.now ?? Date.now()
    };
    opportunities.push(opp);
  }
  return { opportunities, linkingDomains: [...domains.values()], linkingPages: [...pages.values()] };
}

/**
 * Discover broken-link opportunities.
 */
export async function discoverBrokenLinkOpportunities(
  sourcePageUrl: string,
  ctx: DiscoveryContext
): Promise<DiscoveryResult> {
  if (!ctx.adapter.searchBrokenLinks) {
    return { opportunities: [], linkingDomains: [], linkingPages: [] };
  }
  const result = await ctx.adapter.searchBrokenLinks({ pageUrl: sourcePageUrl });
  const evSource: EvidenceSource = {
    adapter: result.provenance.adapter,
    providerKind: result.provenance.providerKind,
    reference: result.provenance.reference,
    fetchedAt: result.provenance.fetchedAt
  };
  const opportunities: BrokenLinkOpportunity[] = [];
  const domains = new Map<string, LinkingDomain>();
  const pages = new Map<string, LinkingPage>();
  for (const item of result.data) {
    const nPage = normalizeUrl(item.sourcePageUrl);
    if (!nPage) continue;
    const ld = ensureLinkingDomain(nPage.rootDomain, ctx, evSource);
    domains.set(ld.id, ld);
    const lp = ensureLinkingPage(nPage.href, nPage.rootDomain, ctx, evSource);
    pages.set(lp.id, lp);
    const dedupKey = dedupKeyFor("broken_link", [nPage.href, item.brokenDestinationUrl]);
    const ev = ctx.recordEvidence({
      kind: "broken_link_observation",
      subjectId: deterministicId("opportunity", [dedupKey]),
      claim: `Broken link on ${nPage.href} -> ${item.brokenDestinationUrl} (HTTP ${item.httpState ?? "?"})`,
      observedAt: ctx.now ?? Date.now(),
      source: evSource,
      verification: "DISCOVERED",
      payload: { source: nPage.href, broken: item.brokenDestinationUrl, httpState: item.httpState }
    });
    const opp: BrokenLinkOpportunity = {
      id: deterministicId("opportunity", [dedupKey]),
      siteProfileId: ctx.siteProfileId,
      kind: "broken_link",
      dedupKey,
      verification: "DISCOVERED",
      evidenceIds: [ev.id],
      linkingDomainId: ld.id,
      linkingPageId: lp.id,
      brokenDestinationUrl: item.brokenDestinationUrl,
      httpState: item.httpState,
      anchorText: item.anchorText,
      existingContentSuitable: false,
      contentUpdateRequired: true,
      riskFlags: [],
      discoveredAt: ctx.now ?? Date.now()
    };
    opportunities.push(opp);
  }
  return { opportunities, linkingDomains: [...domains.values()], linkingPages: [...pages.values()] };
}

/**
 * Discover resource-page opportunities.
 */
export async function discoverResourcePageOpportunities(
  topic: string,
  ctx: DiscoveryContext
): Promise<DiscoveryResult> {
  if (!ctx.adapter.searchResourcePages) {
    return { opportunities: [], linkingDomains: [], linkingPages: [] };
  }
  const result = await ctx.adapter.searchResourcePages({ topic, limit: 50 });
  const evSource: EvidenceSource = {
    adapter: result.provenance.adapter,
    providerKind: result.provenance.providerKind,
    reference: result.provenance.reference,
    fetchedAt: result.provenance.fetchedAt
  };
  const opportunities: ResourcePageOpportunity[] = [];
  const domains = new Map<string, LinkingDomain>();
  const pages = new Map<string, LinkingPage>();
  for (const item of result.data) {
    const nPage = normalizeUrl(item.url);
    if (!nPage) continue;
    const ld = ensureLinkingDomain(nPage.rootDomain, ctx, evSource);
    domains.set(ld.id, ld);
    const lp = ensureLinkingPage(nPage.href, nPage.rootDomain, ctx, evSource);
    pages.set(lp.id, lp);
    const dedupKey = dedupKeyFor("resource_page", [nPage.href]);
    const ev = ctx.recordEvidence({
      kind: "resource_page_observation",
      subjectId: deterministicId("opportunity", [dedupKey]),
      claim: `Resource page candidate: ${nPage.href}`,
      observedAt: ctx.now ?? Date.now(),
      source: evSource,
      verification: "DISCOVERED",
      payload: { url: nPage.href, title: item.title, hint: item.hint }
    });
    const classification = classifyResourcePageInline(nPage.href, item.title ?? "", item.snippet ?? "", item.hint);
    const opp: ResourcePageOpportunity = {
      id: deterministicId("opportunity", [dedupKey]),
      siteProfileId: ctx.siteProfileId,
      kind: "resource_page",
      dedupKey,
      verification: "DISCOVERED",
      evidenceIds: [ev.id],
      linkingDomainId: ld.id,
      linkingPageId: lp.id,
      classification,
      acceptsSubmissionsInferred: false,
      riskFlags: [],
      discoveredAt: ctx.now ?? Date.now()
    };
    opportunities.push(opp);
  }
  return { opportunities, linkingDomains: [...domains.values()], linkingPages: [...pages.values()] };
}

/**
 * Discover unlinked-mention opportunities.
 */
export async function discoverMentionOpportunities(
  term: string,
  ctx: DiscoveryContext
): Promise<DiscoveryResult> {
  if (!ctx.adapter.searchMentions) {
    return { opportunities: [], linkingDomains: [], linkingPages: [] };
  }
  const result = await ctx.adapter.searchMentions({ term, limit: 50 });
  const evSource: EvidenceSource = {
    adapter: result.provenance.adapter,
    providerKind: result.provenance.providerKind,
    reference: result.provenance.reference,
    fetchedAt: result.provenance.fetchedAt
  };
  const opportunities: MentionWithoutLinkOpportunity[] = [];
  const domains = new Map<string, LinkingDomain>();
  const pages = new Map<string, LinkingPage>();
  for (const item of result.data) {
    if (item.hasLink) continue; // already linked; not an opportunity
    const nPage = normalizeUrl(item.url);
    if (!nPage) continue;
    const ld = ensureLinkingDomain(nPage.rootDomain, ctx, evSource);
    domains.set(ld.id, ld);
    const lp = ensureLinkingPage(nPage.href, nPage.rootDomain, ctx, evSource);
    pages.set(lp.id, lp);
    const dedupKey = dedupKeyFor("unlinked_mention", [nPage.href, term]);
    const ev = ctx.recordEvidence({
      kind: "mention_observation",
      subjectId: deterministicId("opportunity", [dedupKey]),
      claim: `Unlinked mention of "${term}" on ${nPage.href}`,
      observedAt: ctx.now ?? Date.now(),
      source: evSource,
      verification: "DISCOVERED",
      payload: { url: nPage.href, snippet: item.snippet }
    });
    const opp: MentionWithoutLinkOpportunity = {
      id: deterministicId("opportunity", [dedupKey]),
      siteProfileId: ctx.siteProfileId,
      kind: "unlinked_mention",
      dedupKey,
      verification: "DISCOVERED",
      evidenceIds: [ev.id],
      linkingDomainId: ld.id,
      linkingPageId: lp.id,
      mentionUrl: nPage.href,
      snippet: item.snippet,
      riskFlags: [],
      discoveredAt: ctx.now ?? Date.now()
    };
    opportunities.push(opp);
  }
  return { opportunities, linkingDomains: [...domains.values()], linkingPages: [...pages.values()] };
}

/**
 * Suggest linkable-asset opportunities based on gaps in the inventory vs.
 * discovered opportunities. (Real asset creation is out of scope here; we
 * only suggest archetypes.)
 */
export function suggestLinkableAssetOpportunities(
  existingArchetypes: Array<{ archetype: string; topic: string }>,
  desiredArchetypes: Array<{ archetype: import("../domain/site.js").ContentAsset["archetype"]; topic: string }>,
  ctx: DiscoveryContext
): LinkableAssetOpportunity[] {
  const existing = new Set(existingArchetypes.map((a) => `${a.archetype}|${a.topic.toLowerCase()}`));
  const opportunities: LinkableAssetOpportunity[] = [];
  for (const desired of desiredArchetypes) {
    if (existing.has(`${desired.archetype}|${desired.topic.toLowerCase()}`)) continue;
    const dedupKey = dedupKeyFor("linkable_asset", [desired.archetype, desired.topic]);
    const ev = ctx.recordEvidence({
      kind: "page_observation",
      subjectId: deterministicId("opportunity", [dedupKey]),
      claim: `Suggested linkable asset: ${desired.archetype} on ${desired.topic}`,
      observedAt: ctx.now ?? Date.now(),
      source: { adapter: "internal", providerKind: "internal" },
      verification: "INFERRED",
      payload: { archetype: desired.archetype, topic: desired.topic }
    });
    opportunities.push({
      id: deterministicId("opportunity", [dedupKey]),
      siteProfileId: ctx.siteProfileId,
      kind: "linkable_asset",
      dedupKey,
      verification: "INFERRED",
      evidenceIds: [ev.id],
      suggestedArchetype: desired.archetype,
      rationale: `No existing ${desired.archetype} found on topic "${desired.topic}".`,
      riskFlags: [],
      discoveredAt: ctx.now ?? Date.now()
    });
  }
  return opportunities;
}

export function classifyResourcePageInline(
  url: string,
  title: string,
  snippet: string,
  hint?: string
): ResourcePageOpportunity["classification"] {
  const hay = `${url} ${title} ${snippet} ${hint ?? ""}`.toLowerCase();
  if (hay.includes("statistics") || hay.includes("data source") || hay.includes("reference data")) return "statistics_reference";
  if (hay.includes("nonprofit") || hay.includes("ngo") || hay.includes("charity")) return "nonprofit_resource";
  if (hay.includes("expert") || hay.includes("roundup") || hay.includes("thought leader")) return "expert_resource";
  if (hay.includes("education") || hay.includes("tutorial") || hay.includes("learn")) return "educational_resource";
  if (hay.includes("product guide") || hay.includes("buying guide")) return "product_guide";
  if (hay.includes("directory") || hay.includes("list of")) return "directory";
  if (hay.includes("community") || hay.includes("forum")) return "niche_community_resource";
  return "industry_resource";
}

/**
 * Helper: build a default TopicalRelevance from similarity heuristic.
 */
export function quickTopicalRelevance(
  targetTopic: string,
  candidateTopic: string,
  sharedKeywords: string[] = []
): TopicalRelevance {
  const aTokens = new Set(targetTopic.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const bTokens = new Set(candidateTopic.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  let inter = 0;
  for (const t of aTokens) if (bTokens.has(t)) inter++;
  const union = aTokens.size + bTokens.size - inter;
  const sim = union === 0 ? 0 : inter / union;
  return {
    topic: candidateTopic,
    similarity: sim,
    reason: `Token overlap ${inter}/${union} between "${targetTopic}" and "${candidateTopic}".`,
    sharedKeywords
  };
}

/**
 * Deduplicate opportunities by dedupKey. Later wins.
 */
export function deduplicateOpportunities(opps: LinkOpportunity[]): LinkOpportunity[] {
  const byKey = new Map<string, LinkOpportunity>();
  for (const o of opps) {
    const existing = byKey.get(o.dedupKey);
    if (!existing) {
      byKey.set(o.dedupKey, o);
    } else {
      // Merge evidence ids.
      byKey.set(o.dedupKey, {
        ...o,
        evidenceIds: [...new Set([...existing.evidenceIds, ...o.evidenceIds])]
      });
    }
  }
  return [...byKey.values()];
}
