/**
 * Content-Asset Matcher (Mission 9).
 *
 * For each opportunity determine whether the target site has:
 *  - a directly suitable page
 *  - a partially suitable page
 *  - no suitable page
 *
 * Output:
 *  - best target URL
 *  - content gaps
 *  - suggested update
 *  - suggested new asset if needed
 *  - likely linking rationale
 *
 * Legitimate linkable asset archetypes include:
 *  original research, calculators, comparison guides, glossaries,
 *  statistics pages, definitive resources, visual explainers,
 *  checklists, public tools, useful datasets, expert commentary.
 *
 * The engine MUST NOT generate fake research or statistics.
 */
import { LinkOpportunity } from "../domain/opportunity.js";
import { TargetPage, ContentAsset, ContentType } from "../domain/site.js";
import { normalizeUrl } from "../utils/url.js";

export interface ContentMatchResult {
  opportunityId: string;
  bestTargetPageId?: string;
  bestTargetUrl?: string;
  matchLevel: "direct" | "partial" | "none";
  contentGaps: string[];
  suggestedUpdate?: string;
  suggestedNewAsset?: {
    archetype: ContentAsset["archetype"];
    topic: string;
    rationale: string;
  };
  linkingRationale: string;
  confidence: number;
}

export function matchContentForOpportunity(
  opp: LinkOpportunity,
  pages: TargetPage[],
  assets: ContentAsset[]
): ContentMatchResult {
  const topic = composeTopic(opp);
  let bestPage: TargetPage | undefined;
  let bestPageScore = 0;
  for (const p of pages) {
    const pTopic = `${p.title ?? ""} ${p.topic ?? ""} ${p.targetKeyword ?? ""} ${p.productOrCategory ?? ""}`.toLowerCase();
    const score = tokenOverlap(topic.toLowerCase(), pTopic);
    if (score > bestPageScore) {
      bestPageScore = score;
      bestPage = p;
    }
  }
  let bestAsset: ContentAsset | undefined;
  let bestAssetScore = 0;
  for (const a of assets) {
    const aTopic = `${a.title ?? ""} ${a.topical?.topic ?? ""}`.toLowerCase();
    const score = tokenOverlap(topic.toLowerCase(), aTopic);
    if (score > bestAssetScore) {
      bestAssetScore = score;
      bestAsset = a;
    }
  }

  const contentGaps: string[] = [];
  let suggestedUpdate: string | undefined;
  let suggestedNewAsset: ContentMatchResult["suggestedNewAsset"] | undefined;
  let matchLevel: ContentMatchResult["matchLevel"] = "none";
  let confidence = 0.3;

  if (bestPageScore >= 0.4) {
    matchLevel = "direct";
    confidence = 0.8;
    suggestedUpdate = `Refresh "${bestPage!.title ?? bestPage!.url}" with updated examples and statistics.`;
  } else if (bestPageScore >= 0.2 || bestAssetScore >= 0.2) {
    matchLevel = "partial";
    confidence = 0.55;
    suggestedUpdate = `Expand "${bestPage?.title ?? bestAsset?.title ?? ""}" to better match the opportunity topic.`;
    contentGaps.push("Missing subtopic coverage");
    contentGaps.push("Missing original data point");
  } else {
    matchLevel = "none";
    confidence = 0.4;
    suggestedNewAsset = suggestAsset(opp, topic);
    contentGaps.push("No matching existing content");
  }

  const linkingRationale = composeRationale(opp, matchLevel, bestPage, bestAsset);
  const bestTargetPageId = bestPage?.id ?? (bestAsset && bestAssetScore > bestPageScore ? bestAsset.id : undefined);
  const bestTargetUrl = bestPage?.url ?? bestAsset?.url;

  return {
    opportunityId: opp.id,
    bestTargetPageId,
    bestTargetUrl,
    matchLevel,
    contentGaps,
    suggestedUpdate,
    suggestedNewAsset,
    linkingRationale,
    confidence
  };
}

function composeTopic(opp: LinkOpportunity): string {
  const bits: string[] = [];
  if (opp.topical?.topic) bits.push(opp.topical.topic);
  if (opp.kind === "broken_link") bits.push(opp.anchorText ?? opp.brokenDestinationUrl);
  if (opp.kind === "unlinked_mention") bits.push(opp.snippet ?? "");
  if (opp.kind === "competitor_backlink_gap") bits.push("competitor backlink");
  if (opp.kind === "resource_page") bits.push("resource page");
  if (opp.kind === "linkable_asset") bits.push(opp.rationale);
  return bits.join(" ");
}

function composeRationale(
  opp: LinkOpportunity,
  matchLevel: ContentMatchResult["matchLevel"],
  bestPage?: TargetPage,
  bestAsset?: ContentAsset
): string {
  const url = bestPage?.url ?? bestAsset?.url ?? "(no matching asset yet)";
  switch (opp.kind) {
    case "broken_link":
      return `Broken link on opportunity page points to a now-dead resource. Our ${url} ${matchLevel === "direct" ? "directly" : "could"} replace it with a maintained, relevant equivalent.`;
    case "resource_page":
      return `Resource page curates links on this topic. Our ${url} ${matchLevel === "direct" ? "is a strong" : "could become a"} fit for inclusion.`;
    case "unlinked_mention":
      return `Brand mention without a link. Asking the author to convert the mention into a citation to ${url} is a low-friction win.`;
    case "competitor_backlink_gap":
      return `Competitor has a backlink from this source. Our ${url} offers a ${matchLevel === "direct" ? "comparable" : "potentially comparable"} alternative the editor could add.`;
    case "linkable_asset":
      return `Suggested new linkable asset. Creating it would give us something worth citing on this topic.`;
    case "internal_link":
      return `Internal link opportunity to improve topical flow.`;
  }
}

function suggestAsset(
  opp: LinkOpportunity,
  topic: string
): ContentMatchResult["suggestedNewAsset"] | undefined {
  if (opp.kind === "linkable_asset") {
    return {
      archetype: opp.suggestedArchetype,
      topic,
      rationale: opp.rationale
    };
  }
  if (opp.kind === "broken_link") {
    return {
      archetype: "definitive_resource",
      topic,
      rationale: `Broken destination suggests a reference resource was lost; create a definitive guide on the topic.`
    };
  }
  if (opp.kind === "resource_page") {
    return {
      archetype: "statistics_page",
      topic,
      rationale: `Resource pages favor citable statistics; build a statistics page with sourced data.`
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

export const LINKABLE_ASSET_ARCHETYPES: ContentAsset["archetype"][] = [
  "original_research",
  "calculator",
  "comparison_guide",
  "glossary",
  "statistics_page",
  "definitive_resource",
  "visual_explainer",
  "checklist",
  "public_tool",
  "useful_dataset",
  "expert_commentary",
  "guide",
  "review",
  "other"
];
