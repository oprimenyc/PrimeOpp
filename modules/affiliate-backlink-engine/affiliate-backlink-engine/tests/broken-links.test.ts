import { describe, it, expect } from "vitest";
import { analyzeBrokenLinks, findReplacement } from "../src/broken-links/finder.js";
import { InMemoryEvidenceStore } from "../src/domain/evidence.js";
import { TargetPage, ContentAsset } from "../src/domain/site.js";

const pages: TargetPage[] = [
  {
    id: "page_1",
    siteProfileId: "s1",
    url: "https://target.example/best-seamless-panties",
    canonicalUrl: "https://target.example/best-seamless-panties",
    title: "Best Seamless Panties Guide",
    contentType: "listicle",
    topic: "seamless panties",
    commercialIntent: "commercial_investigation",
    indexability: "indexable",
    priority: 80,
    verification: "DISCOVERED"
  }
];

const assets: ContentAsset[] = [];

describe("broken-link finder", () => {
  it("finds matches with evidence", () => {
    const store = new InMemoryEvidenceStore();
    const r = analyzeBrokenLinks(
      [
        {
          sourcePageUrl: "https://src.example/p1",
          brokenDestinationUrl: "https://dead.example/old",
          anchorText: "seamless panties FAQ",
          httpState: 404,
          detectedAt: Date.now()
        }
      ],
      {
        siteProfileId: "s1",
        targetTopics: ["seamless panties"],
        candidateReplacementPages: pages,
        candidateReplacementAssets: assets,
        recordEvidence: (e) => store.record(e)
      }
    );
    expect(r.matches.length).toBe(1);
    expect(r.matches[0].opportunity.brokenDestinationUrl).toBe("https://dead.example/old");
    expect(r.matches[0].opportunity.evidenceIds.length).toBe(1);
    expect(r.stale.length).toBe(0);
  });

  it("marks stale when detectedAt is past window", () => {
    const store = new InMemoryEvidenceStore();
    const oldDate = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days
    const r = analyzeBrokenLinks(
      [
        {
          sourcePageUrl: "https://src.example/p1",
          brokenDestinationUrl: "https://dead.example/old",
          detectedAt: oldDate
        }
      ],
      {
        siteProfileId: "s1",
        targetTopics: [],
        candidateReplacementPages: [],
        candidateReplacementAssets: [],
        recordEvidence: (e) => store.record(e)
      }
    );
    expect(r.matches[0].opportunity.verification).toBe("STALE");
  });

  it("findReplacement returns suitable match when topic overlaps", () => {
    const r = findReplacement(
      {
        sourcePageUrl: "https://src.example/p1",
        brokenDestinationUrl: "https://dead.example/old",
        anchorText: "seamless panties guide"
      },
      pages,
      assets
    );
    expect(r).toBeDefined();
    expect(r?.pageId).toBe("page_1");
  });

  it("findReplacement returns undefined when no overlap", () => {
    const r = findReplacement(
      {
        sourcePageUrl: "https://src.example/p1",
        brokenDestinationUrl: "https://dead.example/old",
        anchorText: "unrelated topic"
      },
      pages,
      assets
    );
    expect(r).toBeUndefined();
  });
});
