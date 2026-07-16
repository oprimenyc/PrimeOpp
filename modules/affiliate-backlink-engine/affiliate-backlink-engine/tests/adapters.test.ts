import { describe, it, expect } from "vitest";
import {
  FixtureAdapter,
  CompositeAdapter,
  AdapterError
} from "../src/adapters/index.js";
import { FixtureDataset } from "../src/adapters/fixtures.js";

const dataset: FixtureDataset = {
  search: [
    { url: "https://a.example/", title: "alpha topic", snippet: "alpha", queryMatch: ["alpha"] },
    { url: "https://b.example/", title: "beta topic", snippet: "beta", queryMatch: ["beta"] }
  ],
  backlinks: [
    {
      linkingDomain: "x.example",
      linkingPageUrl: "https://x.example/p1",
      targetUrl: "https://competitor.example/p1",
      anchorText: "alpha",
      matchDomain: "competitor.example"
    }
  ],
  brokenLinks: [
    {
      sourcePageUrl: "https://x.example/p1",
      brokenDestinationUrl: "https://dead.example/old",
      anchorText: "old link",
      httpState: 404,
      matchPage: "https://x.example/p1"
    }
  ],
  resourcePages: [
    {
      url: "https://r.example/r1",
      title: "Alpha Resource",
      snippet: "A resource about alpha",
      topicMatch: ["alpha"]
    }
  ],
  mentions: [
    {
      url: "https://m.example/p1",
      snippet: "We mention BrandName",
      term: "BrandName",
      hasLink: false,
      matchTerm: "brandname"
    }
  ]
};

describe("FixtureAdapter", () => {
  it("search returns matches by query", async () => {
    const a = new FixtureAdapter(dataset);
    const r = await a.search({ query: "alpha" });
    expect(r.data.length).toBe(1);
    expect(r.data[0].url).toBe("https://a.example/");
  });

  it("searchBacklinks filters by targetDomain", async () => {
    const a = new FixtureAdapter(dataset);
    const r = await a.searchBacklinks({ targetDomain: "competitor.example" });
    expect(r.data.length).toBe(1);
    expect(r.data[0].linkingDomain).toBe("x.example");
  });

  it("searchBrokenLinks filters by pageUrl", async () => {
    const a = new FixtureAdapter(dataset);
    const r = await a.searchBrokenLinks({ pageUrl: "https://x.example/p1" });
    expect(r.data.length).toBe(1);
  });

  it("searchResourcePages matches by topic", async () => {
    const a = new FixtureAdapter(dataset);
    const r = await a.searchResourcePages({ topic: "alpha" });
    expect(r.data.length).toBe(1);
  });

  it("searchMentions matches by term", async () => {
    const a = new FixtureAdapter(dataset);
    const r = await a.searchMentions({ term: "BrandName" });
    expect(r.data.length).toBe(1);
  });

  it("marks results as offline-fixture", async () => {
    const a = new FixtureAdapter(dataset);
    const r = await a.search({ query: "alpha" });
    expect(r.warnings).toContain("offline-fixture");
    expect(r.confidence.dataConfidence).toBe(1.0);
  });

  it("meta has correct id", () => {
    const a = new FixtureAdapter(dataset);
    expect(a.meta.id).toBe("adapter.fixture");
    expect(a.meta.offline).toBe(true);
  });
});

describe("CompositeAdapter", () => {
  it("merges results from multiple adapters", async () => {
    const a = new FixtureAdapter(dataset);
    const a2 = new FixtureAdapter({
      search: [{ url: "https://c.example/", title: "gamma", queryMatch: ["gamma"] }]
    });
    const composite = new CompositeAdapter([a, a2]);
    const r = await composite.search({ query: "alpha" });
    expect(r.data.length).toBe(1);
    const r2 = await composite.search({ query: "gamma" });
    expect(r2.data.length).toBe(1);
  });

  it("takes the highest confidence", async () => {
    const a = new FixtureAdapter(dataset);
    const composite = new CompositeAdapter([a]);
    const r = await composite.search({ query: "alpha" });
    expect(r.confidence.dataConfidence).toBe(1.0);
  });

  it("throws when empty", () => {
    expect(() => new CompositeAdapter([])).toThrow();
  });

  it("captures adapter errors as warnings instead of throwing", async () => {
    const failing = {
      meta: new FixtureAdapter().meta,
      async search() {
        throw new AdapterError("boom", "test", "network", true);
      }
    };
    const ok = new FixtureAdapter(dataset);
    const composite = new CompositeAdapter([failing as any, ok]);
    const r = await composite.search({ query: "alpha" });
    expect(r.data.length).toBe(1);
    expect(r.warnings?.some((w) => w.includes("boom"))).toBe(true);
  });
});
