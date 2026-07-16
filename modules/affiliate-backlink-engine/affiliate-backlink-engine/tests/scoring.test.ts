import { describe, it, expect } from "vitest";
import { scoreOpportunity, rankByScore, SCORING_MODEL_VERSION, DEFAULT_WEIGHTS } from "../src/scoring/engine.js";
import { LinkOpportunity } from "../src/domain/opportunity.js";
import { EvidenceRecord } from "../src/domain/evidence.js";
import { RiskFlag } from "../src/domain/risk.js";

function makeOpp(overrides: Partial<LinkOpportunity> = {}): LinkOpportunity {
  return {
    id: "opp_test",
    siteProfileId: "s1",
    kind: "broken_link",
    dedupKey: "broken_link::x::y",
    verification: "DISCOVERED",
    evidenceIds: ["evd_1"],
    brokenDestinationUrl: "https://dead.example/old",
    existingContentSuitable: false,
    contentUpdateRequired: true,
    riskFlags: [],
    discoveredAt: Date.now(),
    ...overrides
  } as LinkOpportunity;
}

function makeEvidence(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    id: "evd_1",
    kind: "broken_link_observation",
    subjectId: "opp_test",
    claim: "broken link observed",
    observedAt: Date.now(),
    source: { adapter: "fixture" },
    verification: "DISCOVERED",
    ...overrides
  };
}

describe("scoring engine", () => {
  it("produces a score with components and explanation", () => {
    const opp = makeOpp();
    const ev = makeEvidence();
    const s = scoreOpportunity(opp, { evidence: [ev] });
    expect(s.total).toBeGreaterThanOrEqual(0);
    expect(s.total).toBeLessThanOrEqual(100);
    expect(s.components.length).toBeGreaterThan(10);
    expect(s.confidence).toBeGreaterThan(0);
    expect(s.modelVersion).toBe(SCORING_MODEL_VERSION);
    expect(s.recommendedAction).toBeDefined();
  });

  it("total is the weighted sum of components", () => {
    const opp = makeOpp();
    const ev = makeEvidence();
    const s = scoreOpportunity(opp, { evidence: [ev] });
    const expected = s.components.reduce((sum, c) => sum + c.score * c.weight, 0);
    expect(Math.abs(s.total - Math.round(expected * 10) / 10)).toBeLessThan(1);
  });

  it("REJECT risk level yields REJECT action", () => {
    const opp = makeOpp({
      riskFlags: [{ kind: "adult_gambling_illegal_mismatch", level: "REJECT", reason: "x", confidence: 1 }]
    });
    const ev = makeEvidence();
    const s = scoreOpportunity(opp, { evidence: [ev] });
    expect(s.recommendedAction).toBe("REJECT");
  });

  it("HIGH risk yields DEFER", () => {
    const opp = makeOpp({
      riskFlags: [{ kind: "spam_pattern", level: "HIGH", reason: "x", confidence: 0.7 }]
    });
    const ev = makeEvidence();
    const s = scoreOpportunity(opp, { evidence: [ev] });
    expect(s.recommendedAction).toBe("DEFER");
  });

  it("low evidence confidence yields NEEDS_EVIDENCE", () => {
    const opp = makeOpp({ evidenceIds: [] });
    const s = scoreOpportunity(opp, { evidence: [] });
    expect(s.recommendedAction).toBe("NEEDS_EVIDENCE");
  });

  it("content not ready yields PURSUE_AFTER_REFRESH", () => {
    const opp = makeOpp();
    const ev = makeEvidence();
    const s = scoreOpportunity(opp, { evidence: [ev], contentReady: false });
    expect(s.recommendedAction).toBe("PURSUE_AFTER_REFRESH");
  });

  it("weights are provider-agnostic (no single provider dominates)", () => {
    expect(DEFAULT_WEIGHTS.provider_authority).toBeLessThanOrEqual(0.05);
    const sum = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(0.05);
  });

  it("rankByScore sorts descending", () => {
    const opp1 = makeOpp({ id: "opp_a" });
    const opp2 = makeOpp({ id: "opp_b", riskFlags: [{ kind: "spam_pattern", level: "HIGH", reason: "x", confidence: 0.7 }] });
    const ev = makeEvidence();
    const s1 = scoreOpportunity(opp1, { evidence: [ev] });
    const s2 = scoreOpportunity(opp2, { evidence: [ev] });
    const ranked = rankByScore([
      { opp: opp2, score: s2 },
      { opp: opp1, score: s1 }
    ]);
    expect(ranked[0].opp.id).toBe("opp_a");
  });

  it("deterministic for identical inputs", () => {
    const opp = makeOpp();
    const ev = makeEvidence();
    const s1 = scoreOpportunity(opp, { evidence: [ev], now: 1000 });
    const s2 = scoreOpportunity(opp, { evidence: [ev], now: 1000 });
    expect(s1.total).toBe(s2.total);
    expect(s1.recommendedAction).toBe(s2.recommendedAction);
  });
});
