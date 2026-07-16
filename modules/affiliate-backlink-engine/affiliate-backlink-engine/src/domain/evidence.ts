/**
 * Evidence Record.
 *
 * Every actionable claim the engine makes MUST be backed by at least one
 * EvidenceRecord that records:
 *  - what was observed
 *  - where it was observed (source reference)
 *  - when it was observed (timestamp)
 *  - how it was observed (adapter / method)
 *  - verification status at observation time
 *  - optional raw payload (sanitized, no credentials)
 *
 * Evidence is immutable. To update a claim you add a new EvidenceRecord.
 */
import { deterministicId } from "./ids.js";
import { VerificationStatus } from "./verification.js";

export type EvidenceKind =
  | "page_observation"
  | "link_observation"
  | "broken_link_observation"
  | "resource_page_observation"
  | "backlink_observation"
  | "competitor_backlink_observation"
  | "mention_observation"
  | "contact_observation"
  | "metric_observation"
  | "outcome_observation"
  | "acquired_link_observation"
  | "risk_observation";

export type EvidenceProviderKind =
  | "search"
  | "seo"
  | "crawl"
  | "serp"
  | "llm"
  | "contact"
  | "manual"
  | "sitemap"
  | "import"
  | "internal";

export interface EvidenceSource {
  /** Adapter or method that produced the evidence (e.g. "fixture", "sitemap", "ahrefs"). */
  adapter: string;
  /** Provider kind, if any (e.g. "search", "seo", "crawl", "manual"). */
  providerKind?: EvidenceProviderKind;
  /** Source URL, file path, or fixture id. */
  reference?: string;
  /** Optional fetch/crawl timestamp. */
  fetchedAt?: number;
}

export interface EvidenceRecord {
  id: string;
  kind: EvidenceKind;
  subjectId: string;
  claim: string;
  observedAt: number;
  source: EvidenceSource;
  verification: VerificationStatus;
  /** Sanitized payload (no credentials, no PII unless explicitly allowed with provenance). */
  payload?: Record<string, unknown>;
  /** Hash of canonical payload for tamper detection. */
  payloadHash?: string;
}

export interface EvidenceContract {
  record(e: Omit<EvidenceRecord, "id">): EvidenceRecord;
  for(subjectId: string): EvidenceRecord[];
  latest(subjectId: string, kind?: EvidenceKind): EvidenceRecord | undefined;
  all(): EvidenceRecord[];
}

export function makeEvidence(
  e: Omit<EvidenceRecord, "id">
): EvidenceRecord {
  const id = deterministicId("evidence", [e.subjectId, e.kind, e.observedAt, e.claim]);
  return { ...e, id };
}

export function canonicalPayloadHash(payload: unknown): string {
  // Lightweight FNV-style hash (no crypto needed; tamper detection only, not security).
  const json = JSON.stringify(sortKeys(payload));
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      out[k] = sortKeys((v as Record<string, unknown>)[k]);
    }
    return out;
  }
  return v;
}

/**
 * In-memory evidence store. In production this would be backed by a durable store.
 * Implements the EvidenceContract.
 */
export class InMemoryEvidenceStore implements EvidenceContract {
  private readonly records: Map<string, EvidenceRecord> = new Map();

  record(e: Omit<EvidenceRecord, "id">): EvidenceRecord {
    const rec = makeEvidence(e);
    this.records.set(rec.id, rec);
    return rec;
  }

  for(subjectId: string): EvidenceRecord[] {
    return [...this.records.values()].filter((r) => r.subjectId === subjectId);
  }

  latest(subjectId: string, kind?: EvidenceKind): EvidenceRecord | undefined {
    const list = this.for(subjectId).filter((r) => (kind ? r.kind === kind : true));
    return list.sort((a, b) => b.observedAt - a.observedAt)[0];
  }

  all(): EvidenceRecord[] {
    return [...this.records.values()];
  }
}
