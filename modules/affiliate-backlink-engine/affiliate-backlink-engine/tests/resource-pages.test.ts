import { describe, it, expect } from "vitest";
import { analyzeResourcePages, classifyResourcePage, resourcePageRiskFlags } from "../src/resource-pages/finder.js";
import { InMemoryEvidenceStore } from "../src/domain/evidence.js";

describe("resource-page finder", () => {
  it("classifies resource pages", () => {
    expect(classifyResourcePage("https://x.example", "Statistics Reference", "")).toBe("statistics_reference");
    expect(classifyResourcePage("https://x.example", "Expert Roundup Post", "")).toBe("expert_resource");
    expect(classifyResourcePage("https://x.example", "Product Guide", "")).toBe("product_guide");
    expect(classifyResourcePage("https://x.example", "Industry Resource", "")).toBe("industry_resource");
  });

  it("flags paid-link solicitation as HIGH risk", () => {
    const flags = resourcePageRiskFlags("https://x.example", "Submit your site, buy backlinks cheap", "directory");
    expect(flags.some((f) => f.kind === "paid_link_solicitation" && f.level === "HIGH")).toBe(true);
  });

  it("flags generic top-level directories as MEDIUM", () => {
    const flags = resourcePageRiskFlags("https://x.example/", "List of Resources", "directory");
    expect(flags.some((f) => f.kind === "suspicious_directory_network" && f.level === "MEDIUM")).toBe(true);
  });

  it("analyzes resource pages with evidence and skips irrelevant", () => {
    const store = new InMemoryEvidenceStore();
    const results = analyzeResourcePages(
      [
        { url: "https://r.example/r1", title: "Lingerie Resource", snippet: "Resources about lingerie" },
        { url: "https://r.example/r2", title: "Unrelated", snippet: "Topics about widgets" }
      ],
      {
        siteProfileId: "s1",
        targetTopics: ["lingerie"],
        recordEvidence: (e) => store.record(e)
      }
    );
    // r1 should match; r2 should not (no overlap with "lingerie")
    expect(results.length).toBe(1);
    expect(results[0].opportunity.evidenceIds.length).toBe(1);
  });

  it("acceptsSubmissionsInferred true for directories", () => {
    const store = new InMemoryEvidenceStore();
    const results = analyzeResourcePages(
      [{ url: "https://r.example/dir", title: "Directory of Lingerie Sites", snippet: "directory lingerie" }],
      {
        siteProfileId: "s1",
        targetTopics: ["lingerie"],
        recordEvidence: (e) => store.record(e)
      }
    );
    expect(results[0].opportunity.acceptsSubmissionsInferred).toBe(true);
  });
});
