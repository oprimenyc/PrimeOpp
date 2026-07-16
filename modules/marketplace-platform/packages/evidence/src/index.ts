// @primeopp-marketplace/evidence
// In-memory evidence store implementing EvidenceStore contract.
// Every workflow terminal state must produce an evidence record.

import type { EvidenceStore } from '@primeopp-marketplace/contracts';

interface StoredEvidence {
  readonly evidenceId: string;
  readonly tenantId: string;
  readonly kind: string;
  readonly description: string;
  readonly actor: { readonly actorType: string; readonly actorId: string; readonly tenantId: string; readonly role?: string };
  readonly subject: { readonly type: string; readonly id: string };
  readonly payload: Readonly<Record<string, unknown>>;
  readonly hash: string;
  readonly timestamp: string;
}

// Simple deterministic hash (not cryptographic — replace with Prime Vault hash in production).
function simpleHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

let counter = 0;
function newId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export class InMemoryEvidenceStore implements EvidenceStore {
  private readonly byId = new Map<string, StoredEvidence>();
  private readonly bySubject = new Map<string, StoredEvidence[]>();

  record(evidence: {
    readonly tenantId: string;
    readonly kind: string;
    readonly description: string;
    readonly actor: { readonly actorType: string; readonly actorId: string; readonly tenantId: string; readonly role?: string };
    readonly subject: { readonly type: string; readonly id: string };
    readonly payload: Readonly<Record<string, unknown>>;
  }): { readonly evidenceId: string; readonly hash: string; readonly timestamp: string } {
    const timestamp = new Date().toISOString();
    const evidenceId = newId('ev');
    const hash = simpleHash(JSON.stringify({ evidenceId, timestamp, ...evidence }));
    const stored: StoredEvidence = { evidenceId, hash, timestamp, ...evidence };
    this.byId.set(evidenceId, stored);
    const key = `${evidence.subject.type}:${evidence.subject.id}`;
    const arr = this.bySubject.get(key) ?? [];
    arr.push(stored);
    this.bySubject.set(key, arr);
    return { evidenceId, hash, timestamp };
  }

  retrieve(evidenceId: string): StoredEvidence | undefined {
    return this.byId.get(evidenceId);
  }

  list(subjectType: string, subjectId: string): ReadonlyArray<{ readonly evidenceId: string; readonly hash: string; readonly timestamp: string }> {
    const arr = this.bySubject.get(`${subjectType}:${subjectId}`) ?? [];
    return arr.map(e => ({ evidenceId: e.evidenceId, hash: e.hash, timestamp: e.timestamp }));
  }

  snapshot(): readonly StoredEvidence[] {
    return Array.from(this.byId.values());
  }

  count(): number {
    return this.byId.size;
  }
}

export function createInMemoryEvidenceStore(): EvidenceStore {
  return new InMemoryEvidenceStore();
}
