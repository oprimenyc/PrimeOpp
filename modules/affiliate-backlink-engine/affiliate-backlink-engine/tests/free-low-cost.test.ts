import { describe, it, expect } from "vitest";
import { buildDataStack, ManualVerificationQueue, TIER_DESCRIPTIONS } from "../src/adapters/free-low-cost.js";
import { FixtureAdapter, NoOpAiAdapter } from "../src/index.js";

describe("free/low-cost data path", () => {
  it("builds a free-only stack by default", () => {
    const stack = buildDataStack();
    expect(stack.activeTier).toBe("free_local");
    expect(stack.adapter.meta.offline).toBe(true);
    expect(stack.ai).toBeDefined();
  });

  it("upgrades to low_cost_api when a free search adapter is supplied", () => {
    const freeAdapter = new FixtureAdapter({});
    const stack = buildDataStack({ freeSearchAdapter: freeAdapter });
    expect(stack.activeTier).toBe("low_cost_api");
  });

  it("upgrades to premium_provider when enabled + supplied", () => {
    const premiumAdapter = new FixtureAdapter({});
    const stack = buildDataStack({ premiumSeoAdapter: premiumAdapter, enablePremium: true });
    expect(stack.activeTier).toBe("premium_provider");
  });

  it("does NOT enable premium when enablePremium is false even if adapter supplied", () => {
    const premiumAdapter = new FixtureAdapter({});
    const stack = buildDataStack({ premiumSeoAdapter: premiumAdapter, enablePremium: false });
    expect(stack.activeTier).toBe("free_local");
  });

  it("tiers are documented with capabilities and confidence", () => {
    expect(TIER_DESCRIPTIONS.length).toBe(3);
    expect(TIER_DESCRIPTIONS[0].tier).toBe("free_local");
    expect(TIER_DESCRIPTIONS[0].requiresNetwork).toBe(false);
    expect(TIER_DESCRIPTIONS[2].tier).toBe("premium_provider");
    expect(TIER_DESCRIPTIONS[2].requiresApiKey).toBe(true);
  });

  it("ManualVerificationQueue enqueues and lists", () => {
    const q = new ManualVerificationQueue();
    const item = q.enqueue({ subjectId: "opp_1", claim: "x", reason: "y", suggestedAction: "verify manually" });
    expect(item.id).toMatch(/^mvq_/);
    expect(q.list().length).toBe(1);
    q.clear("opp_1");
    expect(q.list().length).toBe(0);
  });
});
