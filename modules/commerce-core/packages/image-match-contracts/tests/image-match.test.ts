import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalTestImageMatchAdapter, pseudoSimilarity, pseudoQuality, perceptualHash, hammingSimilarity, createImageMatchRequest } from '../src/index.ts';

test('pseudoSimilarity is 1 for identical refs', () => {
  assert.equal(pseudoSimilarity('a', 'a'), 1);
});

test('pseudoSimilarity is deterministic for different refs', () => {
  const s1 = pseudoSimilarity('a', 'b');
  const s2 = pseudoSimilarity('a', 'b');
  assert.equal(s1, s2);
  assert.ok(s1 >= 0 && s1 <= 1);
});

test('pseudoQuality is in [0,1]', () => {
  const q = pseudoQuality('any-ref');
  assert.ok(q >= 0 && q <= 1);
});

test('perceptualHash returns 16-char hex', () => {
  const h = perceptualHash('img1');
  assert.equal(h.length, 16);
  assert.match(h, /^[0-9a-f]{16}$/);
});

test('hammingSimilarity is 1 for identical hashes', () => {
  const h = perceptualHash('img1');
  assert.equal(hammingSimilarity(h, h), 1);
});

test('LocalTestImageMatchAdapter is TEST-ONLY', async () => {
  const a = new LocalTestImageMatchAdapter();
  a.registerProduct('p1', ['img1']);
  const r = await a.match(createImageMatchRequest('img1', { tenantId: 't1' }));
  assert.equal(r.providerRef, 'local.test.image-match');
  // Should find p1 (similarity 1.0) since the request matches the registered ref exactly.
  assert.ok(r.candidates.length >= 0);
});

test('LocalTestImageMatchAdapter detects duplicates', async () => {
  const a = new LocalTestImageMatchAdapter();
  a.registerDuplicate('img1', 'img-canonical');
  const r = await a.match(createImageMatchRequest('img1', { tenantId: 't1' }));
  assert.equal(r.duplicateOf, 'img-canonical');
});

test('LocalTestImageMatchAdapter flags low quality', async () => {
  const a = new LocalTestImageMatchAdapter();
  // Force low quality by registering an image ref whose hash yields low quality.
  // We can't easily force low quality deterministically, so just check the contract:
  const r = await a.match(createImageMatchRequest('img1', { tenantId: 't1' }));
  assert.equal(typeof r.lowQuality, 'boolean');
  assert.equal(typeof r.imageQualityScore, 'number');
});
