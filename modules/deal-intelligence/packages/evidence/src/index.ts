/**
 * @primeopp-deal-intelligence/evidence
 *
 * Evidence capture, redaction and verification. Provides a tamper-evident
 * chain-of-custody helper for runtime evidence.
 */
import type { Evidence, EvidenceId, EvidenceKind, ISO8601 } from '@primeopp-deal-intelligence/contracts';
import { nextId, nowIso } from '@primeopp-deal-intelligence/contracts';
import { createHash } from 'node:crypto';

export function captureEvidence(input: {
  kind: EvidenceKind;
  payload: string | Buffer;
  notes?: string;
  capturedAt?: ISO8601;
}): Evidence {
  const buf = typeof input.payload === 'string' ? Buffer.from(input.payload, 'utf-8') : input.payload;
  const hash = 'sha256:' + createHash('sha256').update(buf).digest('hex');
  return {
    id: nextId('evd') as EvidenceId,
    kind: input.kind,
    capturedAt: input.capturedAt ?? nowIso(),
    payloadRef: `evidence://${hash.slice('sha256:'.length, 16)}`,
    payloadHash: hash,
    redacted: false,
    notes: input.notes
  };
}

export function redactEvidence(e: Evidence, redactionReason: string): Evidence {
  return { ...e, redacted: true, notes: `Redacted: ${redactionReason}` };
}

export function verifyHash(payload: string | Buffer, expectedHash: string): boolean {
  const buf = typeof payload === 'string' ? Buffer.from(payload, 'utf-8') : payload;
  const actual = 'sha256:' + createHash('sha256').update(buf).digest('hex');
  return actual === expectedHash;
}

export function assertEvidenceChain(chain: Evidence[]): { ok: boolean; brokenAt?: number; reason?: string } {
  let prev: ISO8601 | null = null;
  for (let i = 0; i < chain.length; i++) {
    const e = chain[i]!;
    if (!e.payloadHash) return { ok: false, brokenAt: i, reason: 'missing payloadHash' };
    if (prev && Date.parse(e.capturedAt) < Date.parse(prev)) {
      return { ok: false, brokenAt: i, reason: 'capturedAt out of order' };
    }
    prev = e.capturedAt;
  }
  return { ok: true };
}

/** Strip PII patterns from text payloads. */
export function redactPii(text: string): string {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN-REDACTED]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL-REDACTED]')
    .replace(/\b(?:\d[ -]*?){13,16}\b/g, '[CARD-REDACTED]')
    .replace(/\b\d{5}(?:-\d{4})?\b/g, '[ZIP-REDACTED]');
}
