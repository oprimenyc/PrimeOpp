import { describe, it, expect } from "vitest";
import {
  InMemoryEvidenceStore,
  makeEvidence,
  canonicalPayloadHash
} from "../src/domain/evidence.js";

describe("evidence store", () => {
  it("records and retrieves by subjectId", () => {
    const store = new InMemoryEvidenceStore();
    const ev = store.record({
      kind: "page_observation",
      subjectId: "page_1",
      claim: "Page observed",
      observedAt: 1000,
      source: { adapter: "fixture" },
      verification: "DISCOVERED"
    });
    expect(ev.id).toMatch(/^evd_/);
    expect(store.for("page_1").length).toBe(1);
    expect(store.all().length).toBe(1);
  });

  it("makeEvidence produces deterministic id", () => {
    const a = makeEvidence({
      kind: "page_observation",
      subjectId: "page_1",
      claim: "Page observed",
      observedAt: 1000,
      source: { adapter: "fixture" },
      verification: "DISCOVERED"
    });
    const b = makeEvidence({
      kind: "page_observation",
      subjectId: "page_1",
      claim: "Page observed",
      observedAt: 1000,
      source: { adapter: "fixture" },
      verification: "DISCOVERED"
    });
    expect(a.id).toBe(b.id);
  });

  it("latest returns the most recent by observedAt", () => {
    const store = new InMemoryEvidenceStore();
    store.record({
      kind: "page_observation",
      subjectId: "page_1",
      claim: "old",
      observedAt: 1000,
      source: { adapter: "fixture" },
      verification: "DISCOVERED"
    });
    store.record({
      kind: "page_observation",
      subjectId: "page_1",
      claim: "new",
      observedAt: 2000,
      source: { adapter: "fixture" },
      verification: "VERIFIED"
    });
    const l = store.latest("page_1");
    expect(l?.claim).toBe("new");
  });

  it("latest can filter by kind", () => {
    const store = new InMemoryEvidenceStore();
    store.record({
      kind: "page_observation",
      subjectId: "page_1",
      claim: "obs",
      observedAt: 1000,
      source: { adapter: "fixture" },
      verification: "DISCOVERED"
    });
    store.record({
      kind: "broken_link_observation",
      subjectId: "page_1",
      claim: "brk",
      observedAt: 2000,
      source: { adapter: "fixture" },
      verification: "DISCOVERED"
    });
    expect(store.latest("page_1", "broken_link_observation")?.claim).toBe("brk");
    expect(store.latest("page_1", "page_observation")?.claim).toBe("obs");
  });

  it("canonicalPayloadHash is stable for equivalent payloads", () => {
    const a = canonicalPayloadHash({ a: 1, b: [1, 2, 3], c: { d: "x" } });
    const b = canonicalPayloadHash({ b: [1, 2, 3], c: { d: "x" }, a: 1 });
    expect(a).toBe(b);
  });

  it("canonicalPayloadHash differs for different payloads", () => {
    const a = canonicalPayloadHash({ a: 1 });
    const b = canonicalPayloadHash({ a: 2 });
    expect(a).not.toBe(b);
  });

  it("records carry source/provenance", () => {
    const store = new InMemoryEvidenceStore();
    const ev = store.record({
      kind: "page_observation",
      subjectId: "page_1",
      claim: "Page observed",
      observedAt: 1000,
      source: { adapter: "ahrefs", providerKind: "seo", reference: "fixture.json", fetchedAt: 999 },
      verification: "DISCOVERED"
    });
    expect(ev.source.adapter).toBe("ahrefs");
    expect(ev.source.providerKind).toBe("seo");
  });
});
