/**
 * Tests for the in-memory deduplication store.
 */

import { InMemoryDeduplicationStore } from "../src/deduplication/index.js";
import type { ProductIntakeRecord } from "../src/types/index.js";

function makeRecord(overrides: Partial<ProductIntakeRecord> = {}): ProductIntakeRecord {
  return {
    intakeId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    inputMethod: "MANUAL_IDENTIFIER",
    status: "ACCEPTED",
    validationIssues: [],
    ...overrides,
  };
}

describe("InMemoryDeduplicationStore", () => {
  test("saves and finds by identifier", async () => {
    const store = new InMemoryDeduplicationStore();
    const record = makeRecord({
      identifier: {
        rawValue: "036000291452",
        normalizedValue: "036000291452",
        identifierType: "UPC_A",
        isValidFormat: true,
        checksumValid: true,
        confidence: "HIGH",
      },
    });

    await store.save(record);
    const found = await store.findByIdentifier("036000291452");
    expect(found?.intakeId).toBe(record.intakeId);
  });

  test("returns undefined for unknown identifier", async () => {
    const store = new InMemoryDeduplicationStore();
    const found = await store.findByIdentifier("999999999999");
    expect(found).toBeUndefined();
  });

  test("saves and finds manual product by fingerprint", async () => {
    const store = new InMemoryDeduplicationStore();
    const record = makeRecord({
      manualProduct: {
        title: "Test Widget",
        brand: "Acme",
        model: "TW-100",
      },
    });

    await store.save(record);
    const found = await store.findByFingerprint("test widget|acme|tw-100");
    expect(found?.intakeId).toBe(record.intakeId);
  });

  test("clear empties the store", async () => {
    const store = new InMemoryDeduplicationStore();
    const record = makeRecord({
      identifier: {
        rawValue: "036000291452",
        normalizedValue: "036000291452",
        identifierType: "UPC_A",
        isValidFormat: true,
        checksumValid: true,
        confidence: "HIGH",
      },
    });
    await store.save(record);
    expect(store.size).toBe(1);
    await store.clear();
    expect(store.size).toBe(0);
    const found = await store.findByIdentifier("036000291452");
    expect(found).toBeUndefined();
  });
});