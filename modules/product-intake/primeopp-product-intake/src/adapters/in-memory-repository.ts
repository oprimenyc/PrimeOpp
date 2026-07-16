/**
 * In-memory intake record repository.
 *
 * VERIFIED LOCAL BEHAVIOR: All operations run in-process.
 * Suitable for testing, demos, and single-session use.
 * Production should replace with a database-backed implementation.
 */

import type {
  ProductIntakeRecord,
  IntakeRecordRepository,
} from "../types/index.js";

export class InMemoryIntakeRecordRepository implements IntakeRecordRepository {
  private readonly store = new Map<string, ProductIntakeRecord>();

  async save(record: ProductIntakeRecord): Promise<void> {
    this.store.set(record.intakeId, record);
  }

  async findById(intakeId: string): Promise<ProductIntakeRecord | undefined> {
    return this.store.get(intakeId);
  }

  async findAll(): Promise<ProductIntakeRecord[]> {
    return Array.from(this.store.values());
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}