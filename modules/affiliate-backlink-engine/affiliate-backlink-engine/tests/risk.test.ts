import { describe, it, expect } from "vitest";
import {
  assessDomainRisk,
  assessPageRisk,
  assessOpportunityRisk,
  detectDuplicateDomains,
  detectDuplicateOpportunities,
  applyRiskToOpportunity,
  dedupFlags,
  categorize
} from "../src/risk/filter.js";
import { LinkingDomain, LinkingPage } from "../src/domain/backlink.js";
import { LinkOpportunity } from "../src/domain/opportunity.js";

describe("risk filtering", () => {
  it("flags link-farm naming patterns", () => {
    const ld: LinkingDomain = { id: "ld1", domain: "submit-links-farm.example", verification: "DISCOVERED" };
    const flags = assessDomainRisk(ld, { targetTopics: [] });
    expect(flags.some((f) => f.kind === "link_farm")).toBe(true);
  });

  it("REJECTs adult/gambling when target topics don't match", () => {
    const ld: LinkingDomain = { id: "ld1", domain: "casino-betting.example", verification: "DISCOVERED" };
    const flags = assessDomainRisk(ld, { targetTopics: ["lingerie"] });
    expect(flags.some((f) => f.level === "REJECT")).toBe(true);
  });

  it("does NOT reject adult/gambling when target topics match", () => {
    const ld: LinkingDomain = { id: "ld1", domain: "casino.example", verification: "DISCOVERED" };
    const flags = assessDomainRisk(ld, { targetTopics: ["casino"] });
    expect(flags.some((f) => f.level === "REJECT")).toBe(false);
  });

  it("flags excessive outbound links", () => {
    const lp: LinkingPage = {
      id: "lp1",
      linkingDomainId: "ld1",
      url: "https://x.example/p1",
      verification: "DISCOVERED",
      outboundLinkCount: 250
    };
    const flags = assessPageRisk(lp, { targetTopics: [] });
    expect(flags.some((f) => f.kind === "excessive_outbound_links" && f.level === "REJECT")).toBe(true);
  });

  it("flags stale pages", () => {
    const lp: LinkingPage = {
      id: "lp1",
      linkingDomainId: "ld1",
      url: "https://x.example/p1",
      verification: "STALE",
      verifiedAt: 1000
    };
    const flags = assessPageRisk(lp, { targetTopics: [] });
    expect(flags.some((f) => f.kind === "stale_opportunity")).toBe(true);
  });

  it("flags unreachable pages", () => {
    const lp: LinkingPage = {
      id: "lp1",
      linkingDomainId: "ld1",
      url: "https://x.example/p1",
      verification: "BLOCKED"
    };
    const flags = assessPageRisk(lp, { targetTopics: [] });
    expect(flags.some((f) => f.kind === "unreachable_page")).toBe(true);
  });

  it("flags duplicate opportunities", () => {
    const opps: LinkOpportunity[] = [
      {
        id: "o1",
        siteProfileId: "s",
        kind: "broken_link",
        dedupKey: "k1",
        verification: "DISCOVERED",
        evidenceIds: [],
        brokenDestinationUrl: "x",
        existingContentSuitable: false,
        contentUpdateRequired: true,
        riskFlags: [],
        discoveredAt: 1
      } as LinkOpportunity,
      {
        id: "o2",
        siteProfileId: "s",
        kind: "broken_link",
        dedupKey: "k1",
        verification: "DISCOVERED",
        evidenceIds: [],
        brokenDestinationUrl: "x",
        existingContentSuitable: false,
        contentUpdateRequired: true,
        riskFlags: [],
        discoveredAt: 1
      } as LinkOpportunity
    ];
    const flags = detectDuplicateOpportunities(opps);
    expect(flags.length).toBe(1);
  });

  it("flags duplicate domains appearing >5 times", () => {
    const opps: LinkOpportunity[] = Array.from({ length: 7 }, (_, i) => ({
      id: `o${i}`,
      siteProfileId: "s",
      kind: "broken_link",
      dedupKey: `k${i}`,
      verification: "DISCOVERED",
      evidenceIds: [],
      brokenDestinationUrl: "x",
      existingContentSuitable: false,
      contentUpdateRequired: true,
      riskFlags: [],
      discoveredAt: 1,
      linkingDomainId: "ld_same"
    } as LinkOpportunity));
    const flags = detectDuplicateDomains(opps);
    expect(flags.length).toBe(1);
  });

  it("dedupFlags removes identical flags", () => {
    const f = { kind: "spam_pattern" as const, level: "HIGH" as const, reason: "x", confidence: 0.7 };
    expect(dedupFlags([f, f, f]).length).toBe(1);
  });

  it("categorize returns worst level", () => {
    const flags = [
      { kind: "spam_pattern" as const, level: "LOW" as const, reason: "x", confidence: 0.5 },
      { kind: "thin_content" as const, level: "HIGH" as const, reason: "y", confidence: 0.5 }
    ];
    expect(categorize(flags)).toBe("HIGH");
  });

  it("applyRiskToOpportunity merges flags", () => {
    const opp: any = {
      id: "o",
      kind: "broken_link",
      riskFlags: [{ kind: "spam_pattern", level: "LOW", reason: "x", confidence: 0.5 }],
      dedupKey: "k"
    };
    const out = applyRiskToOpportunity(opp, [{ kind: "thin_content", level: "HIGH", reason: "y", confidence: 0.5 }], []);
    expect(out.riskFlags.length).toBe(2);
  });
});
