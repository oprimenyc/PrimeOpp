/**
 * PantiCandy example end-to-end workflow.
 *
 * Runs the full pipeline using only fixture data:
 *  - load site inventory
 *  - load fixture dataset
 *  - run discovery (competitor, broken-link, resource-page, mention)
 *  - run gap analysis
 *  - score opportunities
 *  - match content
 *  - prioritize refresh
 *  - plan campaigns
 *  - run outreach personalization
 *
 * Prints a summary. Used as a smoke test for the engine.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  InMemoryEvidenceStore,
  FixtureAdapter,
  SiteInventory,
  SiteInventoryBuilder,
  makeSiteProfile,
  makeTargetDomain,
  discoverCompetitorBacklinkOpportunities,
  discoverBrokenLinkOpportunities,
  discoverResourcePageOpportunities,
  discoverMentionOpportunities,
  deduplicateOpportunities,
  analyzeCompetitorGap,
  analyzeBrokenLinks,
  analyzeResourcePages,
  scoreOpportunity,
  assessOpportunityRisk,
  matchContentForOpportunity,
  prioritizeBatch,
  planCampaign,
  personalizeOutreach,
  LinkOpportunity,
  TargetPage
} from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(__dirname, "../fixtures/panticandy");

function readJson(rel: string): any {
  return JSON.parse(readFileSync(resolve(FIXTURE_DIR, rel), "utf-8"));
}

async function main() {
  const siteData = readJson("site.json");
  const dataset = readJson("dataset.json");

  // 1. Build site inventory.
  const site = makeSiteProfile("PantiCandy", "panticandy.com", ["lingerie", "intimate apparel", "affiliate editorial"]);
  const domain = makeTargetDomain(site.id, "panticandy.com");
  const builder = new SiteInventoryBuilder({});
  for (const p of siteData.pages) {
    builder.addPage({ ...p, siteProfileId: site.id });
  }
  const inventory = builder.build(site, domain);

  // 2. Build adapter + evidence store.
  const adapter = new FixtureAdapter(dataset);
  const store = new InMemoryEvidenceStore();

  const ctx = {
    siteProfileId: site.id,
    targetDomain: "panticandy.com",
    topics: site.topics,
    adapter,
    recordEvidence: (e: any) => store.record(e),
    now: 1715000000000
  };

  // 3. Discovery.
  const opps: LinkOpportunity[] = [];
  for (const comp of siteData.competitors) {
    const r = await discoverCompetitorBacklinkOpportunities(comp, ctx);
    opps.push(...r.opportunities);
  }
  for (const bl of siteData.brokenLinks) {
    const r = await discoverBrokenLinkOpportunities(bl.sourcePageUrl, ctx);
    opps.push(...r.opportunities);
  }
  const rsrc = await discoverResourcePageOpportunities("lingerie", ctx);
  opps.push(...rsrc.opportunities);
  const ment = await discoverMentionOpportunities("PantiCandy", ctx);
  opps.push(...ment.opportunities);
  const deduped = deduplicateOpportunities(opps);

  // 4. Gap analysis (using competitorBacklinks).
  const gap = analyzeCompetitorGap(siteData.competitorBacklinks, {
    siteProfileId: site.id,
    targetDomain: "panticandy.com",
    targetTopics: site.topics,
    recordEvidence: (e) => store.record(e),
    now: 1715000000000
  });

  // 5. Broken-link analysis with replacement matching.
  const broken = analyzeBrokenLinks(siteData.brokenLinks, {
    siteProfileId: site.id,
    targetTopics: site.topics,
    candidateReplacementPages: inventory.pages,
    candidateReplacementAssets: [],
    recordEvidence: (e) => store.record(e),
    now: 1715000000000
  });

  // 6. Resource-page analysis.
  const rpages = analyzeResourcePages(siteData.resourcePages, {
    siteProfileId: site.id,
    targetTopics: site.topics,
    recordEvidence: (e) => store.record(e),
    now: 1715000000000
  });

  // 7. Score all opportunities.
  const allOpps = deduplicateOpportunities([
    ...deduped,
    ...gap.opportunities,
    ...broken.matches.map((m) => m.opportunity),
    ...rpages.map((r) => r.opportunity)
  ]);
  const scored = allOpps.map((o) => {
    // Apply risk filtering.
    const ctx2 = { targetTopics: site.topics, now: 1715000000000 };
    const domainFlags = []; // would normally look up by linkingDomainId
    const pageFlags = [];
    const oppFlags = assessOpportunityRisk(o, ctx2);
    const withRisk = { ...o, riskFlags: [...o.riskFlags, ...oppFlags] };
    const s = scoreOpportunity(withRisk, {
      evidence: store.all(),
      now: 1715000000000,
      matchedTargetPage: inventory.pages.find((p) => p.id === o.targetPageId)
    });
    return { opportunity: withRisk, score: s };
  });

  // 8. Content match.
  const matches = allOpps.map((o) => matchContentForOpportunity(o, inventory.pages, []));

  // 9. Refresh priorities (use page attributes).
  const refreshInputs = inventory.pages
    .filter((p) => p.attributes)
    .map((p) => ({
      page: p,
      rankingPosition: p.attributes?.rankingPosition as number | undefined,
      contentAgeDays: p.attributes?.contentAgeDays as number | undefined,
      contentCompleteness: p.attributes?.contentCompleteness as number | undefined,
      commercialImportance: p.commercialIntent === "transactional" || p.commercialIntent === "commercial_investigation" ? 0.8 : 0.4,
      backlinkOpportunityCount: scored.filter((s) => s.opportunity.targetPageId === p.id).length
    }));
  const refresh = prioritizeBatch(refreshInputs as any);

  // 10. Campaign planning.
  const campaigns = [];
  const c1 = planCampaign({
    siteProfileId: site.id,
    name: "PantiCandy broken-link campaign",
    type: "broken_link",
    opportunities: broken.matches.map((m) => m.opportunity),
    brandName: "PantiCandy",
    now: 1715000000000
  });
  campaigns.push(c1);

  // 11. Outreach personalization (on a broken-link opportunity).
  const firstBroken = broken.matches[0]?.opportunity;
  let brief: any = null;
  if (firstBroken) {
    const result = await personalizeOutreach({
      siteProfileId: site.id,
      opportunity: firstBroken,
      matchedTargetPage: inventory.pages[1],
      evidence: store.all(),
      brandName: "PantiCandy",
      now: 1715000000000
    });
    brief = result.brief;
  }

  const summary = {
    site: site.name,
    pages: inventory.pages.length,
    opportunitiesDiscovered: deduped.length,
    gapOpportunities: gap.opportunities.length,
    gapDomains: gap.gapDomains.length,
    multiCompetitorPages: gap.multiCompetitorPages.length,
    commonResourceDomains: gap.commonResourceDomains,
    brokenMatches: broken.matches.length,
    brokenStale: broken.stale.length,
    resourcePages: rpages.length,
    scored: scored.length,
    top5: scored
      .sort((a, b) => b.score.total - a.score.total)
      .slice(0, 5)
      .map((s) => ({ id: s.opportunity.id, kind: s.opportunity.kind, total: s.score.total, action: s.score.recommendedAction })),
    refreshTop3: refresh.slice(0, 3).map((r) => ({ pageId: r.pageId, score: r.score, priority: r.priority })),
    campaigns: campaigns.map((c) => ({ id: c.id, name: c.name, type: c.type, state: c.state, priority: c.priority })),
    briefSample: brief
      ? {
          outreachReason: brief.outreachReason,
          factsCount: brief.factInferenceUnknown.facts.length,
          inferencesCount: brief.factInferenceUnknown.inferences.length,
          unknownsCount: brief.factInferenceUnknown.unknowns.length,
          draftVariants: brief.draftVariants.length
        }
      : null,
    evidenceRecords: store.all().length
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
