/**
 * Example 5: Duplicate detection
 *
 * Demonstrates how the deduplication store catches duplicates
 * even when the same barcode is formatted differently.
 */

import {
  ProductIntakeService,
  InMemoryDeduplicationStore,
} from "../src/index.js";

async function main() {
  const service = new ProductIntakeService({
    deduplicationStore: new InMemoryDeduplicationStore(),
  });

  // Same barcode, three different formats
  const entries = [
    "036000291452",       // plain
    "03600-02914-52",    // hyphenated
    "  036000291452  ",  // with whitespace
  ];

  console.log("=== Duplicate Detection Demo ===\n");

  for (const raw of entries) {
    const record = await service.intake({
      rawValue: raw,
      inputMethod: "MANUAL_IDENTIFIER",
    });
    console.log(`Input: "${raw}"`);
    console.log(`  Status: ${record.status}`);
    console.log(`  Normalized: ${record.identifier?.normalizedValue}`);
    if (record.duplicateOf) {
      console.log(`  Duplicate of: ${record.duplicateOf}`);
    }
    console.log();
  }
}

main().catch(console.error);