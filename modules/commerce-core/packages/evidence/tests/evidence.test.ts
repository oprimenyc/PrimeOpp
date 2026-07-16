import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryEvidenceStore, buildEvidenceRecord, verifyEvidenceIntegrity, contentHash, assertEvidenceTenantAccess } from '../src/index.ts';

test('buildEvidenceRecord computes contentHash', () => {
  const r = buildEvidenceRecord({ tenantId: 't1', kind: 'SCAN', content: 'hello' });
  assert.ok(r.contentHash);
  assert.equal(r.contentHash.length, 16);
});

test('verifyEvidenceIntegrity accepts matching content', () => {
  const r = buildEvidenceRecord({ tenantId: 't1', kind: 'SCAN', content: 'hello' });
  assert.equal(verifyEvidenceIntegrity(r, 'hello'), true);
  assert.equal(verifyEvidenceIntegrity(r, 'world'), false);
});

test('InMemoryEvidenceStore records and retrieves', async () => {
  const store = new InMemoryEvidenceStore();
  const r = await store.recordWithContent({ tenantId: 't1', kind: 'SCAN', content: 'hello' });
  const got = await store.get(r.id);
  assert.ok(got);
  assert.equal(got?.tenantId, 't1');
});

test('InMemoryEvidenceStore verifies integrity', async () => {
  const store = new InMemoryEvidenceStore();
  const r = await store.recordWithContent({ tenantId: 't1', kind: 'SCAN', content: 'hello' });
  assert.equal(await store.verify(r.id), true);
});

test('InMemoryEvidenceStore list filters by tenant', async () => {
  const store = new InMemoryEvidenceStore();
  await store.recordWithContent({ tenantId: 't1', kind: 'SCAN', content: 'a' });
  await store.recordWithContent({ tenantId: 't2', kind: 'SCAN', content: 'b' });
  const t1List = await store.list('t1');
  assert.equal(t1List.length, 1);
});

test('contentHash is deterministic', () => {
  assert.equal(contentHash({ a: 1, b: 2 }), contentHash({ b: 2, a: 1 }));
});

test('assertEvidenceTenantAccess denies cross-tenant', () => {
  const r = buildEvidenceRecord({ tenantId: 't1', kind: 'SCAN', content: 'x' });
  assert.throws(() => assertEvidenceTenantAccess(r, { tenantId: 't2' }), /CROSS_TENANT_EVIDENCE_ACCESS_DENIED/);
  assert.doesNotThrow(() => assertEvidenceTenantAccess(r, { tenantId: 't1' }));
});
