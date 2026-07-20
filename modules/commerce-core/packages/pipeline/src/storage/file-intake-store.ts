// File-backed IntakeDeduplicationStore + IntakeRecordRepository.
//
// primeopp-product-intake only ships in-memory implementations of both
// contracts (see its InMemoryDeduplicationStore / InMemoryIntakeRecordRepository
// -- both explicitly documented as "suitable for testing... production should
// replace with a database-backed implementation"). This is that replacement,
// scoped to what a local CLI needs: durability across process invocations,
// without a database. Indexing logic mirrors the in-memory versions exactly.

import type {
  ProductIntakeRecord,
  IntakeDeduplicationStore,
  IntakeRecordRepository,
} from 'primeopp-product-intake';
import { readJsonFile, writeJsonFileAtomic } from './json-file.ts';

interface IntakeFileShape {
  records: ProductIntakeRecord[];
}

function computeFingerprint(data: Record<string, unknown>): string | undefined {
  const title = typeof data.title === 'string' ? data.title.trim().toLowerCase() : '';
  const brand = typeof data.brand === 'string' ? data.brand.trim().toLowerCase() : '';
  const model = typeof data.model === 'string' ? data.model.trim().toLowerCase() : '';
  const parts = [title, brand, model].filter((p) => p.length > 0);
  return parts.length > 0 ? parts.join('|') : undefined;
}

export class FileIntakeStore implements IntakeDeduplicationStore, IntakeRecordRepository {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  private async load(): Promise<IntakeFileShape> {
    return readJsonFile<IntakeFileShape>(this.filePath, { records: [] });
  }

  private async persist(data: IntakeFileShape): Promise<void> {
    await writeJsonFileAtomic(this.filePath, data);
  }

  async findByIdentifier(normalizedValue: string): Promise<ProductIntakeRecord | undefined> {
    const data = await this.load();
    return data.records.find((r) => r.identifier?.normalizedValue === normalizedValue);
  }

  async findByFingerprint(fingerprint: string): Promise<ProductIntakeRecord | undefined> {
    const data = await this.load();
    return data.records.find(
      (r) => !r.identifier && r.manualProduct && computeFingerprint(r.manualProduct) === fingerprint
    );
  }

  async save(record: ProductIntakeRecord): Promise<void> {
    const data = await this.load();
    const idx = data.records.findIndex((r) => r.intakeId === record.intakeId);
    if (idx >= 0) data.records[idx] = record;
    else data.records.push(record);
    await this.persist(data);
  }

  async findById(intakeId: string): Promise<ProductIntakeRecord | undefined> {
    const data = await this.load();
    return data.records.find((r) => r.intakeId === intakeId);
  }

  async findAll(): Promise<ProductIntakeRecord[]> {
    const data = await this.load();
    return data.records;
  }

  async clear(): Promise<void> {
    await this.persist({ records: [] });
  }
}
