import { describe, it, expect } from 'vitest';
import { createPrimeOppSdk } from '../src/index.js';
import { money } from '@primeopp-deal-intelligence/contracts';

describe('PrimeOppSdk', () => {
  it('initializes with 20 retailers and test-only alert adapters', () => {
    const sdk = createPrimeOppSdk();
    expect(sdk.retailerCount()).toBe(20);
    expect(sdk.listRetailers().length).toBe(20);
  });
  it('end-to-end: ingest, normalize, score, validate', () => {
    const sdk = createPrimeOppSdk();
    const obs = sdk.ingestObservation({
      source: 'official-api', retailerId: 'ret:amazon',
      productIdentifier: { type: 'ASIN', value: 'B0XYZ12345' },
      timestamp: '2024-01-01T00:00:00Z', evidence: [], confidence: 0.95,
      extractionMethod: 'api'
    });
    expect(obs.id).toBeTruthy();
    const prod = sdk.normalizeProduct({ sourceTitle: 'Echo Dot B0XYZ12345', brand: 'amazon' });
    expect(prod.candidate.identifiers.length).toBeGreaterThan(0);
    const offer = sdk.normalizeOffer({
      retailerId: 'ret:amazon' as any,
      productId: prod.candidate.id,
      prices: { base: money(10000), sale: money(5000) },
      availability: { state: 'IN_STOCK', confidence: 0.9, lastCheckedAt: '2024-01-01T00:00:00Z', source: 'fixture' },
      source: { sourceMethod: 'public-product-page', extractionMethod: 'fixture', precedence: 4 },
      evidence: [{ id: 'e1', kind: 'structured-json', capturedAt: '2024-01-01T00:00:00Z', payloadRef: 'r' }]
    });
    const v = sdk.validateDeal({ offer, product: prod.candidate });
    expect(['VERIFIED','VERIFIED_WITH_CONDITIONS']).toContain(v.state);
    const s = sdk.scoreDeal({ offer, product: prod.candidate });
    expect(s.overall.value).toBeGreaterThan(0);
  });
  it('emits observability events', () => {
    const sdk = createPrimeOppSdk();
    sdk.ingestObservation({
      source: 'manual-entry', retailerId: 'ret:amazon',
      productIdentifier: { type: 'ASIN', value: 'X' },
      timestamp: '2024-01-01T00:00:00Z', evidence: [], confidence: 0.5,
      extractionMethod: 'manual'
    });
    expect(sdk.observability.listEvents().length).toBeGreaterThan(0);
  });
});
