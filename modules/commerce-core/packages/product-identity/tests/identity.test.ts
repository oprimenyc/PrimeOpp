import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProductIdentityResolver, LocalTestProductIdentityAdapter, inputFromBarcode, inputFromText, inputFromOcrAndImage } from '../src/index.ts';
import { toBarcodePayload } from '@primeopp/barcode';
import type { Product } from '@primeopp/contracts';

function fixtureProduct(): Product {
  return {
    id: 'p1',
    schemaVersion: '1.0.0',
    kind: 'PHYSICAL',
    title: 'Apple iPhone 13 128GB',
    brand: { name: 'Apple', normalized: 'APPLE', confidence: 0.99, source: 'fixture' },
    model: { name: 'iPhone 13', normalized: 'IPHONE 13', brand: 'APPLE', confidence: 0.95, source: 'fixture' },
    description: '',
    attributes: [],
    identifiers: [
      { type: 'UPC', value: '194253340276', source: 'fixture', verification: 'PROVIDER_VERIFIED', confidence: 1.0, observedAt: '2026-01-01T00:00:00Z' },
    ],
    variants: [],
    images: [],
    documents: [],
    source: { kind: 'SCAN', ref: 'fixture', observedAt: '2026-01-01T00:00:00Z', confidence: 0.95 },
    provenance: { originSource: { kind: 'SCAN', ref: 'fixture', observedAt: '2026-01-01T00:00:00Z', confidence: 0.95 }, observations: [], lineage: [] },
    ownership: { tenantId: 't1', private: true },
    listingState: 'UNLISTED',
    fulfillmentMode: 'SELLER_FULFILLED',
    channelState: {},
    evidence: { evidenceRefs: [], confidence: 0.9 },
    confidence: { overall: 0.9, identity: 0.95, variant: 0.9, condition: 0.8, pricing: 0.85 },
    version: 0,
    tenantId: 't1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

test('resolver returns EXACT_MATCH for barcode match', async () => {
  const adapter = new LocalTestProductIdentityAdapter([fixtureProduct()]);
  const resolver = new ProductIdentityResolver({ adapters: [adapter] });
  const payload = toBarcodePayload('194253340276');
  const result = await resolver.resolve(inputFromBarcode(payload), { tenantId: 't1' });
  assert.equal(result.state, 'EXACT_MATCH');
  assert.equal(result.candidates.length, 1);
  assert.equal(result.selectedCandidateId, 'p1');
});

test('resolver returns NO_MATCH when no candidates', async () => {
  const adapter = new LocalTestProductIdentityAdapter([fixtureProduct()]);
  const resolver = new ProductIdentityResolver({ adapters: [adapter] });
  const payload = toBarcodePayload('000000000000');
  const result = await resolver.resolve(inputFromBarcode(payload), { tenantId: 't1' });
  assert.equal(result.state, 'NO_MATCH');
  assert.equal(result.candidates.length, 0);
});

test('resolver returns HIGH_CONFIDENCE_MATCH or EXACT_MATCH for title+brand match', async () => {
  const adapter = new LocalTestProductIdentityAdapter([fixtureProduct()]);
  const resolver = new ProductIdentityResolver({ adapters: [adapter] });
  const result = await resolver.resolve(
    { title: 'iPhone 13', brand: 'Apple', model: 'iPhone 13' },
    { tenantId: 't1' },
  );
  // With all three fields matching, score is high — accept either HIGH_CONFIDENCE_MATCH or EXACT_MATCH.
  assert.ok(['HIGH_CONFIDENCE_MATCH', 'EXACT_MATCH'].includes(result.state));
  assert.equal(result.candidates[0].productId, 'p1');
});

test('resolver enforces tenant isolation', async () => {
  const adapter = new LocalTestProductIdentityAdapter([fixtureProduct()]);
  const resolver = new ProductIdentityResolver({ adapters: [adapter] });
  const payload = toBarcodePayload('194253340276');
  // Different tenant should get no candidates.
  const result = await resolver.resolve(inputFromBarcode(payload), { tenantId: 'other' });
  assert.equal(result.state, 'NO_MATCH');
});

test('resolver provides recommendedNextAction', async () => {
  const adapter = new LocalTestProductIdentityAdapter([fixtureProduct()]);
  const resolver = new ProductIdentityResolver({ adapters: [adapter] });
  const payload = toBarcodePayload('000000000000');
  const result = await resolver.resolve(inputFromBarcode(payload), { tenantId: 't1' });
  assert.equal(result.recommendedNextAction, 'create a new canonical product record');
});

test('inputFromText builds text-only input', () => {
  const i = inputFromText('Apple iPhone 13 128GB');
  assert.equal(i.text, 'Apple iPhone 13 128GB');
});
