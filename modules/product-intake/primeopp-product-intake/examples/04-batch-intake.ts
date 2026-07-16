/**
 * Example 4: Batch intake
 *
 * Demonstrates processing multiple items in a single batch,
 * including valid, invalid, and duplicate entries.
 */

import {
  ProductIntakeService,
  InMemoryDeduplicationStore,
} from "../src/index.js";

async function main() {
  const service = new ProductIntakeService({
    deduplicationStore: new InMemoryDeduplicationStore(),
  });

  const result = await service.intakeBatch({
    items: [
      { rawValue: "036000291452", inputMethod: "BATCH_IMPORT" },       // Valid UPC-A
      { rawValue: "5901234123457", inputMethod: "BATCH_IMPORT" },      // Valid EAN-13
      { rawValue: "9780306406157", inputMethod: "BATCH_IMPORT" },      // Valid ISBN-13
      { rawValue: "036000291453", inputMethod: "BATCH_IMPORT" },       // Bad checksum
      { rawValue: "", inputMethod: "BATCH_IMPORT" },                    // Empty
      { rawValue: "036000291452", inputMethod: "BATCH_IMPORT" },       // Duplicate of first
      {
        inputMethod: "MANUAL_PRODUCT",
        manualProduct: { title: "Custom Item", brand: "TestCo", model: "X1" },
      },
    ],
  });

  console.log("=== Batch Intake Results ===");
  console.log(`Batch ID: ${result.batchId}`);
  console.log(`Total Received: ${result.totalReceived}`);
  console.log(`Accepted: ${result.accepted}`);
  console.log(`Rejected: ${result.rejected}`);
  console.log(`Duplicates: ${result.duplicates}`);
  console.log(`Needs Review: ${result.needsReview}`);
  console.log("\n--- Individual Results ---");

  for (const item of result.items) {
    console.log(
      `  [${item.status.padEnd(12)}] ${item.identifier?.normalizedValue ?? "(manual)"} - Issues: ${item.validationIssues.length}`,
    );
  }
}

main().catch(console.error);