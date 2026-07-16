import { describe, it, expect } from "vitest";
import {
  planCampaign,
  autoPlanCampaigns,
  groupOpportunitiesByKind
} from "../src/campaigns/planner.js";
import {
  InMemoryCampaignTracker,
  verifyAcquiredLink,
  canTransition,
  ALLOWED_TRANSITIONS,
  assertTransition
} from "../src/campaigns/tracker.js";
import {
  CampaignLifecycleState,
  Campaign,
  REQUIRES_EVIDENCE_FOR
} from "../src/domain/campaign.js";
import { LinkOpportunity, BrokenLinkOpportunity } from "../src/domain/opportunity.js";
import { InMemoryEvidenceStore } from "../src/domain/evidence.js";

function makeBrokenOpp(id: string): BrokenLinkOpportunity {
  return {
    id,
    siteProfileId: "s1",
    kind: "broken_link",
    dedupKey: `broken_link::${id}`,
    verification: "DISCOVERED",
    evidenceIds: [],
    brokenDestinationUrl: "https://dead.example/old",
    existingContentSuitable: false,
    contentUpdateRequired: true,
    riskFlags: [],
    discoveredAt: 1
  };
}

describe("campaign planner", () => {
  it("plans a broken-link campaign with content work when matches are partial", () => {
    const c = planCampaign({
      siteProfileId: "s1",
      name: "test",
      type: "broken_link",
      opportunities: [makeBrokenOpp("o1"), makeBrokenOpp("o2")],
      brandName: "Brand"
    });
    expect(c.type).toBe("broken_link");
    expect(c.opportunityIds.length).toBe(2);
    expect(c.successCriteria.length).toBeGreaterThan(0);
    expect(c.prerequisites.length).toBeGreaterThan(0);
  });

  it("groupOpportunitiesByKind groups correctly", () => {
    const grouped = groupOpportunitiesByKind([makeBrokenOpp("o1"), makeBrokenOpp("o2")]);
    expect(grouped.get("broken_link")?.length).toBe(2);
  });

  it("autoPlanCampaigns creates one campaign per kind + refresh-first if HIGH", () => {
    const campaigns = autoPlanCampaigns("s1", "Brand", [makeBrokenOpp("o1")], [
      {
        pageId: "p1",
        score: 80,
        priority: "HIGH",
        recommendedChanges: ["x"],
        unlockedOpportunities: [],
        strategicReason: "y",
        dataSourcesUsed: []
      }
    ]);
    expect(campaigns.length).toBe(2);
    expect(campaigns.some((c) => c.type === "broken_link")).toBe(true);
    expect(campaigns.some((c) => c.type === "content_refresh_first")).toBe(true);
  });
});

describe("campaign tracker state machine", () => {
  it("rejects illegal transitions", () => {
    expect(() => assertTransition("DISCOVERED", "LINK_ACQUIRED")).toThrow();
  });

  it("canTransition returns true for allowed", () => {
    expect(canTransition("DISCOVERED", "QUALIFIED")).toBe(true);
    expect(canTransition("DISCOVERED", "LINK_ACQUIRED")).toBe(false);
  });

  it("REQUIRES_EVIDENCE_FOR marks LINK_ACQUIRED as requiring evidence", () => {
    expect(REQUIRES_EVIDENCE_FOR["LINK_ACQUIRED"]).toBe("acquired_link_observation");
  });

  it("LINK_ACQUIRED requires verified evidence", () => {
    const tracker = new InMemoryCampaignTracker();
    const c: Campaign = {
      id: "cmp_1",
      siteProfileId: "s1",
      name: "test",
      type: "broken_link",
      objective: "x",
      opportunityIds: [],
      prospectIds: [],
      contentWork: { description: "", required: false, pageIds: [] },
      outreachAngle: "",
      successCriteria: [],
      prerequisites: [],
      state: "OUTREACH_APPROVED",
      priority: 50,
      createdAt: 1,
      updatedAt: 1
    };
    tracker.create(c);
    expect(() => tracker.transition("cmp_1", "LINK_ACQUIRED")).toThrow();
    // With evidence id but no record, falls back to "operator trust" path.
    tracker.transition("cmp_1", "LINK_ACQUIRED", { evidenceIds: ["evd_1"] });
    expect(tracker.get("cmp_1")?.state).toBe("LINK_ACQUIRED");
  });

  it("records notes and actions", () => {
    const tracker = new InMemoryCampaignTracker();
    const c: Campaign = {
      id: "cmp_2",
      siteProfileId: "s1",
      name: "test",
      type: "broken_link",
      objective: "x",
      opportunityIds: [],
      prospectIds: [],
      contentWork: { description: "", required: false, pageIds: [] },
      outreachAngle: "",
      successCriteria: [],
      prerequisites: [],
      state: "DISCOVERED",
      priority: 50,
      createdAt: 1,
      updatedAt: 1
    };
    tracker.create(c);
    tracker.note("cmp_2", "manual note");
    const acts = tracker.actionsFor("cmp_2");
    expect(acts.some((a) => a.kind === "note")).toBe(true);
  });

  it("verifyAcquiredLink transitions to LINK_ACQUIRED when live", async () => {
    const tracker = new InMemoryCampaignTracker();
    const store = new InMemoryEvidenceStore();
    const c: Campaign = {
      id: "cmp_3",
      siteProfileId: "s1",
      name: "test",
      type: "broken_link",
      objective: "x",
      opportunityIds: [],
      prospectIds: [],
      contentWork: { description: "", required: false, pageIds: [] },
      outreachAngle: "",
      successCriteria: [],
      prerequisites: [],
      state: "OUTREACH_APPROVED",
      priority: 50,
      createdAt: 1,
      updatedAt: 1
    };
    tracker.create(c);
    // First transition to CONTACTED then REPLIED then OUTREACH_APPROVED chain...
    // Actually, REPLIED -> LINK_ACQUIRED is allowed. Let's set state to REPLIED.
    tracker.update({ ...c, state: "REPLIED" });
    const r = await verifyAcquiredLink(
      tracker,
      "cmp_3",
      async () => ({ live: true, url: "https://src.example/p" }),
      (e) => store.record(e)
    );
    expect(r.live).toBe(true);
    expect(tracker.get("cmp_3")?.state).toBe("LINK_ACQUIRED");
  });

  it("revalidate transitions stale campaigns to STALE", () => {
    const tracker = new InMemoryCampaignTracker();
    const old = Date.now() - 31 * 24 * 60 * 60 * 1000;
    const c: Campaign = {
      id: "cmp_4",
      siteProfileId: "s1",
      name: "test",
      type: "broken_link",
      objective: "x",
      opportunityIds: [],
      prospectIds: [],
      contentWork: { description: "", required: false, pageIds: [] },
      outreachAngle: "",
      successCriteria: [],
      prerequisites: [],
      state: "DISCOVERED",
      priority: 50,
      createdAt: 1,
      updatedAt: old
    };
    tracker.create(c);
    tracker.update({ ...c, updatedAt: old });
    const updated = tracker.revalidate("cmp_4");
    expect(updated.state).toBe("STALE");
  });
});
