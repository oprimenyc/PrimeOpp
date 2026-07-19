import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCanonicalProductFromResolutionResult,
  createCanonicalProductFromResolutionResult,
  InMemoryCatalogStorage,
  CanonicalCatalog,
  InMemoryCatalogAuditLog,
  detectStaleProducts,
  detectDuplicates,
} from '../src/index.ts';
import type { Product } from '@primeopp/contracts';
import type { ResolutionResult } from '@primeopp/product-identity';
import { toBarcodePayload } from '@primeopp/barcode';

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

function noMatchResolution(overrides: Partial<ResolutionResult> = {}): ResolutionResult {
  return {
    id: 'resolution-1',
    tenantId: 't1',
    input: {
      barcode: toBarcodePayload('036000291452'),
      title: 'Apple iPhone 13 128GB',
      brand: 'Apple',
      model: 'iPhone 13',
      category: 'Electronics > Phones',
    },
    state: 'NO_MATCH',
    candidates: [],
    explanation: ['state=NO_MATCH'],
    warnings: [],
    recommendedNextAction: 'create a new canonical product record',
    confidence: 0,
    evidenceRefs: ['scan:evidence-1'],
    createdAt: '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

function creationContext() {
  return {
    actor: 'host-user-1',
    ownership: { tenantId: 't1', private: true },
    kind: 'PHYSICAL' as const,
    listingState: 'UNLISTED' as const,
    fulfillmentMode: 'SELLER_FULFILLED' as const,
    source: {
      kind: 'SCAN' as const,
      ref: 'scan:event-1',
      observedAt: '2026-01-02T00:00:00Z',
    },
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

test('buildCanonicalProductFromResolutionResult creates minimal product from NO_MATCH resolution and host context', () => {
  const { product, warnings } = buildCanonicalProductFromResolutionResult(noMatchResolution(), creationContext());
  assert.equal(product.tenantId, 't1');
  assert.equal(product.ownership.tenantId, 't1');
  assert.equal(product.kind, 'PHYSICAL');
  assert.equal(product.listingState, 'UNLISTED');
  assert.equal(product.fulfillmentMode, 'SELLER_FULFILLED');
  assert.equal(product.title, 'Apple iPhone 13 128GB');
  assert.equal(product.brand?.normalized, 'APPLE');
  assert.equal(product.model?.normalized, 'IPHONE 13');
  assert.equal(product.category?.leaf, 'Phones');
  assert.equal(product.source.kind, 'SCAN');
  assert.equal(product.source.ref, 'scan:event-1');
  assert.deepEqual(product.identifiers.map((i) => [i.type, i.value, i.verification]), [
    ['UPC_A', '036000291452', 'CHECK_DIGIT_VALID'],
  ]);
  assert.deepEqual(warnings, []);
});

test('buildCanonicalProductFromResolutionResult is deterministic for identical inputs', () => {
  const first = buildCanonicalProductFromResolutionResult(noMatchResolution(), creationContext()).product;
  const second = buildCanonicalProductFromResolutionResult(noMatchResolution(), creationContext()).product;
  assert.deepEqual(first, second);
});

test('deterministic product id is based on resolved identity, not source event metadata', () => {
  const first = buildCanonicalProductFromResolutionResult(noMatchResolution(), creationContext()).product;
  const second = buildCanonicalProductFromResolutionResult(noMatchResolution(), {
    ...creationContext(),
    source: {
      kind: 'AI_ENRICHMENT',
      ref: 'enrichment:event-2',
      observedAt: '2026-01-03T00:00:00Z',
      confidence: 0.4,
    },
  }).product;
  assert.equal(first.id, second.id);
});

test('createCanonicalProductFromResolutionResult calls CanonicalCatalog.create', async () => {
  const storage = new InMemoryCatalogStorage();
  const audit = new InMemoryCatalogAuditLog();
  const catalog = new CanonicalCatalog({ storage, auditLog: audit });
  const { product } = await createCanonicalProductFromResolutionResult(catalog, noMatchResolution(), creationContext());
  const stored = await catalog.get(product.id, { tenantId: 't1' });
  assert.equal(stored?.id, product.id);
  assert.equal(audit.list('t1', product.id)[0].action, 'CREATE');
});

test('canonical product creation rejects resolution states with candidates', () => {
  const resolution = noMatchResolution({
    state: 'EXACT_MATCH',
    candidates: [{
      productId: 'existing',
      confidence: 1,
      matchedFields: ['barcode'],
      conflictingFields: [],
      missingFields: [],
      evidenceRefs: [],
      source: 'fixture',
    }],
    selectedCandidateId: 'existing',
  });
  assert.throws(
    () => buildCanonicalProductFromResolutionResult(resolution, creationContext()),
    /only NO_MATCH/
  );
});

test('canonical product creation rejects tenant scope mismatch', () => {
  assert.throws(
    () => buildCanonicalProductFromResolutionResult(noMatchResolution(), {
      ...creationContext(),
      ownership: { tenantId: 'other', private: true },
    }),
    /TENANT_SCOPE_MISMATCH/
  );
});

test('canonical product creation rejects missing product title', () => {
  const resolution = noMatchResolution({ input: { barcode: toBarcodePayload('036000291452') } });
  assert.throws(
    () => buildCanonicalProductFromResolutionResult(resolution, creationContext()),
    /CANONICAL_PRODUCT_TITLE_REQUIRED/
  );
});

test('canonical product creation preserves invalid barcode as explicit warning', () => {
  const resolution = noMatchResolution({
    input: {
      barcode: toBarcodePayload('000000000001'),
      title: 'Barcode-only known product',
    },
  });
  const { product, warnings } = buildCanonicalProductFromResolutionResult(resolution, creationContext());
  assert.equal(product.identifiers[0].verification, 'INVALID');
  assert.match(warnings[0], /invalid check digit/);
});
