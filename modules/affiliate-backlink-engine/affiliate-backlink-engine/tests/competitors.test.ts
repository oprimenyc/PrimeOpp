import { describe, it, expect } from "vitest";
import { analyzeCompetitorGap, assessReplicability, competitorGapRiskFlags } from "../src/competitors/gap-analyzer.js";
import { InMemoryEvidenceStore } from "../src/domain/evidence.js";

describe("competitor gap analysis", () => {
  it("finds domains linking to competitors but not target", () => {
    const store = new InMemoryEvidenceStore();
    const r = analyzeCompetitorGap(
      [
        {
          competitorId: "comp_a",
          competitorDomain: "a.example",
          backlinks: [
            { linkingDomain: "shared.example", linkingPageUrl: "https://shared.example/p1", targetUrl: "https://a.example/", anchorText: "x" }
          ]
        },
        {
          competitorId: "comp_b",
          competitorDomain: "b.example",
          backlinks: [
            { linkingDomain: "shared.example", linkingPageUrl: "https://shared.example/p1", targetUrl: "https://b.example/", anchorText: "y" },
            { linkingDomain: "unique.example", linkingPageUrl: "https://unique.example/p1", targetUrl: "https://b.example/", anchorText: "z" }
          ]
        }
      ],
      {
        siteProfileId: "s1",
        targetDomain: "target.example",
        targetTopics: ["topic"],
        recordEvidence: (e) => store.record(e)
      }
    );
    expect(r.gapDomains.length).toBe(2);
    expect(r.overlapByDomain.get("shared.example")).toBe(2);
    expect(r.overlapByDomain.get("unique.example")).toBe(1);
    expect(r.commonResourceDomains).toContain("shared.example");
    expect(r.multiCompetitorPages.length).toBe(1);
  });

  it("excludes domains the target already has", () => {
    const store = new InMemoryEvidenceStore();
    const r = analyzeCompetitorGap(
      [
        {
          competitorId: "comp_a",
          competitorDomain: "a.example",
          backlinks: [
            { linkingDomain: "targethas.example", linkingPageUrl: "https://targethas.example/p1", targetUrl: "https://a.example/" }
          ]
        }
      ],
      {
        siteProfileId: "s1",
        targetDomain: "target.example",
        targetTopics: [],
        targetExistingBacklinkDomains: new Set(["targethas.example"]),
        recordEvidence: (e) => store.record(e)
      }
    );
    expect(r.gapDomains.length).toBe(0);
  });

  it("uniqueByCompetitor attributes single-competitor sources", () => {
    const store = new InMemoryEvidenceStore();
    const r = analyzeCompetitorGap(
      [
        {
          competitorId: "comp_a",
          competitorDomain: "a.example",
          backlinks: [
            { linkingDomain: "unique.example", linkingPageUrl: "https://unique.example/p1", targetUrl: "https://a.example/" }
          ]
        }
      ],
      {
        siteProfileId: "s1",
        targetDomain: "target.example",
        targetTopics: [],
        recordEvidence: (e) => store.record(e)
      }
    );
    expect(r.uniqueByCompetitor.get("comp_a")).toEqual(["unique.example"]);
  });

  it("assessReplicability never assumes replicable for single-competitor low-relevance", () => {
    const r = assessReplicability("lowrel.example", 1, 0.0);
    expect(r.value).toBe(false);
  });

  it("assessReplicability returns true for multi-competitor + topical", () => {
    const r = assessReplicability("highrel.example", 3, 0.8, "anchor");
    expect(r.value).toBe(true);
    expect(r.confidence).toBeGreaterThan(0.5);
  });

  it("competitorGapRiskFlags flags single-competitor low-topical sources", () => {
    const opp: any = {
      kind: "competitor_backlink_gap",
      competitorOverlap: 1,
      topical: { similarity: 0.05 }
    };
    const flags = competitorGapRiskFlags(opp);
    expect(flags.length).toBeGreaterThan(0);
  });
});
