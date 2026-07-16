/**
 * Example 1: Single barcode scan intake
 *
 * Demonstrates the simplest use case: a single barcode scanned
 * from a camera-based scanner, processed through the intake pipeline.
 */

import {
  ProductIntakeService,
  InMemoryDeduplicationStore,
  scannerEventToInput,
} from "../src/index.js";

async function main() {
  // Set up the service with in-memory deduplication
  const service = new ProductIntakeService({
    deduplicationStore: new InMemoryDeduplicationStore(),
  });

  // Simulate a camera scan event
  const scanEvent = {
    value: "036000291452",
    symbology: "UPC_A",
    capturedAt: new Date().toISOString(),
    deviceId: "camera-01",
  };

  // Convert scanner event to intake input
  const input = scannerEventToInput(scanEvent);

  // Process the intake
  const record = await service.intake(input);

  console.log("=== Single Barcode Scan Intake ===");
  console.log(JSON.stringify(record, null, 2));
  console.log(`\nStatus: ${record.status}`);
  console.log(`Identifier Type: ${record.identifier?.identifierType}`);
  console.log(`Normalized Value: ${record.identifier?.normalizedValue}`);
  console.log(`Checksum Valid: ${record.identifier?.checksumValid}`);
}

main().catch(console.error);