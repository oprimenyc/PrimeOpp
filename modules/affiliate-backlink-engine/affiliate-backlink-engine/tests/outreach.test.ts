import { describe, it, expect } from "vitest";
import { personalizeOutreach, supplyManualContact, discoverContacts } from "../src/outreach/index.js";
import { InMemoryEvidenceStore } from "../src/domain/evidence.js";
import { BrokenLinkOpportunity } from "../src/domain/opportunity.js";
import { TargetPage } from "../src/domain/site.js";
import { NoOpAiAdapter } from "../src/ai/boundary.js";

const opp: BrokenLinkOpportunity = {
  id: "opp_1",
  siteProfileId: "s1",
  kind: "broken_link",
  dedupKey: "broken_link::x::y",
  verification: "DISCOVERED",
  evidenceIds: ["evd_1"],
  brokenDestinationUrl: "https://dead.example/old",
  anchorText: "seamless panties FAQ",
  existingContentSuitable: false,
  contentUpdateRequired: true,
  riskFlags: [],
  discoveredAt: 1
};

const targetPage: TargetPage = {
  id: "page_1",
  siteProfileId: "s1",
  url: "https://target.example/best-seamless-panties",
  canonicalUrl: "https://target.example/best-seamless-panties",
  title: "Best Seamless Panties",
  contentType: "listicle",
  topic: "seamless panties",
  commercialIntent: "commercial_investigation",
  indexability: "indexable",
  priority: 80,
  verification: "DISCOVERED"
};

describe("outreach personalization", () => {
  it("generates a structured brief with facts/inferences/unknowns", async () => {
    const store = new InMemoryEvidenceStore();
    const r = await personalizeOutreach({
      siteProfileId: "s1",
      opportunity: opp,
      matchedTargetPage: targetPage,
      evidence: store.all(),
      brandName: "PantiCandy",
      ai: new NoOpAiAdapter(),
      now: 1000
    });
    expect(r.brief.outreachReason).toContain("broken");
    expect(r.brief.factInferenceUnknown.facts.length).toBeGreaterThan(0);
    expect(r.brief.factInferenceUnknown.unknowns.length).toBeGreaterThan(0);
    expect(r.brief.draftVariants.length).toBeGreaterThan(0);
    expect(r.brief.followUpStrategy).toBeDefined();
    expect(r.prospect.personalizationConfidence).toBeGreaterThanOrEqual(0);
    expect(r.prospect.personalizationConfidence).toBeLessThanOrEqual(1);
  });

  it("distinguishes observed vs inferred personalization", async () => {
    const store = new InMemoryEvidenceStore();
    const contact = supplyManualContact("https://src.example/p1", { name: "Jane Editor", email: "jane@src.example", role: "Editor" }, { recordEvidence: (e) => store.record(e) });
    const r = await personalizeOutreach({
      siteProfileId: "s1",
      opportunity: opp,
      matchedTargetPage: targetPage,
      contact,
      evidence: store.all(),
      brandName: "PantiCandy",
      ai: new NoOpAiAdapter()
    });
    expect(r.brief.personalizedContext.basis).toBe("observed");
  });

  it("marks do-not-contact when contact is DNC", async () => {
    const store = new InMemoryEvidenceStore();
    const contact = supplyManualContact(
      "https://src.example/p1",
      { name: "DNC Person", email: "dnc@src.example" },
      { recordEvidence: (e) => store.record(e), doNotContact: new Set(["dnc@src.example"]) }
    );
    const r = await personalizeOutreach({
      siteProfileId: "s1",
      opportunity: opp,
      matchedTargetPage: targetPage,
      contact,
      evidence: store.all(),
      brandName: "PantiCandy",
      ai: new NoOpAiAdapter()
    });
    expect(r.brief.doNotContact).toBe(true);
  });

  it("never invents contact details when none supplied", async () => {
    const store = new InMemoryEvidenceStore();
    const r = await personalizeOutreach({
      siteProfileId: "s1",
      opportunity: opp,
      evidence: store.all(),
      brandName: "PantiCandy",
      ai: new NoOpAiAdapter()
    });
    expect(r.brief.factInferenceUnknown.unknowns).toContain("Contact name is unknown.");
    expect(r.brief.factInferenceUnknown.unknowns).toContain("Contact email or form URL is unknown.");
  });

  it("falls back to deterministic drafts when AI fails", async () => {
    const store = new InMemoryEvidenceStore();
    const failingAi: any = {
      meta: new NoOpAiAdapter().meta,
      async draft() {
        throw new Error("LLM down");
      }
    };
    const r = await personalizeOutreach({
      siteProfileId: "s1",
      opportunity: opp,
      matchedTargetPage: targetPage,
      evidence: store.all(),
      brandName: "PantiCandy",
      ai: failingAi
    });
    expect(r.brief.draftVariants.length).toBeGreaterThan(0);
  });

  it("discoverContacts returns empty when no adapter configured", async () => {
    const store = new InMemoryEvidenceStore();
    const r = await discoverContacts(undefined, "https://x.example", { recordEvidence: (e) => store.record(e) });
    expect(r.candidates.length).toBe(0);
    expect(r.skipped.length).toBe(1);
  });

  it("discoverContacts applies DNC list", async () => {
    const store = new InMemoryEvidenceStore();
    const adapter: any = {
      meta: new NoOpAiAdapter().meta,
      async discoverContacts() {
        return {
          data: [{ ref: "https://x.example", name: "X", email: "dnc@x.example" }],
          provenance: { adapter: "fixture", providerKind: "import", version: "1.0.0" },
          confidence: { dataConfidence: 1, reason: "fixture" }
        };
      }
    };
    const r = await discoverContacts(adapter, "https://x.example", {
      recordEvidence: (e) => store.record(e),
      doNotContact: new Set(["dnc@x.example"])
    });
    expect(r.candidates[0].doNotContact).toBe(true);
  });
});
