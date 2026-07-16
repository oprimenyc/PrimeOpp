// Evidence contracts.
import type { Identifier, ISO8601 } from './common.js';

export interface EvidenceStore {
  record(evidence: {
    readonly tenantId: string;
    readonly kind: string;
    readonly description: string;
    readonly actor: { readonly actorType: string; readonly actorId: string; readonly tenantId: string; readonly role?: string };
    readonly subject: { readonly type: string; readonly id: string };
    readonly payload: Readonly<Record<string, unknown>>;
  }): { readonly evidenceId: string; readonly hash: string; readonly timestamp: ISO8601 };
  retrieve(evidenceId: Identifier): { readonly evidenceId: string; readonly hash: string; readonly timestamp: ISO8601; readonly payload: Readonly<Record<string, unknown>> } | undefined;
  list(subjectType: string, subjectId: Identifier): ReadonlyArray<{ readonly evidenceId: string; readonly hash: string; readonly timestamp: ISO8601 }>;
}

export interface VerificationReceipt {
  readonly receiptId: Identifier;
  readonly subjectType: string;
  readonly subjectId: Identifier;
  readonly verifier: 'EVE' | 'runtime' | 'adapter' | 'human';
  readonly checks: ReadonlyArray<{ readonly name: string; readonly passed: boolean; readonly details?: string }>;
  readonly overallPassed: boolean;
  readonly timestamp: ISO8601;
  readonly evidenceIds: readonly Identifier[];
}
