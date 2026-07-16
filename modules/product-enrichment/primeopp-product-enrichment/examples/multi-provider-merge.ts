/**
 * Example: multi-provider merge.
 *
 * Registers two fixture providers that both have data for the same product
 * (simulating two real product-data sources returning the same item) and
 * shows how the resolution engine merges them into one profile.
 */

import { ProductEnrichmentService } from "../src/application/service";
import { FixtureProductProvider } from "../src/providers/fixture-provider";
import { ManualInputProvider } from "../src/providers/manual-provider";
import { InMemoryEnrichmentCache } from "../src/cache";
import { normalizeIdentifier } from "../src/domain/identifier";
import type { FixtureRecord } from "../src/providers/fixture-provider";

async function main(): Promise<void> {
  const providerARecords: FixtureRecord[] = [
    {
      id: "fp-a-sony",
      matchBy: { gtin: "027242873826", brand: "Sony", model: "WH-1000XM4" },
      confidence: 0.95,
      exactMatch: true,
      fields: {
        "identity.canonicalTitle": "Sony WH-1000XM4 Wireless Headphones",
        "identity.brand": "Sony",
        "identity.model": "WH-1000XM4",
        "classification.category": "Electronics",
      },
      images: [{ url: "https://example.com/sony.jpg", isPrimary: true }],
    },
  ];

  const providerBRecords: FixtureRecord[] = [
    {
      id: "fp-b-sony",
      matchBy: { gtin: "027242873826", brand: "Sony", model: "WH-1000XM4" },
      confidence: 0.93,
      exactMatch: true,
      fields: {
        "identity.canonicalTitle": "Sony WH-1000XM4 Wireless Headphones",
        "identity.brand": "sony",
        "identity.model": "wh-1000xm4",
        "attributes.color": "Black",
        "attributes.weight": "254g",
      },
      images: [{ url: "https://example.com/sony-alt.jpg" }],
    },
  ];

  const service = new ProductEnrichmentService({
    cache: new InMemoryEnrichmentCache({ capacity: 100 }),
    maxProviders: 10,
    providers: [
      { provider: new FixtureProductProvider({ id: "providerA", priority: 10, records: providerARecords }), priority: 10 },
      { provider: new FixtureProductProvider({ id: "providerB", priority: 12, records: providerBRecords }), priority: 12 },
      { provider: new ManualInputProvider(), priority: 5 },
    ],
  });

  const profile = await service.enrich({
    identifier: normalizeIdentifier("027242873826"),
  });

  console.log(JSON.stringify(profile, null, 2));
}

main().catch((err) => {
  console.error("Example failed:", err);
  process.exit(1);
});
