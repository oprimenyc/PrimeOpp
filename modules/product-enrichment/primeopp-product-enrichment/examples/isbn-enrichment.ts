/**
 * Example: enrich a book by ISBN.
 */

import { ProductEnrichmentService } from "../src/application/service";
import { FixtureProductProvider } from "../src/providers/fixture-provider";
import { IsbnProductProvider } from "../src/providers/isbn-provider";
import type { IsbnMetadataSource, IsbnMetadataRecord } from "../src/providers/isbn-provider";
import { InMemoryEnrichmentCache } from "../src/cache";
import { normalizeIdentifier } from "../src/domain/identifier";
import { loadAllFixtures } from "../tests/fixtures-loader";

class DemoIsbnSource implements IsbnMetadataSource {
  private readonly records = new Map<string, IsbnMetadataRecord>([
    [
      "9780132350884",
      {
        isbn: "9780132350884",
        title: "Clean Code: A Handbook of Agile Software Craftsmanship",
        publisher: "Prentice Hall",
        publishedDate: "2008-08-01",
        description: "A book about writing maintainable code.",
        categories: ["Software Engineering"],
        pageCount: 464,
        coverImage: "https://example.com/clean-code.jpg",
        authors: ["Robert C. Martin"],
        confidence: 0.96,
      },
    ],
  ]);
  async lookup(isbn: string): Promise<IsbnMetadataRecord | null> {
    return this.records.get(isbn) ?? null;
  }
}

async function main(): Promise<void> {
  const fixtures = loadAllFixtures();
  const service = new ProductEnrichmentService({
    cache: new InMemoryEnrichmentCache({ capacity: 100 }),
    maxProviders: 5,
    providers: [
      { provider: new IsbnProductProvider({ source: new DemoIsbnSource() }), priority: 8 },
      { provider: new FixtureProductProvider({ id: "fixture", priority: 10, records: fixtures }), priority: 10 },
    ],
  });

  const profile = await service.enrich({
    identifier: normalizeIdentifier("9780132350884"),
  });

  console.log(JSON.stringify(profile, null, 2));
}

main().catch((err) => {
  console.error("Example failed:", err);
  process.exit(1);
});
