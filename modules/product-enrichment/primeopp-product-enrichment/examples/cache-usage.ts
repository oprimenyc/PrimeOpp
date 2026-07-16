/**
 * Example: cache usage.
 *
 * Shows cache hit on the second call with identical input, and how to
 * construct a service with a custom cache (e.g. longer TTL).
 */

import { ProductEnrichmentService } from "../src/application/service";
import { FixtureProductProvider } from "../src/providers/fixture-provider";
import { ManualInputProvider } from "../src/providers/manual-provider";
import { InMemoryEnrichmentCache } from "../src/cache";
import { normalizeIdentifier } from "../src/domain/identifier";
import { loadAllFixtures } from "../tests/fixtures-loader";

async function main(): Promise<void> {
  const fixtures = loadAllFixtures();
  const cache = new InMemoryEnrichmentCache({ capacity: 100, defaultTtlSeconds: 60 });
  const service = new ProductEnrichmentService({
    cache,
    maxProviders: 5,
    providers: [
      { provider: new FixtureProductProvider({ id: "fixture", priority: 10, records: fixtures }), priority: 10 },
      { provider: new ManualInputProvider(), priority: 5 },
    ],
  });

  const input = {
    identifier: normalizeIdentifier("036000291452"),
  };

  console.log("First call (cache miss):");
  const t1 = Date.now();
  const p1 = await service.enrich(input);
  console.log(`  status=${p1.status} brand=${p1.identity.brand} (${Date.now() - t1}ms)`);

  console.log("Second call (cache hit):");
  const t2 = Date.now();
  const p2 = await service.enrich(input);
  console.log(`  status=${p2.status} brand=${p2.identity.brand} (${Date.now() - t2}ms)`);
  console.log(`  Same enrichmentId? ${p1.enrichmentId === p2.enrichmentId}`);

  console.log("Third call with cache disabled:");
  const t3 = Date.now();
  const p3 = await service.enrich(input, { useCache: false });
  console.log(`  status=${p3.status} brand=${p3.identity.brand} (${Date.now() - t3}ms)`);
  console.log(`  Same enrichmentId? ${p1.enrichmentId === p3.enrichmentId}`);
}

main().catch((err) => {
  console.error("Example failed:", err);
  process.exit(1);
});
