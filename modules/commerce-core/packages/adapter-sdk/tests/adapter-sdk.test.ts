import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAdapterRegistry, registerBarcodeAdapter, registerOCRAdapter, registerImageMatchAdapter, registerChannelAdapter, buildManifest, COMMON_CONFORMANCE_TESTS, runAdapterConformanceTests, defaultHealthCheck, adapterCapabilityManifest } from '../src/index.ts';
import { LocalBarcodeLookupAdapter } from '@primeopp/barcode';
import { LocalTestOCRAdapter } from '@primeopp/ocr-contracts';
import { LocalTestImageMatchAdapter } from '@primeopp/image-match-contracts';
import { LocalTestChannelAdapter } from '@primeopp/channel-contracts';

test('createAdapterRegistry returns empty maps', () => {
  const r = createAdapterRegistry();
  assert.equal(r.barcode.size, 0);
  assert.equal(r.ocr.size, 0);
  assert.equal(r.imageMatch.size, 0);
  assert.equal(r.channel.size, 0);
});

test('registerBarcodeAdapter adds to registry', () => {
  const r = createAdapterRegistry();
  const a = new LocalBarcodeLookupAdapter();
  registerBarcodeAdapter(r, buildManifest({ adapterId: a.adapterId, version: a.version, capabilities: a.capabilities, authenticationRequirements: 'NONE', dataSensitivity: 'TENANT', termsRestrictions: [] }), a);
  assert.equal(r.barcode.size, 1);
});

test('common conformance tests pass for valid manifest', async () => {
  const manifest = buildManifest({ adapterId: 'a1', version: '1.0.0', capabilities: ['LOOKUP'], authenticationRequirements: 'NONE', dataSensitivity: 'TENANT', termsRestrictions: [] });
  const results = await runAdapterConformanceTests(null, manifest, COMMON_CONFORMANCE_TESTS);
  for (const r of results) {
    assert.equal(r.passed, true, `${r.name}: ${r.message}`);
  }
});

test('common conformance tests fail for missing adapterId', async () => {
  const manifest = buildManifest({ adapterId: '', version: '1.0.0', capabilities: ['LOOKUP'], authenticationRequirements: 'NONE', dataSensitivity: 'TENANT', termsRestrictions: [] });
  const results = await runAdapterConformanceTests(null, manifest, COMMON_CONFORMANCE_TESTS);
  assert.ok(results.some((r) => !r.passed && r.name === 'manifest-declares-id-and-version'));
});

test('defaultHealthCheck returns healthy', async () => {
  const r = await defaultHealthCheck('a1');
  assert.equal(r.healthy, true);
});

test('adapterCapabilityManifest summarizes manifest', () => {
  const manifest = buildManifest({ adapterId: 'a1', version: '1.0.0', capabilities: ['LOOKUP'], authenticationRequirements: 'API_KEY', dataSensitivity: 'TENANT', termsRestrictions: [], supportedRegions: ['US'], supportedCategories: ['ELECTRONICS'] });
  const summary = adapterCapabilityManifest(manifest);
  assert.equal(summary.adapterId, 'a1');
  assert.equal(summary.authenticationRequirements, 'API_KEY');
  assert.deepEqual(summary.supportedRegions, ['US']);
});
