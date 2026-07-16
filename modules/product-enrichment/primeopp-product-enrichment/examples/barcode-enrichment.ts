/**
 * Example: enrich a product by barcode (UPC/GTIN).
 *
 * Usage:  npm run example:barcode
 */

import { ProductEnrichmentService } from "../src/application/service";
import { FixtureProductProvider } from "../src/providers/fixture-provider";
import { ManualInputProvider } from "../src/providers/manual-provider";
import { InMemoryEnrichmentCache } from "../src/cache";
import { normalizeIdentifier } from "../src/domain/identifier";
import { loadAllFixtures } from "../tests/fixtures-loader";

async function main(): Promise<void> {
  const fixtures = loadAllFixtures();
  const service = new ProductEnrichmentService({
    cache: new InMemoryEnrichmentCache({ capacity: 100, defaultTtlSeconds: 60 }),
    maxProviders: 5,
    providers: [
      { provider: new FixtureProductProvider({ id: "fixture", priority: 10, records: fixtures }), priority: 10 },
      { provider: new ManualInputProvider(), priority: 5 },
    ],
  });

  const profile = await service.enrich({
    intakeId: "intake-barcode-001",
    identifier: normalizeIdentifier("027242873826"), // Sony WH-1000XM4
  });

  console.log(JSON.stringify(profile, null, 2));
}

main().catch((err) => {
  console.error("Example failed:", err);
  process.exit(1);
});
