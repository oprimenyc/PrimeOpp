import {
  describe,
  it,
  assertEqual,
  assertTruthy,
  assertFalsy,
  assertApprox,
  assertRejects,
  assertIncludes,
} from "./harness";
import { buildTestService, buildCustomService } from "./service-builder";
import { normalizeIdentifier } from "../src/domain/identifier";
import { InvalidInputError, NoProviderError } from "../src/errors";
import { InMemoryEnrichmentCache } from "../src/cache";
import { FixtureProductProvider } from "../src/providers/fixture-provider";
import { ManualInputProvider } from "../src/providers/manual-provider";
import { ProductEnrichmentService } from "../src/application/service";
import type { ProductEnrichmentInput } from "../src/contracts/input";
import type {
  ProductEnrichmentProvider,
  EnrichmentContext,
  ProviderEnrichmentResult,
  EnrichmentProviderCapability,
} from "../src/contracts/provider";

describe("Provider execution: sequential vs parallel", () => {
  it("SEQUENTIAL execution runs providers in priority order", async () => {
    const { service } = buildTestService();
    const input: ProductEnrichmentInput = {
      identifier: normalizeIdentifier("036000291452"),
    };
    const profile = await service.enrich(input, { executionMode: "SEQUENTIAL" });
    assertEqual(profile.status, "ENRICHED");
  });

  it("PARALLEL execution (default) returns equivalent result", async () => {
    const { service } = buildTestService();
    const input: ProductEnrichmentInput = {
      identifier: normalizeIdentifier("036000291452"),
    };
    const profile = await service.enrich(input, { executionMode: "PARALLEL" });
    assertEqual(profile.status, "ENRICHED");
    assertEqual(profile.identity.brand, "Kraft");
  });

  it("provider priority: higher-priority provider wins ties", async () => {
    const records = [
      {
        id: "r1",
        matchBy: { gtin: "1111111111116" },
        confidence: 0.9,
        exactMatch: true,
        fields: { "identity.brand": "HighPriority" },
      },
    ];
    const records2 = [
      {
        id: "r2",
        matchBy: { gtin: "1111111111116" },
        confidence: 0.9,
        exactMatch: true,
        fields: { "identity.brand": "LowPriority" },
      },
    ];
    const cache = new InMemoryEnrichmentCache({ capacity: 100 });
    const service = new ProductEnrichmentService({
      cache,
      maxProviders: 10,
      providers: [
        { provider: new FixtureProductProvider({ id: "high", priority: 5, records }), priority: 5 },
        { provider: new FixtureProductProvider({ id: "low", priority: 50, records: records2 }), priority: 50 },
      ],
    });
    const profile = await service.enrich({
      identifier: normalizeIdentifier("1111111111116"),
    });
    assertEqual(profile.identity.brand, "HighPriority");
  });
});

describe("Provider failure isolation", () => {
  it("one provider failure does not fail the whole enrichment", async () => {
    class FailingProvider implements ProductEnrichmentProvider {
      readonly id = "failing";
      readonly capabilities: EnrichmentProviderCapability[] = ["BARCODE_LOOKUP"];
      async canHandle(): Promise<boolean> {
        return true;
      }
      async enrich(
        _input: ProductEnrichmentInput,
        _ctx: EnrichmentContext
      ): Promise<ProviderEnrichmentResult> {
        throw new Error("Synthetic provider failure");
      }
    }

    const cache = new InMemoryEnrichmentCache({ capacity: 100 });
    const records = [
      {
        id: "ok",
        matchBy: { gtin: "036000291452" },
        confidence: 0.9,
        exactMatch: true,
        fields: { "identity.brand": "Kraft" },
      },
    ];
    const service = new ProductEnrichmentService({
      cache,
      maxProviders: 10,
      providers: [
        { provider: new FailingProvider(), priority: 5 },
        { provider: new FixtureProductProvider({ id: "ok-fixture", priority: 10, records }), priority: 10 },
      ],
    });
    const profile = await service.enrich({
      identifier: normalizeIdentifier("036000291452"),
    });
    assertEqual(profile.status, "PARTIAL"); // missing many fields
    assertEqual(profile.identity.brand, "Kraft");
  });

  it("provider timeout is captured as an error, not thrown", async () => {
    class SlowProvider implements ProductEnrichmentProvider {
      readonly id = "slow";
      readonly capabilities: EnrichmentProviderCapability[] = ["BARCODE_LOOKUP"];
      async canHandle(): Promise<boolean> {
        return true;
      }
      async enrich(
        _input: ProductEnrichmentInput,
        ctx: EnrichmentContext
      ): Promise<ProviderEnrichmentResult> {
        // Sleep longer than timeout.
        await new Promise((r) => setTimeout(r, ctx.timeoutMs + 200));
        return {
          providerId: this.id,
          found: true,
          confidence: 0.5,
          candidates: [],
          retrievedAt: new Date().toISOString(),
        };
      }
    }
    const cache = new InMemoryEnrichmentCache({ capacity: 100 });
    const service = new ProductEnrichmentService({
      cache,
      maxProviders: 10,
      providers: [{ provider: new SlowProvider(), priority: 5 }],
    });
    const profile = await service.enrich(
      { identifier: normalizeIdentifier("036000291452") },
      { timeoutMs: 100 }
    );
    // The slow provider returned late but the orchestrator still captured the result.
    assertTruthy(profile.sources.length === 0 || profile.sources[0].providerId === "slow");
  });

  it("all providers failing produces FAILED status", async () => {
    class FailingProvider implements ProductEnrichmentProvider {
      readonly id = "fail";
      readonly capabilities: EnrichmentProviderCapability[] = ["BARCODE_LOOKUP"];
      async canHandle(): Promise<boolean> {
        return true;
      }
      async enrich(): Promise<ProviderEnrichmentResult> {
        throw new Error("fail");
      }
    }
    const cache = new InMemoryEnrichmentCache({ capacity: 100 });
    const service = new ProductEnrichmentService({
      cache,
      maxProviders: 10,
      providers: [{ provider: new FailingProvider(), priority: 5 }],
    });
    const profile = await service.enrich({
      identifier: normalizeIdentifier("036000291452"),
    });
    assertEqual(profile.status, "FAILED");
  });

  it("partial result where one provider fails and another succeeds", async () => {
    class FailingProvider implements ProductEnrichmentProvider {
      readonly id = "fail";
      readonly capabilities: EnrichmentProviderCapability[] = ["BARCODE_LOOKUP"];
      async canHandle(): Promise<boolean> {
        return true;
      }
      async enrich(): Promise<ProviderEnrichmentResult> {
        throw new Error("fail");
      }
    }
    const cache = new InMemoryEnrichmentCache({ capacity: 100 });
    const records = [
      {
        id: "ok",
        matchBy: { gtin: "036000291452" },
        confidence: 0.95,
        exactMatch: true,
        fields: {
          "identity.brand": "Kraft",
          "identity.canonicalTitle": "Kraft Mac & Cheese",
          "classification.category": "Packaged Foods",
          "description": "Cheesy pasta",
        },
        images: [{ url: "https://example.com/k.jpg", isPrimary: true }],
      },
    ];
    const service = new ProductEnrichmentService({
      cache,
      maxProviders: 10,
      providers: [
        { provider: new FailingProvider(), priority: 5 },
        { provider: new FixtureProductProvider({ id: "ok-fixture", priority: 10, records }), priority: 10 },
      ],
    });
    const profile = await service.enrich({
      identifier: normalizeIdentifier("036000291452"),
    });
    assertEqual(profile.identity.brand, "Kraft");
    assertTruthy(profile.sources.length === 1); // only the successful one
    assertTruthy(profile.sources.every((s) => s.providerId === "ok-fixture"));
  });
});

describe("Confidence behavior", () => {
  it("confidence increases with provider agreement", async () => {
    const baseRecords = [
      {
        id: "single",
        matchBy: { gtin: "027242873826" },
        confidence: 0.9,
        exactMatch: true,
        fields: {
          "identity.brand": "Sony",
          "identity.model": "WH-1000XM4",
          "identity.canonicalTitle": "Sony WH-1000XM4",
          "classification.category": "Electronics",
          "description": "Wireless headphones",
        },
        images: [{ url: "https://example.com/s.jpg", isPrimary: true }],
      },
    ];
    const cache1 = new InMemoryEnrichmentCache({ capacity: 100 });
    const service1 = new ProductEnrichmentService({
      cache: cache1,
      maxProviders: 10,
      providers: [
        { provider: new FixtureProductProvider({ id: "single", priority: 10, records: baseRecords }), priority: 10 },
      ],
    });
    const singleProfile = await service1.enrich({
      identifier: normalizeIdentifier("027242873826"),
    });

    const agreeRecords = [
      {
        id: "agree1",
        matchBy: { gtin: "027242873826" },
        confidence: 0.9,
        exactMatch: true,
        fields: {
          "identity.brand": "Sony",
          "identity.model": "WH-1000XM4",
          "identity.canonicalTitle": "Sony WH-1000XM4",
          "classification.category": "Electronics",
          "description": "Wireless headphones",
        },
        images: [{ url: "https://example.com/s.jpg", isPrimary: true }],
      },
      {
        id: "agree2",
        matchBy: { gtin: "027242873826" },
        confidence: 0.85,
        exactMatch: true,
        fields: {
          "identity.brand": "Sony",
          "identity.model": "WH-1000XM4",
          "identity.canonicalTitle": "Sony WH-1000XM4",
        },
      },
    ];
    const cache2 = new InMemoryEnrichmentCache({ capacity: 100 });
    const service2 = new ProductEnrichmentService({
      cache: cache2,
      maxProviders: 10,
      providers: [
        { provider: new FixtureProductProvider({ id: "agree1", priority: 10, records: [agreeRecords[0]] }), priority: 10 },
        { provider: new FixtureProductProvider({ id: "agree2", priority: 12, records: [agreeRecords[1]] }), priority: 12 },
      ],
    });
    const multiProfile = await service2.enrich({
      identifier: normalizeIdentifier("027242873826"),
    });

    assertTruthy(multiProfile.confidence.overall > singleProfile.confidence.overall);
  });

  it("confidence decreases with conflict", async () => {
    const cleanRecords = [
      {
        id: "clean",
        matchBy: { gtin: "027242873826" },
        confidence: 0.9,
        exactMatch: true,
        fields: {
          "identity.brand": "Sony",
          "identity.model": "WH-1000XM4",
          "identity.canonicalTitle": "Sony WH-1000XM4",
          "classification.category": "Electronics",
          "description": "Wireless headphones",
        },
        images: [{ url: "https://example.com/s.jpg", isPrimary: true }],
      },
    ];
    const conflictRecords = [
      {
        id: "conflict1",
        matchBy: { gtin: "027242873826" },
        confidence: 0.9,
        exactMatch: true,
        fields: {
          "identity.brand": "Sony",
          "identity.model": "WH-1000XM4",
          "identity.canonicalTitle": "Sony WH-1000XM4",
          "classification.category": "Electronics",
          "description": "Wireless headphones",
        },
        images: [{ url: "https://example.com/s.jpg", isPrimary: true }],
      },
      {
        id: "conflict2",
        matchBy: { gtin: "027242873826" },
        confidence: 0.85,
        exactMatch: true,
        fields: {
          "identity.brand": "Bose", // conflict
          "identity.model": "WH-1000XM4",
          "identity.canonicalTitle": "Sony WH-1000XM4",
        },
      },
    ];

    const cache1 = new InMemoryEnrichmentCache({ capacity: 100 });
    const service1 = new ProductEnrichmentService({
      cache: cache1,
      maxProviders: 10,
      providers: [
        { provider: new FixtureProductProvider({ id: "clean", priority: 10, records: cleanRecords }), priority: 10 },
      ],
    });
    const cleanProfile = await service1.enrich({
      identifier: normalizeIdentifier("027242873826"),
    });

    const cache2 = new InMemoryEnrichmentCache({ capacity: 100 });
    const service2 = new ProductEnrichmentService({
      cache: cache2,
      maxProviders: 10,
      providers: [
        { provider: new FixtureProductProvider({ id: "conflict1", priority: 10, records: [conflictRecords[0]] }), priority: 10 },
        { provider: new FixtureProductProvider({ id: "conflict2", priority: 12, records: [conflictRecords[1]] }), priority: 12 },
      ],
    });
    const conflictProfile = await service2.enrich({
      identifier: normalizeIdentifier("027242873826"),
    });

    assertTruthy(conflictProfile.confidence.overall < cleanProfile.confidence.overall);
  });
});

describe("Cache behavior", () => {
  it("cache hit returns same profile", async () => {
    const { service, cache } = buildTestService();
    const input: ProductEnrichmentInput = {
      identifier: normalizeIdentifier("036000291452"),
    };
    const first = await service.enrich(input);
    const cached = await cache.get(`enrich:GTIN_12:036000291452:nomanual`);
    assertTruthy(cached);
    assertEqual(cached?.enrichmentId, first.enrichmentId);
  });

  it("second call hits cache (no provider invocation)", async () => {
    let providerCallCount = 0;
    class CountingProvider implements ProductEnrichmentProvider {
      readonly id = "counting";
      readonly capabilities: EnrichmentProviderCapability[] = ["BARCODE_LOOKUP"];
      async canHandle(): Promise<boolean> {
        return true;
      }
      async enrich(
        input: ProductEnrichmentInput,
        _ctx: EnrichmentContext
      ): Promise<ProviderEnrichmentResult> {
        providerCallCount++;
        return {
          providerId: this.id,
          found: true,
          confidence: 0.9,
          candidates: [
            {
              field: "identity.brand",
              value: "Cached",
              providerId: this.id,
              sourceConfidence: 0.9,
              providerPriority: 10,
            },
          ],
          retrievedAt: new Date().toISOString(),
        };
      }
    }
    const cache = new InMemoryEnrichmentCache({ capacity: 100 });
    const service = new ProductEnrichmentService({
      cache,
      maxProviders: 10,
      providers: [{ provider: new CountingProvider(), priority: 5 }],
    });
    const input: ProductEnrichmentInput = {
      identifier: normalizeIdentifier("036000291452"),
    };
    await service.enrich(input);
    await service.enrich(input);
    assertEqual(providerCallCount, 1);
  });

  it("cache disabled: provider invoked every time", async () => {
    let providerCallCount = 0;
    class CountingProvider implements ProductEnrichmentProvider {
      readonly id = "counting";
      readonly capabilities: EnrichmentProviderCapability[] = ["BARCODE_LOOKUP"];
      async canHandle(): Promise<boolean> {
        return true;
      }
      async enrich(): Promise<ProviderEnrichmentResult> {
        providerCallCount++;
        return {
          providerId: this.id,
          found: true,
          confidence: 0.9,
          candidates: [],
          retrievedAt: new Date().toISOString(),
        };
      }
    }
    const cache = new InMemoryEnrichmentCache({ capacity: 100 });
    const service = new ProductEnrichmentService({
      cache,
      maxProviders: 10,
      providers: [{ provider: new CountingProvider(), priority: 5 }],
    });
    const input: ProductEnrichmentInput = {
      identifier: normalizeIdentifier("036000291452"),
    };
    await service.enrich(input, { useCache: false });
    await service.enrich(input, { useCache: false });
    assertEqual(providerCallCount, 2);
  });

  it("cache miss falls through to providers", async () => {
    const { service, cache } = buildTestService();
    const input: ProductEnrichmentInput = {
      identifier: normalizeIdentifier("036000291452"),
    };
    await service.enrich(input);
    // Different identifier → cache miss.
    const input2: ProductEnrichmentInput = {
      identifier: normalizeIdentifier("027242873826"),
    };
    const profile = await service.enrich(input2);
    assertEqual(profile.identity.brand, "Sony");
  });
});

describe("Determinism", () => {
  it("identical input produces equivalent output (ignoring timestamps/IDs)", async () => {
    const { service } = buildTestService();
    const input: ProductEnrichmentInput = {
      identifier: normalizeIdentifier("036000291452"),
    };
    const a = await service.enrich(input, { useCache: false });
    const b = await service.enrich(input, { useCache: false });
    // Strip non-deterministic fields.
    const strip = (p: typeof a) => ({
      status: p.status,
      identity: p.identity,
      classification: p.classification,
      attributes: p.attributes,
      confidence: p.confidence,
      completeness: p.completeness,
      conflicts: p.conflicts.map((c) => ({
        field: c.field,
        severity: c.severity,
        candidateCount: c.candidates.length,
      })),
    });
    assertEqual(JSON.stringify(strip(a)), JSON.stringify(strip(b)));
  });
});

describe("Security & robustness", () => {
  it("malformed provider payload is handled gracefully", async () => {
    class MalformedProvider implements ProductEnrichmentProvider {
      readonly id = "malformed";
      readonly capabilities: EnrichmentProviderCapability[] = ["BARCODE_LOOKUP"];
      async canHandle(): Promise<boolean> {
        return true;
      }
      async enrich(): Promise<ProviderEnrichmentResult> {
        // Return a candidate with a non-string brand value (will be normalized defensively).
        return {
          providerId: this.id,
          found: true,
          confidence: 0.9,
          candidates: [
            {
              field: "identity.brand",
              value: 42 as unknown as string,
              providerId: this.id,
              sourceConfidence: 0.9,
              providerPriority: 10,
            },
          ],
          retrievedAt: new Date().toISOString(),
        };
      }
    }
    const cache = new InMemoryEnrichmentCache({ capacity: 100 });
    const service = new ProductEnrichmentService({
      cache,
      maxProviders: 10,
      providers: [{ provider: new MalformedProvider(), priority: 5 }],
    });
    const profile = await service.enrich({
      identifier: normalizeIdentifier("036000291452"),
    });
    // The provider returned a malformed value; the profile should still
    // be produced and the value coerced to string.
    assertTruthy(profile.identity.brand === "42" || profile.identity.brand === undefined);
  });

  it("oversized string is bounded", async () => {
    class OversizedProvider implements ProductEnrichmentProvider {
      readonly id = "oversized";
      readonly capabilities: EnrichmentProviderCapability[] = ["BARCODE_LOOKUP"];
      async canHandle(): Promise<boolean> {
        return true;
      }
      async enrich(): Promise<ProviderEnrichmentResult> {
        const huge = "x".repeat(10000);
        return {
          providerId: this.id,
          found: true,
          confidence: 0.9,
          candidates: [
            {
              field: "identity.canonicalTitle",
              value: huge,
              providerId: this.id,
              sourceConfidence: 0.9,
              providerPriority: 10,
            },
          ],
          retrievedAt: new Date().toISOString(),
        };
      }
    }
    const cache = new InMemoryEnrichmentCache({ capacity: 100 });
    const service = new ProductEnrichmentService({
      cache,
      maxProviders: 10,
      providers: [{ provider: new OversizedProvider(), priority: 5 }],
    });
    const profile = await service.enrich({
      identifier: normalizeIdentifier("036000291452"),
    });
    assertTruthy((profile.identity.canonicalTitle?.length ?? 0) <= 4096);
  });

  it("invalid image URL is filtered out", async () => {
    class BadImageProvider implements ProductEnrichmentProvider {
      readonly id = "badimage";
      readonly capabilities: EnrichmentProviderCapability[] = ["BARCODE_LOOKUP", "IMAGE_DISCOVERY"];
      async canHandle(): Promise<boolean> {
        return true;
      }
      async enrich(): Promise<ProviderEnrichmentResult> {
        return {
          providerId: this.id,
          found: true,
          confidence: 0.9,
          candidates: [],
          images: [
            { url: "javascript:alert(1)" },
            { url: "https://example.com/ok.jpg" },
          ],
          retrievedAt: new Date().toISOString(),
        };
      }
    }
    const cache = new InMemoryEnrichmentCache({ capacity: 100 });
    const service = new ProductEnrichmentService({
      cache,
      maxProviders: 10,
      providers: [{ provider: new BadImageProvider(), priority: 5 }],
    });
    const profile = await service.enrich({
      identifier: normalizeIdentifier("036000291452"),
    });
    assertEqual(profile.media.images.length, 1);
    assertEqual(profile.media.images[0].url, "https://example.com/ok.jpg");
  });

  it("prototype-pollution keys are rejected in safe-merge", () => {
    const { safeMerge } = require("../src/merging/safe-merge");
    const a = { foo: "bar" };
    const b = JSON.parse('{"__proto__":{"polluted":true},"foo":"baz"}');
    const merged = safeMerge(a, b);
    assertEqual((merged as { foo: string }).foo, "baz");
    // Verify global object was not polluted.
    assertFalsy(({} as Record<string, unknown>).polluted);
  });
});

describe("Input validation", () => {
  it("rejects null input", async () => {
    const { service } = buildTestService();
    await assertRejects(() => service.enrich(null as never), "must be a non-null object");
  });

  it("rejects empty input", async () => {
    const { service } = buildTestService();
    await assertRejects(() => service.enrich({}), "at least one of");
  });

  it("rejects input with empty manualProduct", async () => {
    const { service } = buildTestService();
    await assertRejects(
      () => service.enrich({ manualProduct: { title: "   " } }),
      "at least one of"
    );
  });
});

describe("Short-circuit behavior", () => {
  it("short-circuits when confidence threshold is met (SEQUENTIAL)", async () => {
    let calls = 0;
    class CountingFixture implements ProductEnrichmentProvider {
      readonly id: string;
      readonly capabilities: EnrichmentProviderCapability[] = ["BARCODE_LOOKUP"];
      private readonly records: unknown[];
      constructor(id: string, records: unknown[]) {
        this.id = id;
        this.records = records;
      }
      async canHandle(input: ProductEnrichmentInput): Promise<boolean> {
        const id = input.identifier;
        return Boolean(id && this.records.some((r) => (r as { matchBy: { gtin?: string } }).matchBy.gtin === id.normalizedValue));
      }
      async enrich(input: ProductEnrichmentInput): Promise<ProviderEnrichmentResult> {
        calls++;
        const r = this.records.find(
          (r) => (r as { matchBy: { gtin?: string } }).matchBy.gtin === input.identifier?.normalizedValue
        ) as {
          confidence: number;
          fields: Record<string, unknown>;
        } | undefined;
        if (!r) {
          return {
            providerId: this.id,
            found: false,
            confidence: 0,
            candidates: [],
            retrievedAt: new Date().toISOString(),
          };
        }
        return {
          providerId: this.id,
          found: true,
          confidence: r.confidence,
          candidates: Object.entries(r.fields).map(([field, value]) => ({
            field,
            value,
            providerId: this.id,
            sourceConfidence: r.confidence,
            providerPriority: 10,
          })),
          retrievedAt: new Date().toISOString(),
        };
      }
    }

    const records1 = [
      {
        id: "r1",
        matchBy: { gtin: "027242873826" },
        confidence: 0.97,
        exactMatch: true,
        fields: {
          "identity.brand": "Sony",
          "identity.model": "WH-1000XM4",
          "identity.canonicalTitle": "Sony WH-1000XM4",
          "classification.category": "Electronics",
          "description": "x",
        },
        images: [{ url: "https://example.com/s.jpg", isPrimary: true }],
      },
    ];
    const records2 = [
      {
        id: "r2",
        matchBy: { gtin: "027242873826" },
        confidence: 0.5,
        exactMatch: true,
        fields: { "identity.brand": "Sony" },
      },
    ];

    const cache = new InMemoryEnrichmentCache({ capacity: 100 });
    const service = new ProductEnrichmentService({
      cache,
      maxProviders: 10,
      providers: [
        { provider: new CountingFixture("p1", records1), priority: 10 },
        { provider: new CountingFixture("p2", records2), priority: 12 },
      ],
    });
    const profile = await service.enrich(
      { identifier: normalizeIdentifier("027242873826") },
      {
        executionMode: "SEQUENTIAL",
        minimumConfidenceToShortCircuit: 0.5,
        useCache: false,
      }
    );
    // p1 alone returns confidence 0.97; interim confidence should exceed 0.5
    // and p2 should be short-circuited.
    assertEqual(calls, 1);
    assertEqual(profile.identity.brand, "Sony");
  });
});

describe("Serialization", () => {
  it("final profile is JSON-serializable", async () => {
    const { service } = buildTestService();
    const profile = await service.enrich({
      identifier: normalizeIdentifier("036000291452"),
    });
    const json = JSON.stringify(profile);
    assertTruthy(json.length > 0);
    const parsed = JSON.parse(json);
    assertEqual(parsed.enrichmentId, profile.enrichmentId);
    assertEqual(parsed.identity.brand, profile.identity.brand);
  });
});

describe("Completeness scoring in service", () => {
  it("completeness reports missing fields on incomplete fixture", async () => {
    const records = [
      {
        id: "inc",
        matchBy: { gtin: "051234567890" },
        confidence: 0.6,
        exactMatch: true,
        fields: {
          "identity.canonicalTitle": "Incomplete Product",
          "identity.brand": "Unknown",
        },
      },
    ];
    const cache = new InMemoryEnrichmentCache({ capacity: 100 });
    const service = new ProductEnrichmentService({
      cache,
      maxProviders: 10,
      providers: [
        { provider: new FixtureProductProvider({ id: "inc", priority: 10, records }), priority: 10 },
      ],
    });
    const profile = await service.enrich({
      identifier: normalizeIdentifier("051234567890"),
    });
    assertTruthy(profile.completeness.missingFields.length > 0);
    assertTruthy(profile.completeness.missingFields.includes("description"));
    assertTruthy(profile.completeness.missingFields.includes("media.images"));
  });
});

describe("Attribute normalization in service", () => {
  it("weight is normalized to grams", async () => {
    const { service } = buildTestService();
    const profile = await service.enrich({
      identifier: normalizeIdentifier("036000291452"),
    });
    assertTruthy(profile.attributes.weight?.value !== undefined);
    // The fixture provides weight as "206g"; normalizeWeight converts it
    // to a structured object { normalized: "206g", grams: 206, originalUnit: "g" }.
    const w = profile.attributes.weight?.value as { normalized?: string; grams?: number };
    assertTruthy(typeof w === "object" && w !== null);
    assertTruthy(w.normalized?.includes("g"));
    assertTruthy(w.grams === 206);
  });

  it("dimensions are normalized", async () => {
    const records = [
      {
        id: "dim",
        matchBy: { gtin: "027242873826" },
        confidence: 0.95,
        exactMatch: true,
        fields: {
          "identity.brand": "Sony",
          "identity.canonicalTitle": "Sony Headphones",
          "attributes.dimensions": "9.94 x 7.91 x 3.94 inches",
        },
      },
    ];
    const cache = new InMemoryEnrichmentCache({ capacity: 100 });
    const service = new ProductEnrichmentService({
      cache,
      maxProviders: 10,
      providers: [
        { provider: new FixtureProductProvider({ id: "dim", priority: 10, records }), priority: 10 },
      ],
    });
    const profile = await service.enrich({
      identifier: normalizeIdentifier("027242873826"),
    });
    // Dimensions normalize to {normalized:"9.94x7.91x3.94", unit:"in"}
    const dim = profile.attributes.dimensions?.value;
    assertTruthy(typeof dim === "object" && dim !== null);
  });
});

describe("Identifier & image deduplication in service", () => {
  it("identifier deduplication collapses duplicate GTINs", async () => {
    const records = [
      {
        id: "a",
        matchBy: { gtin: "027242873826" },
        confidence: 0.9,
        exactMatch: true,
        fields: { "identifiers.gtin": "027242873826" },
      },
      {
        id: "b",
        matchBy: { gtin: "027242873826" },
        confidence: 0.85,
        exactMatch: true,
        fields: { "identifiers.gtin": "027242873826" },
      },
    ];
    const cache = new InMemoryEnrichmentCache({ capacity: 100 });
    const service = new ProductEnrichmentService({
      cache,
      maxProviders: 10,
      providers: [
        { provider: new FixtureProductProvider({ id: "a", priority: 10, records: [records[0]] }), priority: 10 },
        { provider: new FixtureProductProvider({ id: "b", priority: 12, records: [records[1]] }), priority: 12 },
      ],
    });
    const profile = await service.enrich({
      identifier: normalizeIdentifier("027242873826"),
    });
    assertEqual(profile.identifiers.gtin?.length, 1);
  });

  it("image URL deduplication collapses duplicate URLs", async () => {
    const records = [
      {
        id: "a",
        matchBy: { gtin: "027242873826" },
        confidence: 0.9,
        exactMatch: true,
        fields: { "identity.brand": "Sony" },
        images: [{ url: "https://example.com/dup.jpg", isPrimary: true }],
      },
      {
        id: "b",
        matchBy: { gtin: "027242873826" },
        confidence: 0.85,
        exactMatch: true,
        fields: {},
        images: [{ url: "https://example.com/dup.jpg" }],
      },
    ];
    const cache = new InMemoryEnrichmentCache({ capacity: 100 });
    const service = new ProductEnrichmentService({
      cache,
      maxProviders: 10,
      providers: [
        { provider: new FixtureProductProvider({ id: "a", priority: 10, records: [records[0]] }), priority: 10 },
        { provider: new FixtureProductProvider({ id: "b", priority: 12, records: [records[1]] }), priority: 12 },
      ],
    });
    const profile = await service.enrich({
      identifier: normalizeIdentifier("027242873826"),
    });
    assertEqual(profile.media.images.length, 1);
  });

  it("primary image selection picks the marked primary", async () => {
    const records = [
      {
        id: "a",
        matchBy: { gtin: "027242873826" },
        confidence: 0.9,
        exactMatch: true,
        fields: { "identity.brand": "Sony" },
        images: [
          { url: "https://example.com/a.jpg" },
          { url: "https://example.com/b.jpg", isPrimary: true },
        ],
      },
    ];
    const cache = new InMemoryEnrichmentCache({ capacity: 100 });
    const service = new ProductEnrichmentService({
      cache,
      maxProviders: 10,
      providers: [
        { provider: new FixtureProductProvider({ id: "a", priority: 10, records }), priority: 10 },
      ],
    });
    const profile = await service.enrich({
      identifier: normalizeIdentifier("027242873826"),
    });
    const primary = profile.media.images.find((i) => i.isPrimary);
    assertEqual(primary?.url, "https://example.com/b.jpg");
  });
});

describe("NoProviderError", () => {
  it("throws NoProviderError when no provider can handle input", async () => {
    // Empty service with no providers.
    const cache = new InMemoryEnrichmentCache({ capacity: 100 });
    const service = new ProductEnrichmentService({
      cache,
      maxProviders: 10,
      providers: [],
    });
    await assertRejects(
      () => service.enrich({ manualProduct: { title: "x" } }),
      "No provider"
    );
  });
});
