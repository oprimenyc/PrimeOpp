import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTestAdapterRegistry } from '../src/index.ts';

test('buildTestAdapterRegistry returns all four adapter families', () => {
  const r = buildTestAdapterRegistry();
  assert.ok(r.barcode);
  assert.ok(r.ocr);
  assert.ok(r.imageMatch);
  assert.ok(r.channels);
  assert.ok(r.primeOpp);
});

test('all test adapters are clearly labeled TEST-ONLY in manifests', () => {
  const r = buildTestAdapterRegistry();
  for (const [id, m] of r.manifests) {
    assert.ok(m.termsRestrictions && m.termsRestrictions.some((t) => t.includes('TEST-ONLY')), `adapter ${id} missing TEST-ONLY marker`);
  }
});

test('primeopp adapter has channelRef "primeopp-marketplace"', () => {
  const r = buildTestAdapterRegistry();
  assert.equal(r.primeOpp.channelRef, 'primeopp-marketplace');
  assert.equal(r.primeOpp.testOnly, true);
});

test('channel registry contains primeopp + ebay test adapters', () => {
  const r = buildTestAdapterRegistry();
  assert.ok(r.channels.has('primeopp-marketplace'));
  assert.ok(r.channels.has('ebay-test-adapter'));
});
