/**
 * Generic affiliate site example workflow.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  InMemoryEvidenceStore,
  FixtureAdapter,
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
  planCampaign,
  personalizeOutreach
} from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(__dirname, "../fixtures/generic");

function readJson(rel: string): any {
  return JSON.parse(readFileSync(resolve(FIXTURE_DIR, rel), "utf-8"));
}

async function main() {
  const siteData = readJson("site.json");
  const dataset = readJson("dataset.json");
  const site = makeSiteProfile("Generic Affiliate Site", "genericaffiliate.example", ["kitchen appliances", "affiliate reviews"]);
  const domain = makeTargetDomain(site.id, "genericaffiliate.example");
  const builder = new SiteInventoryBuilder({});
  for (const p of siteData.pages) builder.addPage({ ...p, siteProfileId: site.id });
  const inventory = builder.build(site, domain);
  const adapter = new FixtureAdapter(dataset);
  const store = new InMemoryEvidenceStore();
  const ctx = {
    siteProfileId: site.id,
    targetDomain: "genericaffiliate.example",
    topics: site.topics,
    adapter,
    recordEvidence: (e: any) => store.record(e),
    now: 1715000000000
  };
  const opps: any[] = [];
  for (const comp of siteData.competitors) {
    const r = await discoverCompetitorBacklinkOpportunities(comp, ctx);
    opps.push(...r.opportunities);
  }
  for (const bl of siteData.brokenLinks) {
    const r = await discoverBrokenLinkOpportunities(bl.sourcePageUrl, ctx);
    opps.push(...r.opportunities);
  }
  const rsrc = await discoverResourcePageOpportunities("kitchen appliances", ctx);
  opps.push(...rsrc.opportunities);
  const ment = await discoverMentionOpportunities("Generic Affiliate Site", ctx);
  opps.push(...ment.opportunities);
  const deduped = deduplicateOpportunities(opps);
  const gap = analyzeCompetitorGap(siteData.competitorBacklinks, {
    siteProfileId: site.id,
    targetDomain: "genericaffiliate.example",
    targetTopics: site.topics,
    recordEvidence: (e) => store.record(e),
    now: 1715000000000
  });
  const broken = analyzeBrokenLinks(siteData.brokenLinks, {
    siteProfileId: site.id,
    targetTopics: site.topics,
    candidateReplacementPages: inventory.pages,
    candidateReplacementAssets: [],
    recordEvidence: (e) => store.record(e),
    now: 1715000000000
  });
  const rpages = analyzeResourcePages(siteData.resourcePages, {
    siteProfileId: site.id,
    targetTopics: site.topics,
    recordEvidence: (e) => store.record(e),
    now: 1715000000000
  });
  const allOpps = deduplicateOpportunities([...deduped, ...gap.opportunities, ...broken.matches.map((m) => m.opportunity), ...rpages.map((r) => r.opportunity)]);
  const scored = allOpps.map((o) => ({
    opportunity: o,
    score: scoreOpportunity(o, { evidence: store.all(), now: 1715000000000 })
  }));
  const c1 = planCampaign({
    siteProfileId: site.id,
    name: "Generic broken-link + resource campaign",
    type: "broken_link",
    opportunities: broken.matches.map((m) => m.opportunity),
    brandName: "Generic Affiliate Site",
    now: 1715000000000
  });
  let brief: any = null;
  if (broken.matches[0]) {
    const r = await personalizeOutreach({
      siteProfileId: site.id,
      opportunity: broken.matches[0].opportunity,
      matchedTargetPage: inventory.pages[1],
      evidence: store.all(),
      brandName: "Generic Affiliate Site",
      now: 1715000000000
    });
    brief = r.brief;
  }
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        site: site.name,
        pages: inventory.pages.length,
        opportunities: deduped.length,
        gapOpportunities: gap.opportunities.length,
        brokenMatches: broken.matches.length,
        resourcePages: rpages.length,
        scored: scored.length,
        top3: scored
          .sort((a, b) => b.score.total - a.score.total)
          .slice(0, 3)
          .map((s) => ({ id: s.opportunity.id, kind: s.opportunity.kind, total: s.score.total })),
        campaign: { id: c1.id, type: c1.type, state: c1.state },
        briefSample: brief ? { outreachReason: brief.outreachReason, draftVariants: brief.draftVariants.length } : null,
        evidenceRecords: store.all().length
      },
      null,
      2
    )
  );
}
main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
