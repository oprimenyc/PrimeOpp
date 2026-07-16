import {
  describe,
  it,
  assertEqual,
  assertTruthy,
  assertFalsy,
  assertIncludes,
  assertApprox,
  assertRejects,
} from "./harness";
import { buildTestService, buildCustomService } from "./service-builder";
import { normalizeIdentifier } from "../src/domain/identifier";
import { InvalidInputError, NoProviderError } from "../src/errors";
import type { ProductEnrichmentInput } from "../src/contracts/input";

describe("Enrichment: barcode", () => {
  it("enriches a valid UPC barcode (Kraft Mac & Cheese)", async () => {
    const { service } = buildTestService();
    const input: ProductEnrichmentInput = {
      intakeId: "intake-1",
      identifier: normalizeIdentifier("036000291452"),
    };
    const profile = await service.enrich(input);
    assertEqual(profile.status, "ENRICHED");
    assertIncludes(profile.identity.brand ?? "", "Kraft");
    assertTruthy(profile.identity.canonicalTitle?.includes("Macaroni"));
    assertTruthy(profile.identifiers.gtin?.includes("036000291452"));
    assertTruthy(profile.media.images.length > 0);
    assertTruthy(profile.confidence.overall > 0);
  });

  it("enriches a valid EAN-13 barcode", async () => {
    const { service } = buildTestService();
    const input: ProductEnrichmentInput = {
      identifier: normalizeIdentifier("4006381333931"),
    };
    // Fixture might not have this exact one; ensure graceful handling.
    const profile = await service.enrich(input);
    assertTruthy(["ENRICHED", "PARTIAL", "NOT_FOUND"].includes(profile.status));
  });

  it("enriches Sony WH-1000XM4 by UPC", async () => {
    const { service } = buildTestService();
    const input: ProductEnrichmentInput = {
      identifier: normalizeIdentifier("027242873826"),
    };
    const profile = await service.enrich(input);
    assertEqual(profile.status, "ENRICHED");
    assertEqual(profile.identity.brand, "Sony");
    assertEqual(profile.identity.model, "WH-1000XM4");
    assertTruthy(profile.attributes.connectivity?.value === "Bluetooth 5.0");
  });

  it("returns NOT_FOUND status for unknown barcode", async () => {
    const { service } = buildTestService();
    const input: ProductEnrichmentInput = {
      identifier: normalizeIdentifier("0000000000017"), // valid check digit, not in fixtures
    };
    const profile = await service.enrich(input);
    assertTruthy(["NOT_FOUND", "FAILED", "PARTIAL"].includes(profile.status));
  });
});

describe("Enrichment: ISBN", () => {
  it("enriches a valid ISBN-13 (Clean Code)", async () => {
    const { service } = buildTestService();
    const input: ProductEnrichmentInput = {
      identifier: normalizeIdentifier("9780132350884"),
    };
    const profile = await service.enrich(input);
    assertEqual(profile.status, "ENRICHED");
    assertTruthy(profile.identity.canonicalTitle?.includes("Clean Code"));
    assertTruthy(profile.identifiers.isbn?.includes("9780132350884"));
    assertTruthy((profile.attributes.authors?.value as string[])?.includes("Robert C. Martin"));
  });

  it("enriches a valid ISBN-10 with X check digit", async () => {
    const { service } = buildTestService();
    const input: ProductEnrichmentInput = {
      identifier: normalizeIdentifier("080442957X"),
    };
    // Not in fixtures; should NOT_FOUND gracefully.
    const profile = await service.enrich(input);
    assertTruthy(["NOT_FOUND", "FAILED", "PARTIAL"].includes(profile.status));
  });

  it("enriches a valid ISBN-10 in fixtures (Clean Code 10-digit)", async () => {
    const { service } = buildTestService();
    const input: ProductEnrichmentInput = {
      identifier: normalizeIdentifier("0132350882"),
    };
    const profile = await service.enrich(input);
    assertEqual(profile.status, "ENRICHED");
    assertTruthy(profile.identity.canonicalTitle?.includes("Clean Code"));
  });
});

describe("Enrichment: brand + model", () => {
  it("enriches Sony WH-1000XM4 by brand+model", async () => {
    const { service } = buildTestService();
    const input: ProductEnrichmentInput = {
      manualProduct: {
        brand: "Sony",
        model: "WH-1000XM4",
      },
    };
    const profile = await service.enrich(input);
    assertEqual(profile.status, "ENRICHED");
    assertEqual(profile.identity.brand, "Sony");
    assertEqual(profile.identity.model, "WH-1000XM4");
    assertTruthy(profile.media.images.length > 0);
  });

  it("enriches Levi's 505 by brand+model", async () => {
    const { service } = buildTestService();
    const input: ProductEnrichmentInput = {
      manualProduct: { brand: "Levi's", model: "505" },
    };
    const profile = await service.enrich(input);
    assertEqual(profile.status, "ENRICHED");
    assertEqual(profile.identity.brand, "Levi's");
    assertTruthy(profile.attributes.size?.value);
  });
});

describe("Enrichment: manual-only", () => {
  it("produces a PARTIAL profile when no fixture match", async () => {
    const { service } = buildTestService();
    const input: ProductEnrichmentInput = {
      manualProduct: {
        title: "Handmade Ceramic Mug",
        brand: "EtsyArtisan",
        category: "Kitchen",
      },
    };
    const profile = await service.enrich(input);
    assertTruthy(["PARTIAL", "ENRICHED"].includes(profile.status));
    assertEqual(profile.identity.canonicalTitle, "Handmade Ceramic Mug");
    assertEqual(profile.identity.brand, "EtsyArtisan");
    assertTruthy(profile.completeness.missingFields.length > 0);
  });

  it("preserves manual description", async () => {
    const { service } = buildTestService();
    const input: ProductEnrichmentInput = {
      manualProduct: {
        title: "Custom Item",
        description: "A unique custom-made item with no barcode.",
      },
    };
    const profile = await service.enrich(input);
    assertEqual(profile.description, "A unique custom-made item with no barcode.");
  });
});

describe("Enrichment: multi-provider merge", () => {
  it("two fixture providers agree on Sony WH-1000XM4 (split fixtures)", async () => {
    // Build a custom service where BOTH fixture providers have the same product
    // (simulating two providers returning the same item).
    const records = [
      {
        id: "fp-a-sony",
        matchBy: { gtin: "027242873826", brand: "Sony", model: "WH-1000XM4" },
        confidence: 0.95,
        exactMatch: true,
        fields: {
          "identity.canonicalTitle": "Sony WH-1000XM4 Wireless Headphones",
          "identity.brand": "Sony",
          "identity.model": "WH-1000XM4",
          "classification.category": "Electronics",
        },
        images: [{ url: "https://example.com/sony.jpg", isPrimary: true }],
      },
      {
        id: "fp-b-sony",
        matchBy: { gtin: "027242873826", brand: "Sony", model: "WH-1000XM4" },
        confidence: 0.93,
        exactMatch: true,
        fields: {
          "identity.canonicalTitle": "Sony WH-1000XM4 Wireless Headphones",
          "identity.brand": "sony", // different case
          "identity.model": "wh-1000xm4",
          "attributes.color": "Black",
        },
        images: [{ url: "https://example.com/sony-alt.jpg" }],
      },
    ];

    const cache = new (require("../src/cache").InMemoryEnrichmentCache)({ capacity: 100 });
    const { FixtureProductProvider } = require("../src/providers/fixture-provider");
    const { ManualInputProvider } = require("../src/providers/manual-provider");
    const { ProductEnrichmentService } = require("../src/application/service");
    const service = new ProductEnrichmentService({
      cache,
      maxProviders: 10,
      providers: [
        { provider: new FixtureProductProvider({ id: "fp-a", priority: 10, records: [records[0]] }), priority: 10 },
        { provider: new FixtureProductProvider({ id: "fp-b", priority: 12, records: [records[1]] }), priority: 12 },
        { provider: new ManualInputProvider(), priority: 5 },
      ],
    });

    const input: ProductEnrichmentInput = {
      identifier: normalizeIdentifier("027242873826"),
    };
    const profile = await service.enrich(input);
    assertEqual(profile.identity.brand, "Sony");
    assertEqual(profile.identity.model, "WH-1000XM4");
    assertTruthy(profile.attributes.color?.value === "black");
    // Two providers should have contributed.
    assertTruthy(profile.sources.length >= 2);
    // No conflict because Sony/sony/SONY normalize the same.
    const brandConflicts = profile.conflicts.filter((c) => c.field === "identity.brand");
    assertEqual(brandConflicts.length, 0);
  });

  it("partial agreement: providers agree on brand but disagree on color", async () => {
    const records = [
      {
        id: "p1",
        matchBy: { gtin: "1234567890125" },
        confidence: 0.9,
        exactMatch: true,
        fields: {
          "identity.brand": "BrandX",
          "identity.model": "M1",
          "attributes.color": "Black",
        },
      },
      {
        id: "p2",
        matchBy: { gtin: "1234567890125" },
        confidence: 0.85,
        exactMatch: true,
        fields: {
          "identity.brand": "brandx",
          "identity.model": "M1",
          "attributes.color": "Silver",
        },
      },
    ];

    const { InMemoryEnrichmentCache } = require("../src/cache");
    const { FixtureProductProvider } = require("../src/providers/fixture-provider");
    const { ProductEnrichmentService } = require("../src/application/service");
    const cache = new InMemoryEnrichmentCache({ capacity: 100 });
    const service = new ProductEnrichmentService({
      cache,
      maxProviders: 10,
      providers: [
        { provider: new FixtureProductProvider({ id: "p1", priority: 10, records: [records[0]] }), priority: 10 },
        { provider: new FixtureProductProvider({ id: "p2", priority: 12, records: [records[1]] }), priority: 12 },
      ],
    });

    const profile = await service.enrich({
      identifier: normalizeIdentifier("1234567890125"),
    });
    assertEqual(profile.identity.brand, "BrandX");
    const colorConflicts = profile.conflicts.filter((c) => c.field === "attributes.color");
    assertEqual(colorConflicts.length, 1);
    assertTruthy(colorConflicts[0].severity !== "HIGH");
  });
});

describe("Enrichment: conflicts", () => {
  it("brand conflict produces HIGH severity", async () => {
    const records = [
      {
        id: "c1",
        matchBy: { gtin: "0123456789012" },
        confidence: 0.9,
        exactMatch: true,
        fields: {
          "identity.brand": "BrandA",
          "identity.model": "M1",
        },
      },
      {
        id: "c2",
        matchBy: { gtin: "0123456789012" },
        confidence: 0.85,
        exactMatch: true,
        fields: {
          "identity.brand": "BrandB",
          "identity.model": "M2",
        },
      },
    ];
    const { InMemoryEnrichmentCache } = require("../src/cache");
    const { FixtureProductProvider } = require("../src/providers/fixture-provider");
    const { ProductEnrichmentService } = require("../src/application/service");
    const cache = new InMemoryEnrichmentCache({ capacity: 100 });
    const service = new ProductEnrichmentService({
      cache,
      maxProviders: 10,
      providers: [
        { provider: new FixtureProductProvider({ id: "c1", priority: 10, records: [records[0]] }), priority: 10 },
        { provider: new FixtureProductProvider({ id: "c2", priority: 12, records: [records[1]] }), priority: 12 },
      ],
    });
    const profile = await service.enrich({
      identifier: normalizeIdentifier("0123456789012"),
    });
    const brandConflicts = profile.conflicts.filter((c) => c.field === "identity.brand");
    assertEqual(brandConflicts.length, 1);
    assertEqual(brandConflicts[0].severity, "HIGH");
    assertEqual(profile.status, "AMBIGUOUS");
  });

  it("model conflict is HIGH severity", async () => {
    const records = [
      {
        id: "m1",
        matchBy: { gtin: "0123456789012" },
        confidence: 0.9,
        exactMatch: true,
        fields: { "identity.brand": "Same", "identity.model": "M1" },
      },
      {
        id: "m2",
        matchBy: { gtin: "0123456789012" },
        confidence: 0.85,
        exactMatch: true,
        fields: { "identity.brand": "Same", "identity.model": "M2" },
      },
    ];
    const { InMemoryEnrichmentCache } = require("../src/cache");
    const { FixtureProductProvider } = require("../src/providers/fixture-provider");
    const { ProductEnrichmentService } = require("../src/application/service");
    const cache = new InMemoryEnrichmentCache({ capacity: 100 });
    const service = new ProductEnrichmentService({
      cache,
      maxProviders: 10,
      providers: [
        { provider: new FixtureProductProvider({ id: "m1", priority: 10, records: [records[0]] }), priority: 10 },
        { provider: new FixtureProductProvider({ id: "m2", priority: 12, records: [records[1]] }), priority: 12 },
      ],
    });
    const profile = await service.enrich({
      identifier: normalizeIdentifier("0123456789012"),
    });
    const modelConflicts = profile.conflicts.filter((c) => c.field === "identity.model");
    assertEqual(modelConflicts.length, 1);
    assertEqual(modelConflicts[0].severity, "HIGH");
    assertEqual(profile.status, "AMBIGUOUS");
  });

  it("high-severity identity ambiguity produces AMBIGUOUS status", async () => {
    // Use the conflicting fixtures file directly, but split the two records
    // across TWO fixture providers so both contribute candidates and a
    // conflict is detected. (A single FixtureProductProvider returns only
    // the first match, so no conflict would be generated otherwise.)
    const { InMemoryEnrichmentCache } = require("../src/cache");
    const { FixtureProductProvider } = require("../src/providers/fixture-provider");
    const { ProductEnrichmentService } = require("../src/application/service");
    const { loadFixtureFile } = require("./fixtures-loader");
    const records = loadFixtureFile("conflicting.json");
    const cache = new InMemoryEnrichmentCache({ capacity: 100 });
    const service = new ProductEnrichmentService({
      cache,
      maxProviders: 10,
      providers: [
        { provider: new FixtureProductProvider({ id: "conflict-a", priority: 10, records: [records[0]] }), priority: 10 },
        { provider: new FixtureProductProvider({ id: "conflict-b", priority: 12, records: [records[1]] }), priority: 12 },
      ],
    });
    const profile = await service.enrich({
      identifier: normalizeIdentifier("0123456789012"),
    });
    assertEqual(profile.status, "AMBIGUOUS");
    assertTruthy(profile.conflicts.length >= 2);
  });
});
