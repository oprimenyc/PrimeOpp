import { describe, it, expect } from "vitest";
import { matchContentForOpportunity } from "../src/content/matcher.js";
import { prioritizeRefresh, prioritizeBatch } from "../src/content/refresh.js";
import { TargetPage } from "../src/domain/site.js";
import { BrokenLinkOpportunity, LinkOpportunity } from "../src/domain/opportunity.js";

const pages: TargetPage[] = [
  {
    id: "page_1",
    siteProfileId: "s1",
    url: "https://target.example/best-seamless-panties",
    canonicalUrl: "https://target.example/best-seamless-panties",
    title: "Best Seamless Panties",
    contentType: "listicle",
    topic: "seamless panties",
    commercialIntent: "commercial_investigation",
    indexability: "indexable",
    priority: 80,
    verification: "DISCOVERED"
  }
];

describe("content matcher", () => {
  it("returns direct match when topic overlaps strongly", () => {
    const opp: BrokenLinkOpportunity = {
      id: "opp_1",
      siteProfileId: "s1",
      kind: "broken_link",
      dedupKey: "broken_link::x::y",
      verification: "DISCOVERED",
      evidenceIds: [],
      brokenDestinationUrl: "https://dead.example/old",
      anchorText: "seamless panties faq",
      existingContentSuitable: false,
      contentUpdateRequired: true,
      riskFlags: [],
      discoveredAt: 1
    };
    const m = matchContentForOpportunity(opp, pages, []);
    expect(m.matchLevel).toBe("direct");
    expect(m.bestTargetPageId).toBe("page_1");
    expect(m.linkingRationale).toContain("replace");
  });

  it("returns none + suggests new asset when no overlap", () => {
    const opp: BrokenLinkOpportunity = {
      id: "opp_2",
      siteProfileId: "s1",
      kind: "broken_link",
      dedupKey: "broken_link::x::z",
      verification: "DISCOVERED",
      evidenceIds: [],
      brokenDestinationUrl: "https://dead.example/old",
      anchorText: "unrelated",
      existingContentSuitable: false,
      contentUpdateRequired: true,
      riskFlags: [],
      discoveredAt: 1
    };
    const m = matchContentForOpportunity(opp, pages, []);
    expect(m.matchLevel).toBe("none");
    expect(m.suggestedNewAsset).toBeDefined();
  });
});

describe("refresh prioritizer", () => {
  it("HIGH priority when ranking 11-15 + high commercial importance + content gaps", () => {
    const r = prioritizeRefresh({
      page: pages[0],
      rankingPosition: 12,
      commercialImportance: 0.8,
      contentAgeDays: 400,
      backlinkOpportunityCount: 4,
      competitorGap: 0.6,
      contentCompleteness: 0.4
    });
    expect(r.priority).toBe("HIGH");
    expect(r.score).toBeGreaterThan(60);
    expect(r.dataSourcesUsed).toContain("rankingPosition");
  });

  it("does not fabricate ranking data when none supplied", () => {
    const r = prioritizeRefresh({
      page: pages[0],
      commercialImportance: 0.5
    });
    expect(r.dataSourcesUsed).not.toContain("rankingPosition");
  });

  it("prioritizeBatch sorts by score descending", () => {
    const r = prioritizeBatch([
      { page: pages[0], rankingPosition: 14, commercialImportance: 0.8 },
      { page: { ...pages[0], id: "page_2" }, commercialImportance: 0.3 }
    ]);
    expect(r[0].score).toBeGreaterThan(r[1].score);
  });
});
