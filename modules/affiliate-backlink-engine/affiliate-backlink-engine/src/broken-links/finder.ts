/**
 * Broken-Link Opportunity Finder (Mission 5).
 *
 * Inputs: supplied crawl/search/provider data.
 * For each opportunity:
 *  - source page
 *  - broken destination
 *  - anchor/context
 *  - HTTP state when verified
 *  - topic match
 *  - candidate replacement asset
 *  - whether existing target content is suitable
 *  - whether new/updated content is required
 *  - evidence timestamp
 *
 * Prevent stale data from being treated as current without revalidation.
 */
import { BrokenLinkOpportunity, dedupKeyFor } from "../domain/opportunity.js";
import { LinkingPage, LinkingDomain } from "../domain/backlink.js";
import { deterministicId } from "../domain/ids.js";
import { EvidenceRecord, EvidenceSource } from "../domain/evidence.js";
import { shouldRevalidate, VerificationStatus } from "../domain/verification.js";
import { TargetPage, ContentAsset } from "../domain/site.js";
import { quickTopicalRelevance } from "../discovery/discovery.js";

export interface BrokenLinkInput {
  sourcePageUrl: string;
  brokenDestinationUrl: string;
  anchorText?: string;
  context?: string;
  httpState?: number;
  detectedAt?: number;
}

export interface BrokenLinkMatchOptions {
  siteProfileId: string;
  targetTopics: string[];
  /** Pages on our property that could serve as replacement. */
  candidateReplacementPages: TargetPage[];
  /** Content assets that could serve as replacement. */
  candidateReplacementAssets: ContentAsset[];
  /** Evidence recorder. */
  recordEvidence: (e: Omit<EvidenceRecord, "id">) => EvidenceRecord;
  now?: number;
  /** Revalidate window. Default 7 days. */
  revalidateMs?: number;
}

export interface BrokenLinkMatchResult {
  opportunity: BrokenLinkOpportunity;
  linkingPage: LinkingPage;
  linkingDomain: LinkingDomain;
}

export interface BrokenLinkBatchResult {
  matches: BrokenLinkMatchResult[];
  stale: BrokenLinkInput[]; // inputs whose detectedAt is older than revalidate window
}

export function analyzeBrokenLinks(
  inputs: BrokenLinkInput[],
  opts: BrokenLinkMatchOptions
): BrokenLinkBatchResult {
  const now = opts.now ?? Date.now();
  const revalidateMs = opts.revalidateMs ?? 7 * 24 * 60 * 60 * 1000;
  const matches: BrokenLinkMatchResult[] = [];
  const stale: BrokenLinkInput[] = [];

  const evSource: EvidenceSource = { adapter: "broken-link-finder", providerKind: "internal" };

  for (const input of inputs) {
    if (input.detectedAt && shouldRevalidate(input.detectedAt, now)) {
      // Mark stale; do not promote to actionable without revalidation.
      stale.push(input);
      // Still record but with STALE status, so operator knows it exists.
    }

    const sourceUrl = normalizeOrSkip(input.sourcePageUrl);
    if (!sourceUrl) continue;
    const ld: LinkingDomain = {
      id: deterministicId("linkingDomain", [sourceUrl.rootDomain]),
      domain: sourceUrl.rootDomain,
      verification: "DISCOVERED"
    };
    const lp: LinkingPage = {
      id: deterministicId("linkingPage", [sourceUrl.href]),
      linkingDomainId: ld.id,
      url: sourceUrl.href,
      verification: input.detectedAt && shouldRevalidate(input.detectedAt, now) ? "STALE" : "DISCOVERED"
    };

    // Find a candidate replacement.
    const replacement = findReplacement(input, opts.candidateReplacementPages, opts.candidateReplacementAssets);
    const topical = quickTopicalRelevance(
      opts.targetTopics.join(" "),
      input.anchorText ?? input.brokenDestinationUrl,
      [input.anchorText ?? ""].filter(Boolean)
    );

    const dedupKey = dedupKeyFor("broken_link", [sourceUrl.href, input.brokenDestinationUrl]);
    const verification: VerificationStatus =
      input.detectedAt && shouldRevalidate(input.detectedAt, now) ? "STALE" : "DISCOVERED";

    const ev = opts.recordEvidence({
      kind: "broken_link_observation",
      subjectId: deterministicId("opportunity", [dedupKey]),
      claim: `Broken link on ${sourceUrl.href} -> ${input.brokenDestinationUrl} (HTTP ${input.httpState ?? "?"})`,
      observedAt: input.detectedAt ?? now,
      source: evSource,
      verification,
      payload: {
        source: sourceUrl.href,
        broken: input.brokenDestinationUrl,
        httpState: input.httpState,
        anchorText: input.anchorText,
        context: input.context
      }
    });

    const opp: BrokenLinkOpportunity = {
      id: deterministicId("opportunity", [dedupKey]),
      siteProfileId: opts.siteProfileId,
      kind: "broken_link",
      dedupKey,
      verification,
      evidenceIds: [ev.id],
      linkingDomainId: ld.id,
      linkingPageId: lp.id,
      brokenDestinationUrl: input.brokenDestinationUrl,
      httpState: input.httpState,
      anchorText: input.anchorText,
      candidateReplacementPageId: replacement?.pageId,
      existingContentSuitable: replacement?.suitable ?? false,
      contentUpdateRequired: !replacement?.suitable,
      topical,
      riskFlags: [],
      discoveredAt: input.detectedAt ?? now
    };
    matches.push({ opportunity: opp, linkingPage: lp, linkingDomain: ld });
  }

  return { matches, stale };
}

export interface ReplacementMatch {
  pageId: string;
  suitable: boolean;
  reason: string;
}

/**
 * Find a replacement page/asset for a broken link.
 * Heuristic: match on topical keywords + content type.
 */
export function findReplacement(
  input: BrokenLinkInput,
  pages: TargetPage[],
  assets: ContentAsset[]
): ReplacementMatch | undefined {
  const targetTopic = (input.anchorText ?? input.brokenDestinationUrl ?? "").toLowerCase();
  if (!targetTopic) return undefined;

  // Score each page by topical overlap with anchor/context.
  let bestPage: TargetPage | undefined;
  let bestScore = 0;
  for (const p of pages) {
    const pTopic = `${p.title ?? ""} ${p.topic ?? ""} ${p.targetKeyword ?? ""} ${p.productOrCategory ?? ""}`.toLowerCase();
    const score = tokenOverlap(targetTopic, pTopic);
    if (score > bestScore) {
      bestScore = score;
      bestPage = p;
    }
  }
  // Score each asset.
  let bestAsset: ContentAsset | undefined;
  let bestAssetScore = 0;
  for (const a of assets) {
    const aTopic = `${a.title ?? ""} ${a.topical?.topic ?? ""}`.toLowerCase();
    const score = tokenOverlap(targetTopic, aTopic);
    if (score > bestAssetScore) {
      bestAssetScore = score;
      bestAsset = a;
    }
  }

  if (bestPage && bestScore >= 0.2) {
    return {
      pageId: bestPage.id,
      suitable: bestScore >= 0.4,
      reason: `Best matching page "${bestPage.title ?? bestPage.url}" with topic overlap ${Math.round(bestScore * 100)}%.`
    };
  }
  if (bestAsset && bestAssetScore >= 0.2 && bestAsset.suitableAsReplacement !== false) {
    // Map asset to a pseudo-pageId? We need a pageId; use asset id with prefix.
    return {
      pageId: bestAsset.id,
      suitable: bestAssetScore >= 0.4,
      reason: `Best matching asset "${bestAsset.title ?? bestAsset.url}" with topic overlap ${Math.round(bestAssetScore * 100)}%.`
    };
  }
  return undefined;
}

function tokenOverlap(a: string, b: string): number {
  const at = new Set(a.split(/[^a-z0-9]+/).filter((t) => t.length > 2));
  const bt = new Set(b.split(/[^a-z0-9]+/).filter((t) => t.length > 2));
  if (at.size === 0 || bt.size === 0) return 0;
  let inter = 0;
  for (const t of at) if (bt.has(t)) inter++;
  return inter / Math.max(at.size, bt.size);
}

function normalizeOrSkip(url: string): { href: string; rootDomain: string } | undefined {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    u.hostname = u.hostname.toLowerCase();
    const root = u.hostname.split(".").slice(-2).join(".");
    return { href: u.href, rootDomain: root };
  } catch {
    return undefined;
  }
}
