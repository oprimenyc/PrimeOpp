import { describe, it, expect } from 'vitest';
import { captureEvidence, redactEvidence, verifyHash, assertEvidenceChain, redactPii } from '../src/index.js';

describe('evidence', () => {
  it('captureEvidence assigns id, hash and ref', () => {
    const e = captureEvidence({ kind: 'structured-json', payload: '{"p":1}' });
    expect(e.id).toMatch(/^evd_/);
    expect(e.payloadHash).toMatch(/^sha256:/);
    expect(e.payloadRef).toMatch(/^evidence:/);
  });
  it('verifyHash matches for same payload', () => {
    const e = captureEvidence({ kind: 'manual-observation', payload: 'hello' });
    expect(verifyHash('hello', e.payloadHash!)).toBe(true);
    expect(verifyHash('world', e.payloadHash!)).toBe(false);
  });
  it('redactEvidence marks redacted', () => {
    const e = captureEvidence({ kind: 'photo', payload: 'x' });
    const r = redactEvidence(e, 'PII');
    expect(r.redacted).toBe(true);
    expect(r.notes).toContain('Redacted');
  });
  it('assertEvidenceChain detects out-of-order timestamps', () => {
    const a = captureEvidence({ kind: 'manual-observation', payload: 'a', capturedAt: '2024-01-02T00:00:00Z' });
    const b = captureEvidence({ kind: 'manual-observation', payload: 'b', capturedAt: '2024-01-01T00:00:00Z' });
    const r = assertEvidenceChain([a, b]);
    expect(r.ok).toBe(false);
    expect(r.brokenAt).toBe(1);
  });
  it('redactPii strips emails, SSNs, ZIPs', () => {
    const out = redactPii('Contact user@example.com SSN 123-45-6789 ZIP 12345');
    expect(out).toContain('[EMAIL-REDACTED]');
    expect(out).toContain('[SSN-REDACTED]');
    expect(out).toContain('[ZIP-REDACTED]');
  });
});
