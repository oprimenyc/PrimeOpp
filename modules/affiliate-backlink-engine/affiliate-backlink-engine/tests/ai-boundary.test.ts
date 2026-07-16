import { describe, it, expect } from "vitest";
import { NoOpAiAdapter, ResilientAiAdapter } from "../src/ai/boundary.js";

describe("AI boundary", () => {
  it("NoOp classify returns deterministic label by overlap", async () => {
    const ai = new NoOpAiAdapter();
    const r = await ai.classify({ text: "best espresso machines reviews", candidateLabels: ["coffee", "shoes", "espresso"] });
    expect(r.label).toBe("espresso");
    expect(r.confidence).toBeGreaterThan(0);
  });

  it("NoOp draft returns variants", async () => {
    const ai = new NoOpAiAdapter();
    const r = await ai.draft({ task: "outreach_subject", context: { brandName: "X" }, constraints: { variants: 3 } });
    expect(r.variants.length).toBe(3);
    expect(r.verification).toBe("INFERRED");
  });

  it("NoOp explainRelevance returns similarity", async () => {
    const ai = new NoOpAiAdapter();
    const r = await ai.explainRelevance({ targetTopic: "affiliate marketing", candidateTopic: "affiliate marketing strategy" });
    expect(r.similarity).toBeGreaterThan(0);
    expect(r.reason).toContain("overlap");
  });

  it("ResilientAiAdapter falls back to NoOp when inner throws", async () => {
    const failing: any = {
      meta: new NoOpAiAdapter().meta,
      async classify() {
        throw new Error("down");
      },
      async draft() {
        throw new Error("down");
      },
      async explainRelevance() {
        throw new Error("down");
      }
    };
    const resilient = new ResilientAiAdapter(failing);
    const r = await resilient.classify({ text: "x", candidateLabels: ["a"] });
    expect(r.label).toBe("a");
  });
});
