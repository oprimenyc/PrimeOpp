import {
  describe,
  it,
  assertEqual,
  assertTruthy,
  assertIncludes,
} from "./harness";
import {
  computeCompleteness,
  DEFAULT_IMPORTANT_FIELDS,
} from "../src/confidence/completeness";
import type { EnrichedProductProfile } from "../src/contracts/output";

function makeProfile(overrides: Partial<EnrichedProductProfile>): EnrichedProductProfile {
  return {
    enrichmentId: "test",
    intakeId: undefined,
    identifiers: {},
    identity: {},
    classification: {},
    attributes: {},
    media: { images: [] },
    sources: [],
    conflicts: [],
    confidence: { overall: 0, fieldScores: {} },
    completeness: { score: 0, missingFields: [] },
    status: "ENRICHED",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Completeness engine", () => {
  it("default fields include brand, title, category, description, identifiers, images", () => {
    assertIncludes(DEFAULT_IMPORTANT_FIELDS, "identity.brand");
    assertIncludes(DEFAULT_IMPORTANT_FIELDS, "identity.canonicalTitle");
    assertIncludes(DEFAULT_IMPORTANT_FIELDS, "classification.category");
    assertIncludes(DEFAULT_IMPORTANT_FIELDS, "description");
    assertIncludes(DEFAULT_IMPORTANT_FIELDS, "identifiers.any");
    assertIncludes(DEFAULT_IMPORTANT_FIELDS, "media.images");
  });

  it("empty profile: score 0, all missing", () => {
    const r = computeCompleteness(makeProfile({}));
    assertEqual(r.score, 0);
    assertEqual(r.missingFields.length, DEFAULT_IMPORTANT_FIELDS.length);
  });

  it("full profile: score 1, no missing", () => {
    const r = computeCompleteness(
      makeProfile({
        identity: { canonicalTitle: "Foo", brand: "Bar", model: "M1" },
        classification: { category: "Cat" },
        description: "Desc",
        identifiers: { gtin: ["123"] },
        media: { images: [{ url: "https://example.com/a.jpg", sourceProviderId: "p" }] },
      })
    );
    assertEqual(r.score, 1);
    assertEqual(r.missingFields.length, 0);
  });

  it("modelOrMpn accepts MPN as substitute for model", () => {
    const r = computeCompleteness(
      makeProfile({
        identity: { canonicalTitle: "Foo", brand: "Bar" },
        classification: { category: "Cat" },
        description: "Desc",
        identifiers: { mpn: ["MPN-1"] },
        media: { images: [{ url: "https://example.com/a.jpg", sourceProviderId: "p" }] },
      })
    );
    assertTruthy(!r.missingFields.includes("identity.modelOrMpn"));
  });

  it("custom important fields override defaults", () => {
    const r = computeCompleteness(
      makeProfile({ identity: { brand: "B" } }),
      ["identity.brand"]
    );
    assertEqual(r.score, 1);
    assertEqual(r.missingFields.length, 0);
  });

  it("partial profile produces partial score", () => {
    const r = computeCompleteness(
      makeProfile({
        identity: { canonicalTitle: "Foo" },
        classification: { category: "Cat" },
      })
    );
    assertTruthy(r.score > 0 && r.score < 1);
    assertTruthy(r.missingFields.includes("identity.brand"));
    assertTruthy(r.missingFields.includes("description"));
  });
});
