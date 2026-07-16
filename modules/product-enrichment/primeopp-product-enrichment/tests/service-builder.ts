/**
 * Shared test helpers for building a service with all fixture providers
 * registered.
 */

import { ProductEnrichmentService } from "../src/application/service";
import { FixtureProductProvider } from "../src/providers/fixture-provider";
import { ManualInputProvider } from "../src/providers/manual-provider";
import { InMemoryEnrichmentCache } from "../src/cache";
import { loadAllFixtures } from "./fixtures-loader";
import type { FixtureRecord } from "../src/providers/fixture-provider";

export interface ServiceBuilderOpts {
  /** Split fixtures into multiple fixture providers (to test multi-provider merge). */
  splitFixtures?: boolean;
  /** Use a fresh cache (default: shared fresh cache per service). */
  cacheCapacity?: number;
}

export function buildTestService(opts: ServiceBuilderOpts = {}) {
  const all = loadAllFixtures();
  const cache = new InMemoryEnrichmentCache({ capacity: opts.cacheCapacity ?? 100 });

  if (opts.splitFixtures) {
    // Split into two fixture providers so we can test multi-provider merges.
    const half = Math.floor(all.length / 2);
    const a = all.slice(0, half);
    const b = all.slice(half);
    const service = new ProductEnrichmentService({
      cache,
      maxProviders: 10,
      providers: [
        { provider: new FixtureProductProvider({ id: "fixture-a", priority: 10, records: a }), priority: 10 },
        { provider: new FixtureProductProvider({ id: "fixture-b", priority: 12, records: b }), priority: 12 },
        { provider: new ManualInputProvider(), priority: 50 },
      ],
    });
    return { service, cache, fixtures: all };
  }

  const service = new ProductEnrichmentService({
    cache,
    maxProviders: 10,
    providers: [
      { provider: new FixtureProductProvider({ id: "fixture", priority: 10, records: all }), priority: 10 },
      { provider: new ManualInputProvider(), priority: 50 },
    ],
  });
  return { service, cache, fixtures: all };
}

/**
 * Build a service with explicitly-provided fixture records (for targeted
 * conflict tests).
 */
export function buildCustomService(records: FixtureRecord[], opts?: {
  providerId?: string;
  priority?: number;
}) {
  const cache = new InMemoryEnrichmentCache({ capacity: 100 });
  const service = new ProductEnrichmentService({
    cache,
    maxProviders: 10,
    providers: [
      {
        provider: new FixtureProductProvider({
          id: opts?.providerId ?? "fixture-custom",
          priority: opts?.priority ?? 10,
          records,
        }),
        priority: opts?.priority ?? 10,
      },
      { provider: new ManualInputProvider(), priority: 50 },
    ],
  });
  return { service, cache };
}
