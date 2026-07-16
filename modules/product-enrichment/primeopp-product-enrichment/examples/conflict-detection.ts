/**
 * Example: conflict detection.
 *
 * Registers a single fixture provider that has two conflicting records for
 * the same GTIN (simulating two disagreeing real providers). Shows how the
 * module surfaces the conflict and marks the profile AMBIGUOUS.
 */

import { ProductEnrichmentService } from "../src/application/service";
import { FixtureProductProvider } from "../src/providers/fixture-provider";
import { InMemoryEnrichmentCache } from "../src/cache";
import { normalizeIdentifier } from "../src/domain/identifier";
import type { FixtureRecord } from "../src/providers/fixture-provider";

async function main(): Promise<void> {
  const records: FixtureRecord[] = [
    {
      id: "conflict-a",
      matchBy: { gtin: "0123456789012" },
      confidence: 0.9,
      exactMatch: true,
      fields: {
        "identity.brand": "BrandA",
        "identity.model": "M1",
        "identity.canonicalTitle": "Widget A",
        "attributes.color": "Black",
      },
      images: [{ url: "https://example.com/a.jpg", isPrimary: true }],
    },
    {
      id: "conflict-b",
      matchBy: { gtin: "0123456789012" },
      confidence: 0.85,
      exactMatch: true,
      fields: {
        "identity.brand": "BrandB",
        "identity.model": "M2",
        "identity.canonicalTitle": "Widget B",
        "attributes.color": "Silver",
      },
      images: [{ url: "https://example.com/b.jpg", isPrimary: true }],
    },
  ];

  const service = new ProductEnrichmentService({
    cache: new InMemoryEnrichmentCache({ capacity: 100 }),
    maxProviders: 10,
    providers: [
      { provider: new FixtureProductProvider({ id: "conflict", priority: 10, records }), priority: 10 },
    ],
  });

  const profile = await service.enrich({
    identifier: normalizeIdentifier("0123456789012"),
  });

  console.log("Status:", profile.status);
  console.log("Conflicts:");
  for (const c of profile.conflicts) {
    console.log(`  [${c.severity}] ${c.field}`);
    for (const cand of c.candidates) {
      console.log(`    - ${JSON.stringify(cand.value)} (from ${cand.providerId}, conf=${cand.confidence})`);
    }
    if (c.resolution) {
      console.log(`    Resolution: ${c.resolution}`);
    }
  }
  console.log();
  console.log(JSON.stringify(profile, null, 2));
}

main().catch((err) => {
  console.error("Example failed:", err);
  process.exit(1);
});
