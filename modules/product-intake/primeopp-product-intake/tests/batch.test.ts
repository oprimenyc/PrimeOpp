/**
 * Tests for batch intake processing.
 */

import { ProductIntakeService } from "../src/application/index.js";
import { InMemoryDeduplicationStore } from "../src/deduplication/index.js";

function createService() {
  return new ProductIntakeService({
    deduplicationStore: new InMemoryDeduplicationStore(),
    idGenerator: () => `batch-test-${crypto.randomUUID()}`,
  });
}

describe("Batch intake", () => {
  test("mixed valid and invalid records", async () => {
    const svc = createService();
    const result = await svc.intakeBatch({
      items: [
        { rawValue: "036000291452", inputMethod: "BATCH_IMPORT" },   // valid UPC-A
        { rawValue: "036000291453", inputMethod: "BATCH_IMPORT" },   // bad checksum → NEEDS_REVIEW
        { rawValue: "5901234123457", inputMethod: "BATCH_IMPORT" },  // valid EAN-13
        { rawValue: "", inputMethod: "BATCH_IMPORT" },                // empty → REJECTED
        { rawValue: "12345", inputMethod: "BATCH_IMPORT" },          // unknown → REJECTED
      ],
    });

    expect(result.totalReceived).toBe(5);
    expect(result.accepted).toBe(2);
    expect(result.rejected).toBe(2);
    expect(result.needsReview).toBe(1);
    expect(result.items).toHaveLength(5);
  });

  test("batch continues after individual failures", async () => {
    const svc = createService();
    const result = await svc.intakeBatch({
      items: [
        { rawValue: "", inputMethod: "BATCH_IMPORT" },               // fails
        { rawValue: "036000291452", inputMethod: "BATCH_IMPORT" },   // succeeds
        { inputMethod: "BATCH_IMPORT" },                              // no data at all
        { rawValue: "5901234123457", inputMethod: "BATCH_IMPORT" },  // succeeds
      ],
    });

    expect(result.totalReceived).toBe(4);
    expect(result.items).toHaveLength(4);
    // First and third are rejected, second and fourth accepted
    expect(result.items[0]!.status).toBe("REJECTED");
    expect(result.items[1]!.status).toBe("ACCEPTED");
    expect(result.items[2]!.status).toBe("REJECTED");
    expect(result.items[3]!.status).toBe("ACCEPTED");
  });

  test("batch with duplicates", async () => {
    const svc = createService();
    const result = await svc.intakeBatch({
      items: [
        { rawValue: "036000291452", inputMethod: "BATCH_IMPORT" },
        { rawValue: "03600-02914-52", inputMethod: "BATCH_IMPORT" }, // same after normalize
        { rawValue: "  036000291452  ", inputMethod: "BATCH_IMPORT" }, // same after normalize
      ],
    });

    expect(result.totalReceived).toBe(3);
    expect(result.accepted).toBe(1);
    expect(result.duplicates).toBe(2);
    expect(result.items[0]!.status).toBe("ACCEPTED");
    expect(result.items[1]!.status).toBe("DUPLICATE");
    expect(result.items[2]!.status).toBe("DUPLICATE");
    expect(result.items[1]!.duplicateOf).toBe(result.items[0]!.intakeId);
    expect(result.items[2]!.duplicateOf).toBe(result.items[0]!.intakeId);
  });

  test("empty batch returns zero counts", async () => {
    const svc = createService();
    const result = await svc.intakeBatch({ items: [] });
    expect(result.totalReceived).toBe(0);
    expect(result.accepted).toBe(0);
    expect(result.rejected).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  test("batch result has unique batchId", async () => {
    const svc = createService();
    const r1 = await svc.intakeBatch({ items: [] });
    const r2 = await svc.intakeBatch({ items: [] });
    expect(r1.batchId).not.toBe(r2.batchId);
  });

  test("batch with manual products", async () => {
    const svc = createService();
    const result = await svc.intakeBatch({
      items: [
        {
          inputMethod: "MANUAL_PRODUCT",
          manualProduct: { title: "Widget A", brand: "Acme" },
        },
        {
          inputMethod: "MANUAL_PRODUCT",
          manualProduct: { category: "Misc" }, // insufficient
        },
      ],
    });

    expect(result.totalReceived).toBe(2);
    expect(result.accepted).toBe(1);
    expect(result.rejected).toBe(1);
  });
});