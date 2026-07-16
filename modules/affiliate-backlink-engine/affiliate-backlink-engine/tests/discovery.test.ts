import { describe, it, expect } from "vitest";
import {
  discoverCompetitorBacklinkOpportunities,
  discoverBrokenLinkOpportunities,
  discoverResourcePageOpportunities,
  discoverMentionOpportunities,
  deduplicateOpportunities,
  suggestLinkableAssetOpportunities,
  classifyResourcePageInline,
  quickTopicalRelevance
} from "../src/discovery/discovery.js";
import { FixtureAdapter } from "../src/adapters/fixtures.js";
import { InMemoryEvidenceStore } from "../src/domain/evidence.js";

function ctx(store = new InMemoryEvidenceStore(), adapter = new FixtureAdapter({})) {
  return {
    siteProfileId: "site_1",
    targetDomain: "example.com",
    topics: ["lingerie", "affiliate"],
    adapter,
    recordEvidence: (e: any) => store.record(e),
    now: 1715000000000
  };
}

describe("discovery", () => {
  it("discovers competitor backlink opportunities with evidence", async () => {
    const store = new InMemoryEvidenceStore();
    const adapter = new FixtureAdapter({
      backlinks: [
        {
          linkingDomain: "src.example",
          linkingPageUrl: "https://src.example/p1",
          targetUrl: "https://competitor.example/x",
          anchorText: "x",
          matchDomain: "competitor.example"
        }
      ]
    });
    const r = await discoverCompetitorBacklinkOpportunities(
      { id: "comp_1", domain: "competitor.example" },
      ctx(store, adapter)
    );
    expect(r.opportunities.length).toBe(1);
    expect(r.opportunities[0].kind).toBe("competitor_backlink_gap");
    expect(r.opportunities[0].evidenceIds.length).toBe(1);
    expect(r.linkingDomains.length).toBe(1);
    expect(r.linkingPages.length).toBe(1);
    // 1 domain evidence + 1 page evidence + 1 opportunity evidence
    expect(store.all().length).toBe(3);
  });

  it("discovers broken-link opportunities", async () => {
    const store = new InMemoryEvidenceStore();
    const adapter = new FixtureAdapter({
      brokenLinks: [
        {
          sourcePageUrl: "https://src.example/p1",
          brokenDestinationUrl: "https://dead.example/old",
          httpState: 404,
          matchPage: "https://src.example/p1"
        }
      ]
    });
    const r = await discoverBrokenLinkOpportunities("https://src.example/p1", ctx(store, adapter));
    expect(r.opportunities.length).toBe(1);
    expect(r.opportunities[0].kind).toBe("broken_link");
    expect((r.opportunities[0] as any).brokenDestinationUrl).toBe("https://dead.example/old");
  });

  it("discovers resource-page opportunities", async () => {
    const store = new InMemoryEvidenceStore();
    const adapter = new FixtureAdapter({
      resourcePages: [
        {
          url: "https://r.example/r1",
          title: "Lingerie Resource Page",
          snippet: "Resources about lingerie",
          topicMatch: ["lingerie"]
        }
      ]
    });
    const r = await discoverResourcePageOpportunities("lingerie", ctx(store, adapter));
    expect(r.opportunities.length).toBe(1);
    expect(r.opportunities[0].kind).toBe("resource_page");
  });

  it("discovers unlinked mentions and skips already-linked", async () => {
    const store = new InMemoryEvidenceStore();
    const adapter = new FixtureAdapter({
      mentions: [
        {
          url: "https://m.example/p1",
          snippet: "We mention Brand",
          term: "Brand",
          hasLink: false,
          matchTerm: "brand"
        },
        {
          url: "https://m.example/p2",
          snippet: "Already linked Brand",
          term: "Brand",
          hasLink: true,
          matchTerm: "brand"
        }
      ]
    });
    const r = await discoverMentionOpportunities("Brand", ctx(store, adapter));
    expect(r.opportunities.length).toBe(1);
    expect(r.opportunities[0].kind).toBe("unlinked_mention");
  });

  it("classifyResourcePageInline returns expected classifications", () => {
    expect(classifyResourcePageInline("https://x.example", "Statistics Hub", "")).toBe("statistics_reference");
    expect(classifyResourcePageInline("https://x.example", "Expert Roundup", "")).toBe("expert_resource");
    expect(classifyResourcePageInline("https://x.example", "Tutorial: Learn X", "")).toBe("educational_resource");
    expect(classifyResourcePageInline("https://x.example/directory", "List of Resources", "")).toBe("directory");
  });

  it("quickTopicalRelevance computes similarity", () => {
    const r = quickTopicalRelevance("affiliate marketing", "affiliate marketing strategy", ["affiliate"]);
    expect(r.similarity).toBeGreaterThan(0.3);
  });

  it("deduplicateOpportunities merges by dedupKey and unions evidence", () => {
    const a: any = {
      id: "opp_a",
      siteProfileId: "s",
      kind: "broken_link",
      dedupKey: "broken_link::url::dest",
      verification: "DISCOVERED",
      evidenceIds: ["e1"],
      brokenDestinationUrl: "dest",
      existingContentSuitable: false,
      contentUpdateRequired: true,
      riskFlags: [],
      discoveredAt: 1000
    };
    const b: any = { ...a, id: "opp_b", evidenceIds: ["e2"] };
    const deduped = deduplicateOpportunities([a, b]);
    expect(deduped.length).toBe(1);
    expect(deduped[0].evidenceIds).toEqual(expect.arrayContaining(["e1", "e2"]));
  });

  it("suggestLinkableAssetOpportunities produces INFERRED opportunities for missing archetypes", () => {
    const store = new InMemoryEvidenceStore();
    const c = ctx(store);
    const opps = suggestLinkableAssetOpportunities(
      [{ archetype: "guide", topic: "matcha" }],
      [{ archetype: "statistics_page", topic: "matcha" }],
      c
    );
    expect(opps.length).toBe(1);
    expect(opps[0].verification).toBe("INFERRED");
  });
});
