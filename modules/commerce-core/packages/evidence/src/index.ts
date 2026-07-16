// Evidence capture and integrity — Phase 22 / 23.

import type { EvidenceRecord, EventSensitivity, TenantId, TenantScoped } from '@primeopp/contracts';
import { hashString, nowUtc, stableStringify, uuid } from '@primeopp/contracts';

export interface EvidenceStore {
  record(record: EvidenceRecord): Promise<void>;
  get(id: string): Promise<EvidenceRecord | undefined>;
  list(tenantId: TenantId): Promise<EvidenceRecord[]>;
  /** Verify integrity of a stored evidence record. */
  verify(id: string): Promise<boolean>;
}

export class InMemoryEvidenceStore implements EvidenceStore {
  private readonly records = new Map<string, EvidenceRecord>();
  private readonly contents = new Map<string, string>(); // id -> serialized content

  async record(record: EvidenceRecord): Promise<void> {
    this.records.set(record.id, record);
  }

  async get(id: string): Promise<EvidenceRecord | undefined> {
    return this.records.get(id);
  }

  async list(tenantId: TenantId): Promise<EvidenceRecord[]> {
    return Array.from(this.records.values()).filter((r) => r.tenantId === tenantId);
  }

  async verify(id: string): Promise<boolean> {
    const rec = this.records.get(id);
    if (!rec) return false;
    const content = this.contents.get(id);
    if (content === undefined) return false;
    return hashString(content) === rec.contentHash;
  }

  /**
   * Helper: record content directly (for tests).
   */
  async recordWithContent(opts: {
    tenantId: TenantId;
    organizationId?: string;
    kind: EvidenceRecord['kind'];
    content: string;
    contentType?: string;
    description?: string;
    sensitivity?: EventSensitivity;
    correlationId?: string;
  }): Promise<EvidenceRecord> {
    const contentHash = hashString(opts.content);
    const id = uuid();
    const now = nowUtc();
    const record: EvidenceRecord = {
      id,
      tenantId: opts.tenantId,
      ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
      kind: opts.kind,
      contentHash,
      contentRef: `evidence://${id}`,
      ...(opts.contentType ? { contentType: opts.contentType } : {}),
      ...(opts.description ? { description: opts.description } : {}),
      sensitivity: opts.sensitivity ?? 'TENANT',
      ...(opts.correlationId ? { correlationId: opts.correlationId } : {}),
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(id, record);
    this.contents.set(id, opts.content);
    return record;
  }
}

/**
 * Verify that an evidence record's hash matches its content.
 */
export function verifyEvidenceIntegrity(record: EvidenceRecord, content: string): boolean {
  return hashString(content) === record.contentHash;
}

/**
 * Build an evidence record (without storing it).
 */
export function buildEvidenceRecord(opts: {
  tenantId: TenantId;
  organizationId?: string;
  kind: EvidenceRecord['kind'];
  content: string;
  contentType?: string;
  description?: string;
  sensitivity?: EventSensitivity;
  correlationId?: string;
}): EvidenceRecord {
  const contentHash = hashString(opts.content);
  const id = uuid();
  const now = nowUtc();
  return {
    id,
    tenantId: opts.tenantId,
    ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
    kind: opts.kind,
    contentHash,
    contentRef: `evidence://${id}`,
    ...(opts.contentType ? { contentType: opts.contentType } : {}),
    ...(opts.description ? { description: opts.description } : {}),
    sensitivity: opts.sensitivity ?? 'TENANT',
    ...(opts.correlationId ? { correlationId: opts.correlationId } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Compute a deterministic content hash for any serializable value.
 */
export function contentHash(value: unknown): string {
  return hashString(stableStringify(value));
}

/**
 * Tenant isolation guard for evidence reads.
 */
export function assertEvidenceTenantAccess(record: EvidenceRecord, scope: TenantScoped): void {
  if (record.tenantId !== scope.tenantId) {
    throw new Error(`CROSS_TENANT_EVIDENCE_ACCESS_DENIED: evidence ${record.id} belongs to tenant ${record.tenantId}, not ${scope.tenantId}`);
  }
}
