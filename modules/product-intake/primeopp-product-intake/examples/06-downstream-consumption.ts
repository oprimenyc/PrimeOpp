/**
 * Example 6: Consuming normalized output downstream
 *
 * Shows how a downstream module (e.g., Product Enrichment)
 * would consume the intake record and pass it to the next stage.
 *
 * This is a SIMULATED downstream consumer — no real enrichment API is called.
 */

import {
  ProductIntakeService,
  InMemoryDeduplicationStore,
  type ProductIntakeRecord,
} from "../src/index.js";

/**
 * SIMULATED downstream enrichment consumer.
 * In the real PrimeOpp pipeline, this would be a separate module.
 */
async function sendToEnrichment(record: ProductIntakeRecord): Promise<void> {
  // In production, this would make an API call or enqueue a message.
  // Here we just demonstrate the contract.
  console.log("  [ENRICHMENT] Received intake record for processing:");
  console.log(`    Intake ID: ${record.intakeId}`);
  if (record.identifier) {
    console.log(`    Identifier: ${record.identifier.normalizedValue} (${record.identifier.identifierType})`);
  }
  if (record.manualProduct) {
    console.log(`    Title: ${record.manualProduct.title}`);
    console.log(`    Brand: ${record.manualProduct.brand}`);
  }
  console.log(`    Status: ${record.status}`);
  console.log(`    Validation Issues: ${record.validationIssues.length}`);
  console.log();
}

async function main() {
  const service = new ProductIntakeService({
    deduplicationStore: new InMemoryDeduplicationStore(),
  });

  console.log("=== Downstream Consumption Demo ===\n");

  // Intake a product
  const record = await service.intake({
    rawValue: "036000291452",
    inputMethod: "CAMERA_SCAN",
  });

  // Only send ACCEPTED or NEEDS_REVIEW records to enrichment
  if (record.status === "ACCEPTED" || record.status === "NEEDS_REVIEW") {
    await sendToEnrichment(record);
  } else {
    console.log("  Record not sent to enrichment (status: " + record.status + ")");
  }

  // Demonstrate serialization for transport
  const serialized = JSON.stringify(record);
  console.log("  Serialized payload size:", serialized.length, "bytes");
  console.log("  Payload (truncated):", serialized.slice(0, 120) + "...");
}

main().catch(console.error);