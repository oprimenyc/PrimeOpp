import { describe, it, expect } from "vitest";
import { analyzeInternalLinks } from "../src/internal-links/optimizer.js";
import { TargetPage } from "../src/domain/site.js";

const pages: TargetPage[] = [
  {
    id: "home",
    siteProfileId: "s",
    url: "https://x.example/",
    canonicalUrl: "https://x.example/",
    title: "Home",
    contentType: "homepage",
    commercialIntent: "navigational",
    indexability: "indexable",
    priority: 90,
    verification: "DISCOVERED"
  },
  {
    id: "orphan",
    siteProfileId: "s",
    url: "https://x.example/orphan",
    canonicalUrl: "https://x.example/orphan",
    title: "Orphan Page",
    contentType: "article",
    topic: "orphan topic",
    commercialIntent: "informational",
    indexability: "indexable",
    priority: 30,
    verification: "DISCOVERED"
  },
  {
    id: "weakcomm",
    siteProfileId: "s",
    url: "https://x.example/weak-commercial",
    canonicalUrl: "https://x.example/weak-commercial",
    title: "Weak Commercial",
    contentType: "product",
    topic: "commercial topic",
    commercialIntent: "transactional",
    indexability: "indexable",
    priority: 80,
    verification: "DISCOVERED"
  }
];

describe("internal link optimizer", () => {
  it("finds orphan pages", () => {
    const r = analyzeInternalLinks(
      {
        pages,
        edges: [{ source: "home", target: "weakcomm", anchor: "x" }]
      },
      { siteProfileId: "s" }
    );
    expect(r.orphans.map((p) => p.id)).toContain("orphan");
  });

  it("finds weakly connected commercial pages", () => {
    const r = analyzeInternalLinks(
      {
        pages,
        edges: [{ source: "home", target: "weakcomm", anchor: "x" }]
      },
      { siteProfileId: "s" }
    );
    // weakcomm has only 1 inbound link and is commercial
    expect(r.weakCommercial.map((p) => p.id)).toContain("weakcomm");
  });

  it("detects repetitive anchors", () => {
    const r = analyzeInternalLinks(
      {
        pages,
        edges: Array.from({ length: 7 }, () => ({ source: "home", target: "weakcomm", anchor: "click here" }))
      },
      { siteProfileId: "s", maxAcceptableAnchorRepeats: 5 }
    );
    expect(r.repetitiveAnchors.some((a) => a.anchor === "click here")).toBe(true);
  });

  it("detects deeply buried pages", () => {
    // Build a chain: home -> a -> b -> c -> d (depth 4)
    const chainPages: TargetPage[] = [
      pages[0],
      { ...pages[1], id: "a", priority: 80, topic: "x" },
      { ...pages[1], id: "b", priority: 80, topic: "x" },
      { ...pages[1], id: "c", priority: 80, topic: "x" },
      { ...pages[1], id: "d", priority: 80, topic: "x" }
    ];
    const r = analyzeInternalLinks(
      {
        pages: chainPages,
        edges: [
          { source: "home", target: "a" },
          { source: "a", target: "b" },
          { source: "b", target: "c" },
          { source: "c", target: "d" }
        ]
      },
      { siteProfileId: "s", maxAcceptableDepth: 2 }
    );
    expect(r.deeplyBuried.map((p) => p.id)).toContain("d");
  });

  it("suggests internal link opportunities for orphans", () => {
    const r = analyzeInternalLinks(
      {
        pages,
        edges: [{ source: "home", target: "weakcomm", anchor: "x" }]
      },
      { siteProfileId: "s" }
    );
    expect(r.opportunities.length).toBeGreaterThan(0);
    expect(r.opportunities.every((o) => o.kind === "internal_link")).toBe(true);
  });
});
