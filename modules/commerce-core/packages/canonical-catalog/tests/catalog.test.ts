import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryCatalogStorage, CanonicalCatalog, InMemoryCatalogAuditLog, detectStaleProducts, detectDuplicates } from '../src/index.ts';
import type { Product } from '@primeopp/contracts';

function fixtureProduct(id: string, tenantId = 't1'): Product {
  return {
    id, schemaVersion: '1.0.0', kind: 'PHYSICAL', title: `Product ${id}`,
    attributes: [],
    identifiers: [{ type: 'UPC', value: `upc-${id}`, source: 'fixture', verification: 'PROVIDER_VERIFIED', confidence: 0.95, observedAt: '2026-01-01T00:00:00Z' }],
    variants: [], images: [], documents: [],
    source: { kind: 'SCAN', ref: 'fixture', observedAt: '2026-01-01T00:00:00Z', confidence: 0.95 },
    provenance: { originSource: { kind: 'SCAN', ref: 'fixture', observedAt: '2026-01-01T00:00:00Z', confidence: 0.95 }, observations: [], lineage: [] },
    ownership: { tenantId, private: true },
    listingState: 'UNLISTED', fulfillmentMode: 'SELLER_FULFILLED', channelState: {},
    evidence: { evidenceRefs: [], confidence: 0.9 },
    confidence: { overall: 0.9, identity: 0.9, variant: 0.9, condition: 0.8, pricing: 0.85 },
    version: 0, tenantId, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  };
}

test('catalog create + get works', async () => {
  const storage = new InMemoryCatalogStorage();
  const cat = new CanonicalCatalog({ storage });
  const p = fixtureProduct('p1');
  await cat.create(p, 'actor');
  const got = await cat.get('p1', { tenantId: 't1' });
  assert.ok(got);
  assert.equal(got?.id, 'p1');
});

test('catalog create refuses archived product', async () => {
  const storage = new InMemoryCatalogStorage();
  const cat = new CanonicalCatalog({ storage });
  const p = { ...fixtureProduct('p1'), archived: true };
  await assert.rejects(() => cat.create(p, 'actor'), /archived/);
});

test('catalog update increments version', async () => {
  const storage = new InMemoryCatalogStorage();
  const cat = new CanonicalCatalog({ storage });
  await cat.create(fixtureProduct('p1'), 'actor');
  const updated = await cat.update('p1', (p) => ({ ...p, title: 'Updated' }), { tenantId: 't1' }, 'actor');
  assert.equal(updated.title, 'Updated');
  assert.equal(updated.version, 1);
});

test('catalog archive + unarchive', async () => {
  const storage = new InMemoryCatalogStorage();
  const cat = new CanonicalCatalog({ storage });
  await cat.create(fixtureProduct('p1'), 'actor');
  const archived = await cat.archive('p1', { tenantId: 't1' }, 'actor');
  assert.equal(archived.archived, true);
  const unarchived = await cat.unarchive('p1', { tenantId: 't1' }, 'actor');
  assert.equal(unarchived.archived, false);
});

test('catalog list excludes archived by default', async () => {
  const storage = new InMemoryCatalogStorage();
  const cat = new CanonicalCatalog({ storage });
  await cat.create(fixtureProduct('p1'), 'actor');
  await cat.create(fixtureProduct('p2'), 'actor');
  await cat.archive('p1', { tenantId: 't1' }, 'actor');
  const list = await cat.list({ tenantId: 't1' });
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'p2');
  const listAll = await cat.list({ tenantId: 't1' }, { includeArchived: true });
  assert.equal(listAll.length, 2);
});

test('catalog merge combines identifiers', async () => {
  const storage = new InMemoryCatalogStorage();
  const cat = new CanonicalCatalog({ storage });
  await cat.create(fixtureProduct('p1'), 'actor');
  await cat.create(fixtureProduct('p2'), 'actor');
  const merged = await cat.merge('p2', 'p1', { tenantId: 't1' }, 'actor', ['evidence1']);
  assert.ok(merged.identifiers.some((i) => i.value === 'upc-p2'));
  assert.ok(merged.identifiers.some((i) => i.value === 'upc-p1'));
  const source = await cat.get('p2', { tenantId: 't1' });
  assert.equal(source?.archived, true);
});

test('catalog split creates a new product', async () => {
  const storage = new InMemoryCatalogStorage();
  const cat = new CanonicalCatalog({ storage });
  await cat.create(fixtureProduct('p1'), 'actor');
  const { original, newProduct } = await cat.split('p1', { tenantId: 't1' }, 'actor', ['evidence1']);
  assert.notEqual(original.id, newProduct.id);
  assert.ok(newProduct.identifiers.length > 0);
});

test('catalog search by title', async () => {
  const storage = new InMemoryCatalogStorage();
  const cat = new CanonicalCatalog({ storage });
  await cat.create(fixtureProduct('p1'), 'actor');
  await cat.create(fixtureProduct('p2'), 'actor');
  const r = await cat.search({ tenantId: 't1' }, { title: 'p1' });
  assert.equal(r.length, 1);
  assert.equal(r[0].id, 'p1');
});

test('catalog search by identifier', async () => {
  const storage = new InMemoryCatalogStorage();
  const cat = new CanonicalCatalog({ storage });
  await cat.create(fixtureProduct('p1'), 'actor');
  const r = await cat.search({ tenantId: 't1' }, { identifier: 'upc-p1' });
  assert.equal(r.length, 1);
});

test('catalog enforces tenant isolation', async () => {
  const storage = new InMemoryCatalogStorage();
  const cat = new CanonicalCatalog({ storage });
  await cat.create(fixtureProduct('p1', 't1'), 'actor');
  // Tenant t2 cannot see t1's product.
  const got = await cat.get('p1', { tenantId: 't2' });
  assert.equal(got, undefined);
});

test('detectDuplicates finds colliding identifiers', () => {
  const a = fixtureProduct('p1');
  const b = fixtureProduct('p2');
  // Force identifier collision.
  b.identifiers[0].value = 'upc-p1';
  const dups = detectDuplicates([a, b]);
  assert.ok(dups.size > 0);
});

test('detectStaleProducts flags old entries', () => {
  const old = { ...fixtureProduct('p1'), updatedAt: '2020-01-01T00:00:00Z' };
  const stale = detectStaleProducts([old], 60);
  assert.equal(stale.length, 1);
});

test('catalog audit log records operations', async () => {
  const storage = new InMemoryCatalogStorage();
  const audit = new InMemoryCatalogAuditLog();
  const cat = new CanonicalCatalog({ storage, auditLog: audit });
  await cat.create(fixtureProduct('p1'), 'actor1');
  const entries = audit.list('t1');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].action, 'CREATE');
  assert.equal(entries[0].actor, 'actor1');
});
