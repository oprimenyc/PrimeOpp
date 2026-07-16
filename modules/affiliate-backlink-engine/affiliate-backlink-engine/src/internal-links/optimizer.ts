/**
 * Internal Link Optimizer (Mission 11).
 *
 * Analyzes supplied site/content graphs.
 * Finds:
 *  - orphan pages
 *  - weakly connected commercial pages
 *  - missing topical links
 *  - excessive repetitive anchor patterns
 *  - important pages buried too deeply
 *  - relevant contextual linking opportunities
 *
 * Output:
 *  - source page
 *  - target page
 *  - suggested contextual reason
 *  - suggested anchor concepts
 *  - priority
 *
 * Does NOT automatically rewrite production content.
 */
import { TargetPage } from "../domain/site.js";
import { InternalLinkOpportunity, dedupKeyFor } from "../domain/opportunity.js";
import { deterministicId } from "../domain/ids.js";

export interface InternalLinkEdge {
  /** Source page id. */
  source: string;
  /** Target page id. */
  target: string;
  /** Anchor text used. */
  anchor?: string;
}

export interface InternalLinkGraph {
  pages: TargetPage[];
  edges: InternalLinkEdge[];
}

export interface InternalLinkAnalysisOptions {
  siteProfileId: string;
  /** Max depth considered "well linked". */
  maxAcceptableDepth?: number;
  /** Max occurrences of the same anchor before it's "repetitive". */
  maxAcceptableAnchorRepeats?: number;
  now?: number;
}

export interface InternalLinkAnalysisResult {
  opportunities: InternalLinkOpportunity[];
  orphans: TargetPage[];
  weakCommercial: TargetPage[];
  repetitiveAnchors: { anchor: string; count: number }[];
  deeplyBuried: TargetPage[];
}

export function analyzeInternalLinks(
  graph: InternalLinkGraph,
  opts: InternalLinkAnalysisOptions
): InternalLinkAnalysisResult {
  const now = opts.now ?? Date.now();
  const maxDepth = opts.maxAcceptableDepth ?? 3;
  const maxRepeats = opts.maxAcceptableAnchorRepeats ?? 5;

  // Build inbound + outbound maps.
  const inbound = new Map<string, string[]>();
  const outbound = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (!inbound.has(e.target)) inbound.set(e.target, []);
    inbound.get(e.target)!.push(e.source);
    if (!outbound.has(e.source)) outbound.set(e.source, []);
    outbound.get(e.source)!.push(e.target);
  }

  // Orphan pages: no inbound.
  const orphans = graph.pages.filter((p) => (inbound.get(p.id)?.length ?? 0) === 0);

  // Weakly connected commercial pages: < 2 inbound + commercial intent.
  const weakCommercial = graph.pages.filter((p) => {
    const inb = inbound.get(p.id)?.length ?? 0;
    return (
      inb < 2 &&
      (p.commercialIntent === "transactional" || p.commercialIntent === "commercial_investigation")
    );
  });

  // Repetitive anchors.
  const anchorCounts = new Map<string, number>();
  for (const e of graph.edges) {
    if (!e.anchor) continue;
    anchorCounts.set(e.anchor, (anchorCounts.get(e.anchor) ?? 0) + 1);
  }
  const repetitiveAnchors = [...anchorCounts.entries()]
    .filter(([, c]) => c > maxRepeats)
    .map(([anchor, count]) => ({ anchor, count }));

  // Depth (BFS from homepage).
  const home = graph.pages.find((p) => p.contentType === "homepage");
  const depth = new Map<string, number>();
  if (home) {
    const queue: Array<{ id: string; d: number }> = [{ id: home.id, d: 0 }];
    depth.set(home.id, 0);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const next = outbound.get(cur.id) ?? [];
      for (const n of next) {
        if (!depth.has(n)) {
          depth.set(n, cur.d + 1);
          queue.push({ id: n, d: cur.d + 1 });
        }
      }
    }
  }
  const deeplyBuried = graph.pages.filter((p) => (depth.get(p.id) ?? 99) > maxDepth);

  // Build opportunities: for each weak/orphan page, suggest a link from
  // topically-related stronger pages.
  const opportunities: InternalLinkOpportunity[] = [];
  const candidatesFor = (target: TargetPage): TargetPage[] => {
    return graph.pages.filter((p) => {
      if (p.id === target.id) return false;
      // Pages with high priority and topical overlap.
      if (p.priority < 50) return false;
      const inb = inbound.get(p.id)?.length ?? 0;
      if (inb < 1) return false; // source should have incoming authority
      const targetTopic = `${target.title ?? ""} ${target.topic ?? ""} ${target.targetKeyword ?? ""}`.toLowerCase();
      const pTopic = `${p.title ?? ""} ${p.topic ?? ""} ${p.targetKeyword ?? ""}`.toLowerCase();
      return tokenOverlap(targetTopic, pTopic) > 0.1;
    });
  };

  for (const target of [...orphans, ...weakCommercial]) {
    const sources = candidatesFor(target).slice(0, 3);
    for (const source of sources) {
      const dedupKey = dedupKeyFor("internal_link", [source.id, target.id]);
      const opp: InternalLinkOpportunity = {
        id: deterministicId("opportunity", [dedupKey]),
        siteProfileId: opts.siteProfileId,
        kind: "internal_link",
        dedupKey,
        verification: "INFERRED",
        evidenceIds: [],
        sourcePageId: source.id,
        internalTargetPageId: target.id,
        suggestedAnchor: target.targetKeyword ?? target.title?.slice(0, 40),
        contextualReason: `Add a contextual link from "${source.title ?? source.url}" to "${target.title ?? target.url}" to improve topical flow and authority distribution.`,
        priority: Math.max(0, Math.min(100, (orphans.includes(target) ? 80 : 60) - source.priority / 4)),
        riskFlags: [],
        discoveredAt: now
      };
      opportunities.push(opp);
    }
  }

  return {
    opportunities,
    orphans,
    weakCommercial,
    repetitiveAnchors,
    deeplyBuried
  };
}

function tokenOverlap(a: string, b: string): number {
  const at = new Set(a.split(/[^a-z0-9]+/).filter((t) => t.length > 2));
  const bt = new Set(b.split(/[^a-z0-9]+/).filter((t) => t.length > 2));
  if (at.size === 0 || bt.size === 0) return 0;
  let inter = 0;
  for (const t of at) if (bt.has(t)) inter++;
  return inter / Math.max(at.size, bt.size);
}
