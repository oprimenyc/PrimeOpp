/**
 * In-memory deduplication store.
 *
 * VERIFIED LOCAL BEHAVIOR: All operations run entirely in-process
 * using a JavaScript Map. No external dependencies.
 *
 * This implementation is suitable for single-session deduplication,
 * testing, and demonstration. Production deployments should replace
 * this with a database-backed implementation.
 */

import type {
  ProductIntakeRecord,
  IntakeDeduplicationStore,
} from "../types/index.js";

export class InMemoryDeduplicationStore implements IntakeDeduplicationStore {
  private readonly identifierIndex = new Map<string, ProductIntakeRecord>();
  private readonly fingerprintIndex = new Map<string, ProductIntakeRecord>();

  async findByIdentifier(normalizedValue: string): Promise<ProductIntakeRecord | undefined> {
    return this.identifierIndex.get(normalizedValue);
  }

  async findByFingerprint(fingerprint: string): Promise<ProductIntakeRecord | undefined> {
    return this.fingerprintIndex.get(fingerprint);
  }

  async save(record: ProductIntakeRecord): Promise<void> {
    if (record.identifier) {
      this.identifierIndex.set(record.identifier.normalizedValue, record);
    }
    // For manual products, compute and store fingerprint
    if (record.manualProduct && !record.identifier) {
      const fp = this.computeFingerprint(record.manualProduct);
      if (fp) {
        this.fingerprintIndex.set(fp, record);
      }
    }
  }

  async clear(): Promise<void> {
    this.identifierIndex.clear();
    this.fingerprintIndex.clear();
  }

  /** Non-async accessor for test convenience. */
  get size(): number {
    return this.identifierIndex.size + this.fingerprintIndex.size;
  }

  private computeFingerprint(data: Record<string, unknown>): string | undefined {
    const title = typeof data.title === "string" ? data.title.trim().toLowerCase() : "";
    const brand = typeof data.brand === "string" ? data.brand.trim().toLowerCase() : "";
    const model = typeof data.model === "string" ? data.model.trim().toLowerCase() : "";

    const parts: string[] = [];
    if (title) parts.push(title);
    if (brand) parts.push(brand);
    if (model) parts.push(model);

    return parts.length > 0 ? parts.join("|") : undefined;
  }
}