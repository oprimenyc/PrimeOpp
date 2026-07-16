import {
  describe,
  it,
  assertEqual,
  assertTruthy,
  assertFalsy,
} from "./harness";
import { IsbnProductProvider } from "../src/providers/isbn-provider";
import type { IsbnMetadataRecord, IsbnMetadataSource } from "../src/providers/isbn-provider";
import { normalizeIdentifier } from "../src/domain/identifier";

class FakeIsbnSource implements IsbnMetadataSource {
  constructor(private readonly records: Map<string, IsbnMetadataRecord>) {}
  async lookup(isbn: string): Promise<IsbnMetadataRecord | null> {
    return this.records.get(isbn) ?? null;
  }
}

describe("IsbnProductProvider", () => {
  it("canHandle returns true only for ISBN inputs", async () => {
    const source = new FakeIsbnSource(new Map());
    const provider = new IsbnProductProvider({ source });
    assertTruthy(await provider.canHandle({ identifier: normalizeIdentifier("9780132350884") }));
    assertFalsy(await provider.canHandle({ identifier: normalizeIdentifier("036000291452") }));
    assertFalsy(await provider.canHandle({ manualProduct: { title: "x" } }));
  });

  it("returns mapped candidates for a known ISBN", async () => {
    const records = new Map<string, IsbnMetadataRecord>([
      [
        "9780132350884",
        {
          isbn: "9780132350884",
          title: "Clean Code",
          publisher: "Prentice Hall",
          description: "A book about clean code.",
          categories: ["Software Engineering"],
          pageCount: 464,
          coverImage: "https://example.com/cover.jpg",
          authors: ["Robert C. Martin"],
          confidence: 0.95,
        },
      ],
    ]);
    const provider = new IsbnProductProvider({ source: new FakeIsbnSource(records) });
    const result = await provider.enrich(
      { identifier: normalizeIdentifier("9780132350884") },
      { timeoutMs: 1000, includeImages: true }
    );
    assertEqual(result.found, true);
    assertTruthy(result.candidates.some((c) => c.field === "identity.canonicalTitle"));
    assertTruthy(result.candidates.some((c) => c.field === "identifiers.isbn"));
    assertTruthy(result.images?.some((i) => i.url === "https://example.com/cover.jpg"));
  });

  it("returns not-found for unknown ISBN", async () => {
    const provider = new IsbnProductProvider({ source: new FakeIsbnSource(new Map()) });
    const result = await provider.enrich(
      { identifier: normalizeIdentifier("9780132350884") },
      { timeoutMs: 1000, includeImages: true }
    );
    assertEqual(result.found, false);
    assertEqual(result.error?.code, "not-found");
  });

  it("handles source errors gracefully", async () => {
    class ThrowingSource implements IsbnMetadataSource {
      async lookup(): Promise<IsbnMetadataRecord | null> {
        throw new Error("Source unavailable");
      }
    }
    const provider = new IsbnProductProvider({ source: new ThrowingSource() });
    const result = await provider.enrich(
      { identifier: normalizeIdentifier("9780132350884") },
      { timeoutMs: 1000, includeImages: true }
    );
    assertEqual(result.found, false);
    assertEqual(result.error?.code, "isbn-source-failed");
    assertTruthy(result.error?.retryable);
  });
});
