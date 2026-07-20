import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InMemoryCatalogStorage, InMemoryCatalogAuditLog } from '@primeopp/canonical-catalog';
import { InMemoryDeduplicationStore, InMemoryIntakeRecordRepository } from 'primeopp-product-intake';
import type { RawProductInput } from 'primeopp-product-intake';
import { ingestProduct, FileCatalogStorage, FileIntakeStore } from '../src/index.ts';
import type { IngestProductOptions } from '../src/index.ts';

const FIXTURE_BARCODE: RawProductInput = { rawValue: '036000291452', inputMethod: 'HARDWARE_SCANNER' };

function freshOptions(overrides: Partial<IngestProductOptions> = {}): IngestProductOptions {
  return {
    scope: { tenantId: 't1' },
    actor: 'test-actor',
    catalogStorage: new InMemoryCatalogStorage(),
    intakeDedupStore: new InMemoryDeduplicationStore(),
    ...overrides,
  };
}

test('empty/zero state: a fresh catalog has no products before any ingestion', async () => {
  const catalogStorage = new InMemoryCatalogStorage();
  const list = await catalogStorage.list('t1');
  assert.deepEqual(list, []);
});

test('success path: manual product entry creates a canonical product and persists it', async () => {
  const opts = freshOptions();
  const result = await ingestProduct(
    { inputMethod: 'MANUAL_PRODUCT', manualProduct: { title: 'Acme Widget X1', brand: 'Acme', model: 'X1' } },
    opts
  );
  assert.equal(result.outcome, 'CREATED');
  if (result.outcome !== 'CREATED') throw new Error('unreachable');
  assert.equal(result.product.title, 'Acme Widget X1');
  assert.equal(result.product.brand?.normalized, 'ACME');

  const stored = await opts.catalogStorage.get('t1', result.product.id);
  assert.equal(stored?.id, result.product.id);
});

test('success path: a recognized barcode is enriched via the local fixture provider and creates a canonical product', async () => {
  const opts = freshOptions();
  const result = await ingestProduct(FIXTURE_BARCODE, opts);
  assert.equal(result.outcome, 'CREATED');
  if (result.outcome !== 'CREATED') throw new Error('unreachable');
  assert.match(result.product.title, /Kraft/);
  assert.ok(result.product.identifiers.some((i) => i.value === '036000291452'));
});

test('failure path: insufficient manual data is rejected at intake, before enrichment ever runs', async () => {
  const opts = freshOptions();
  const result = await ingestProduct(
    { inputMethod: 'MANUAL_PRODUCT', manualProduct: { description: 'no title, no brand+model' } },
    opts
  );
  assert.equal(result.outcome, 'INTAKE_REJECTED');
  if (result.outcome !== 'INTAKE_REJECTED') throw new Error('unreachable');
  assert.match(result.reason, /title.*brand and model/i);
});

test('failure path: a checksum-invalid identifier with no manual data has no eligible enrichment provider', async () => {
  const opts = freshOptions();
  // Same value used in primeopp-product-intake's own test suite to assert
  // NEEDS_REVIEW with isValidFormat=false for a bad UPC checksum.
  const result = await ingestProduct({ rawValue: '036000291453', inputMethod: 'MANUAL_IDENTIFIER' }, opts);
  assert.equal(result.outcome, 'NO_ENRICHMENT_DATA');
});

test('failure path: a valid but unrecognized barcode enriches to NOT_FOUND', async () => {
  const opts = freshOptions();
  // Valid-checksum EAN-13 that does not appear in the local demo fixture set.
  const result = await ingestProduct({ rawValue: '5901234123457', inputMethod: 'MANUAL_IDENTIFIER' }, opts);
  assert.equal(result.outcome, 'ENRICHMENT_NOT_FOUND');
});

test('duplicate/idempotency: re-submitting the identical identifier is caught at the intake stage', async () => {
  const opts = freshOptions();
  const first = await ingestProduct(FIXTURE_BARCODE, opts);
  assert.equal(first.outcome, 'CREATED');
  const second = await ingestProduct(FIXTURE_BARCODE, opts);
  assert.equal(second.outcome, 'INTAKE_DUPLICATE');
});

test('duplicate/idempotency: a fresh intake session against the same persisted catalog is caught by identity resolution, not just intake dedup', async () => {
  const sharedCatalog = new InMemoryCatalogStorage();
  const first = await ingestProduct(
    FIXTURE_BARCODE,
    freshOptions({ catalogStorage: sharedCatalog, intakeDedupStore: new InMemoryDeduplicationStore() })
  );
  assert.equal(first.outcome, 'CREATED');

  // A brand-new intake dedup store simulates a separate session/process where
  // intake-level duplicate detection has no memory of the first submission.
  const second = await ingestProduct(
    FIXTURE_BARCODE,
    freshOptions({ catalogStorage: sharedCatalog, intakeDedupStore: new InMemoryDeduplicationStore() })
  );
  assert.equal(second.outcome, 'ALREADY_IN_CATALOG');

  const list = await sharedCatalog.list('t1');
  assert.equal(list.length, 1, 'identity resolution must prevent a duplicate canonical product from being created');
});

test('audit log records the canonical product creation when supplied', async () => {
  const auditLog = new InMemoryCatalogAuditLog();
  const opts = freshOptions({ auditLog });
  const result = await ingestProduct(FIXTURE_BARCODE, opts);
  assert.equal(result.outcome, 'CREATED');
  if (result.outcome !== 'CREATED') throw new Error('unreachable');
  const entries = auditLog.list('t1', result.product.id);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].action, 'CREATE');
  assert.equal(entries[0].actor, 'test-actor');
});

test('intake record repository persists the intake record when supplied', async () => {
  const intakeRepo = new InMemoryIntakeRecordRepository();
  const opts = freshOptions({ intakeRepo });
  const result = await ingestProduct(FIXTURE_BARCODE, opts);
  assert.equal(result.outcome, 'CREATED');
  const all = await intakeRepo.findAll();
  assert.equal(all.length, 1);
  assert.equal(all[0].status, 'ACCEPTED');
});

test('file-backed storage persists real state across separate instances pointed at the same path (simulating separate CLI invocations)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'primeopp-pipeline-test-'));
  try {
    const catalogPath = join(dir, 'catalog.json');
    const intakePath = join(dir, 'intake.json');

    const first = await ingestProduct(FIXTURE_BARCODE, {
      scope: { tenantId: 't1' },
      actor: 'cli',
      catalogStorage: new FileCatalogStorage(catalogPath),
      intakeDedupStore: new FileIntakeStore(intakePath),
    });
    assert.equal(first.outcome, 'CREATED');

    // Brand-new instances constructed from scratch, pointed at the same
    // files -- there is no shared in-memory object between this call and the
    // one above, only the files on disk.
    const second = await ingestProduct(FIXTURE_BARCODE, {
      scope: { tenantId: 't1' },
      actor: 'cli',
      catalogStorage: new FileCatalogStorage(catalogPath),
      intakeDedupStore: new FileIntakeStore(intakePath),
    });
    assert.equal(second.outcome, 'INTAKE_DUPLICATE');

    const persisted = await new FileCatalogStorage(catalogPath).list('t1');
    assert.equal(persisted.length, 1);
    assert.match(persisted[0].title, /Kraft/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('file-backed catalog storage starts empty when no file exists yet (fresh install)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'primeopp-pipeline-test-'));
  try {
    const storage = new FileCatalogStorage(join(dir, 'does-not-exist-yet.json'));
    const list = await storage.list('t1');
    assert.deepEqual(list, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
