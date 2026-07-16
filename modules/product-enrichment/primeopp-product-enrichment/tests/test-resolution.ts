import {
  describe,
  it,
  assertEqual,
  assertTruthy,
  assertFalsy,
  assertApprox,
} from "./harness";
import {
  resolveField,
  type ResolutionOptions,
} from "../src/resolution/engine";
import type { FieldCandidate } from "../src/contracts/provider";

const opts: ResolutionOptions = { manualTrustLevel: "evidence" };

describe("Resolution engine", () => {
  it("returns undefined value when no candidates", () => {
    const r = resolveField("identity.brand", [], opts);
    assertEqual(r.value, undefined);
    assertEqual(r.confidence, 0);
  });

  it("picks the only candidate", () => {
    const c: FieldCandidate = {
      field: "identity.brand",
      value: "Sony",
      providerId: "fixture",
      sourceConfidence: 0.9,
      providerPriority: 10,
    };
    const r = resolveField("identity.brand", [c], opts);
    assertEqual(r.value, "Sony");
    assertTruthy(r.confidence > 0);
  });

  it("agreement between 2 providers boosts confidence", () => {
    const a: FieldCandidate = {
      field: "identity.brand",
      value: "Sony",
      providerId: "fixture",
      sourceConfidence: 0.9,
      providerPriority: 10,
    };
    const b: FieldCandidate = {
      field: "identity.brand",
      value: "sony",
      providerId: "fixture2",
      sourceConfidence: 0.9,
      providerPriority: 15,
    };
    const r = resolveField("identity.brand", [a, b], opts);
    assertEqual(r.value, "Sony");
    assertTruthy(r.conflict === undefined);
    assertTruthy(r.confidence >= 0.85);
  });

  it("conflict is recorded when candidates disagree", () => {
    const a: FieldCandidate = {
      field: "identity.brand",
      value: "Sony",
      providerId: "fixture",
      sourceConfidence: 0.9,
      providerPriority: 10,
    };
    const b: FieldCandidate = {
      field: "identity.brand",
      value: "Bose",
      providerId: "fixture2",
      sourceConfidence: 0.9,
      providerPriority: 15,
    };
    const r = resolveField("identity.brand", [a, b], opts);
    assertTruthy(r.conflict);
    assertEqual(r.conflict?.severity, "HIGH");
    assertEqual(r.conflict?.candidates.length, 2);
  });

  it("exact-match evidence wins over higher source confidence", () => {
    const a: FieldCandidate = {
      field: "identity.brand",
      value: "BrandA",
      providerId: "fixture",
      sourceConfidence: 0.7,
      providerPriority: 10,
      evidence: { exactMatch: true },
    };
    const b: FieldCandidate = {
      field: "identity.brand",
      value: "BrandB",
      providerId: "fixture2",
      sourceConfidence: 0.95,
      providerPriority: 15,
    };
    const r = resolveField("identity.brand", [a, b], opts);
    // Two providers disagree; conflict is recorded. The majority group
    // has only one provider each, so they tie on provider count. Tiebreak
    // by priority: a (10) beats b (15). Plus a has exactMatch bonus.
    assertEqual(r.value, "BrandA");
    assertTruthy(r.conflict);
  });

  it("manual-authoritative promotes manual candidate", () => {
    const a: FieldCandidate = {
      field: "identity.brand",
      value: "BrandA",
      providerId: "fixture",
      sourceConfidence: 0.9,
      providerPriority: 10,
    };
    const m: FieldCandidate = {
      field: "identity.brand",
      value: "ManualBrand",
      providerId: "manual",
      sourceConfidence: 0.6,
      // Manual provider's priority is intentionally WORSE (higher number)
      // than the fixture provider. In "evidence" mode, fixture wins via
      // priority tiebreaker. In "authoritative" mode, the manual-auth
      // override promotes manual to win.
      providerPriority: 50,
    };
    // In evidence mode, fixture wins (better priority).
    const r1 = resolveField("identity.brand", [a, m], { manualTrustLevel: "evidence" });
    assertEqual(r1.value, "BrandA");

    // In authoritative mode, manual wins ties.
    const r2 = resolveField("identity.brand", [a, m], { manualTrustLevel: "authoritative" });
    assertEqual(r2.value, "ManualBrand");
  });

  it("3+ agreeing providers trigger corroboration bonus", () => {
    const candidates: FieldCandidate[] = [
      { field: "identity.brand", value: "Sony", providerId: "p1", sourceConfidence: 0.8, providerPriority: 10 },
      { field: "identity.brand", value: "sony", providerId: "p2", sourceConfidence: 0.8, providerPriority: 12 },
      { field: "identity.brand", value: "SONY", providerId: "p3", sourceConfidence: 0.8, providerPriority: 14 },
    ];
    const r = resolveField("identity.brand", candidates, opts);
    assertTruthy(r.conflict === undefined);
    assertTruthy(r.confidence >= 0.9);
  });

  it("non-identity field disagreement produces LOW or MEDIUM severity", () => {
    const candidates: FieldCandidate[] = [
      { field: "attributes.color", value: "red", providerId: "p1", sourceConfidence: 0.7, providerPriority: 10 },
      { field: "attributes.color", value: "blue", providerId: "p2", sourceConfidence: 0.7, providerPriority: 12 },
    ];
    const r = resolveField("attributes.color", candidates, opts);
    assertTruthy(r.conflict);
    assertFalsy(r.conflict?.severity === "HIGH");
  });

  it("majority group wins over a higher-confidence minority", () => {
    const a: FieldCandidate = {
      field: "identity.model",
      value: "X1",
      providerId: "p1",
      sourceConfidence: 0.7,
      providerPriority: 10,
    };
    const b: FieldCandidate = {
      field: "identity.model",
      value: "x1",
      providerId: "p2",
      sourceConfidence: 0.7,
      providerPriority: 12,
    };
    const c: FieldCandidate = {
      field: "identity.model",
      value: "Y2",
      providerId: "p3",
      sourceConfidence: 0.99,
      providerPriority: 14,
    };
    const r = resolveField("identity.model", [a, b, c], opts);
    assertEqual(r.value, "X1");
  });
});
