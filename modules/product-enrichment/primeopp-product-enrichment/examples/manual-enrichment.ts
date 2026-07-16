/**
 * Example: enrich a manually-entered product with no fixture match.
 *
 * Demonstrates how the manual provider's evidence flows through to the
 * final profile even when no other provider returns a match.
 */

import { ProductEnrichmentService } from "../src/application/service";
import { FixtureProductProvider } from "../src/providers/fixture-provider";
import { ManualInputProvider } from "../src/providers/manual-provider";
import { InMemoryEnrichmentCache } from "../src/cache";
import { loadAllFixtures } from "../tests/fixtures-loader";

async function main(): Promise<void> {
  const fixtures = loadAllFixtures();
  const service = new ProductEnrichmentService({
    cache: new InMemoryEnrichmentCache({ capacity: 100 }),
    maxProviders: 5,
    providers: [
      { provider: new FixtureProductProvider({ id: "fixture", priority: 10, records: fixtures }), priority: 10 },
      { provider: new ManualInputProvider(), priority: 5 },
    ],
  });

  const profile = await service.enrich({
    manualProduct: {
      title: "Handmade Ceramic Mug",
      brand: "EtsyArtisan",
      category: "Kitchen",
      description: "A unique custom-made ceramic mug, hand-thrown.",
      color: "Blue",
    },
  });

  console.log(JSON.stringify(profile, null, 2));
}

main().catch((err) => {
  console.error("Example failed:", err);
  process.exit(1);
});
