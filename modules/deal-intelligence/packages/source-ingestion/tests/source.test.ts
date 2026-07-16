import { describe, it, expect } from 'vitest';
import { ingest, precedenceFor, sortByPrecedence, assertNeverStripped } from '../src/index.js';

describe('source-ingestion', () => {
  it('precedence ranks official-api highest', () => {
    expect(precedenceFor('official-api')).toBe(1);
    expect(precedenceFor('retailer-feed')).toBe(1);
    expect(precedenceFor('affiliate-feed')).toBe(2);
    expect(precedenceFor('browser-operator')).toBe(4);
    expect(precedenceFor('community-submission')).toBe(5);
    expect(precedenceFor('manual-entry')).toBe(6);
  });
  it('ingest assigns id, precedence and freshness', () => {
    const obs = ingest({
      source: 'official-api',
      retailerId: 'ret:amazon',
      productIdentifier: { type: 'ASIN', value: 'B0XYZ' },
      timestamp: '2024-01-01T00:00:00Z',
      evidence: [],
      confidence: 0.9,
      extractionMethod: 'api'
    });
    expect(obs.id).toMatch(/^obs_/);
    expect(obs.precedence).toBe(1);
    expect(obs.freshness).toBeTruthy();
  });
  it('rejects missing retailerId', () => {
    expect(() => ingest({
      source: 'official-api',
      retailerId: '',
      productIdentifier: { type: 'ASIN', value: 'B0XYZ' },
      timestamp: '2024-01-01T00:00:00Z',
      evidence: [],
      confidence: 0.9,
      extractionMethod: 'api'
    })).toThrow();
  });
  it('sortByPrecedence picks best first', () => {
    const a = ingest({
      source: 'community-submission', retailerId: 'ret:amazon',
      productIdentifier: { type: 'ASIN', value: 'B0XYZ' },
      timestamp: '2024-01-01T00:00:00Z', evidence: [], confidence: 0.3,
      extractionMethod: 'manual'
    });
    const b = ingest({
      source: 'official-api', retailerId: 'ret:amazon',
      productIdentifier: { type: 'ASIN', value: 'B0XYZ' },
      timestamp: '2024-01-01T00:00:00Z', evidence: [], confidence: 0.95,
      extractionMethod: 'api'
    });
    const sorted = sortByPrecedence([a, b]);
    expect(sorted[0].source).toBe('official-api');
  });
  it('never strips provenance', () => {
    const obs = ingest({
      source: 'official-api', retailerId: 'ret:amazon',
      productIdentifier: { type: 'ASIN', value: 'B0XYZ' },
      timestamp: '2024-01-01T00:00:00Z', evidence: [{ id: 'e1', kind: 'api-payload', capturedAt: '2024-01-01T00:00:00Z', payloadRef: 'ref://1' }],
      confidence: 0.95, extractionMethod: 'api'
    });
    const provenance = assertNeverStripped(obs);
    expect(provenance).toContain('source');
    expect(provenance).toContain('retailerId');
    expect(provenance).toContain('evidence');
    expect(provenance).toContain('confidence');
  });
});
