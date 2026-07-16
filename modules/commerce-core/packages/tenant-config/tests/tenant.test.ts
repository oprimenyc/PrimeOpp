import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTenantConfig, createOrganization, createLocation, assertTenantAccess, filterByTenantScope, InMemoryTenantConfigStore } from '../src/index.ts';

test('createTenantConfig defaults primeOpp to true', () => {
  const c = createTenantConfig({ tenantId: 't1', name: 'Test' });
  assert.equal(c.defaultAlsoListOnPrimeOppMarketplace, true);
});

test('createTenantConfig can override primeOpp default', () => {
  const c = createTenantConfig({ tenantId: 't1', name: 'Test', defaultAlsoListOnPrimeOppMarketplace: false });
  assert.equal(c.defaultAlsoListOnPrimeOppMarketplace, false);
});

test('createOrganization populates required fields', () => {
  const o = createOrganization({ tenantId: 't1', name: 'Org1' });
  assert.equal(o.tenantId, 't1');
  assert.equal(o.name, 'Org1');
  assert.equal(o.defaultAlsoListOnPrimeOppMarketplace, true);
});

test('createLocation builds a location record', () => {
  const l = createLocation({ tenantId: 't1', label: 'Warehouse 1', kind: 'WAREHOUSE' });
  assert.equal(l.kind, 'WAREHOUSE');
  assert.equal(l.label, 'Warehouse 1');
});

test('assertTenantAccess throws on cross-tenant', () => {
  assert.throws(() => assertTenantAccess({ tenantId: 't1' }, 't2'), /CROSS_TENANT_ACCESS_DENIED/);
  assert.doesNotThrow(() => assertTenantAccess({ tenantId: 't1' }, 't1'));
});

test('filterByTenantScope filters out other tenants', () => {
  const records = [
    { id: 'a', tenantId: 't1' },
    { id: 'b', tenantId: 't2' },
    { id: 'c', tenantId: 't1' },
  ];
  const filtered = filterByTenantScope(records, { tenantId: 't1' });
  assert.equal(filtered.length, 2);
  assert.ok(filtered.every((r) => r.tenantId === 't1'));
});

test('InMemoryTenantConfigStore stores and retrieves configs', async () => {
  const store = new InMemoryTenantConfigStore();
  const c = createTenantConfig({ tenantId: 't1', name: 'Test' });
  await store.upsert(c);
  const r = await store.get('t1');
  assert.ok(r);
  assert.equal(r?.name, 'Test');
});

test('tenant config carries adapter secret refs (never raw secrets)', async () => {
  const c = createTenantConfig({
    tenantId: 't1', name: 'Test',
    adapterSecrets: { 'ebay': { ref: 'primevault://tenants/t1/secrets/ebay-api-key' } },
  });
  assert.ok(c.adapterSecrets.ebay);
  assert.equal(c.adapterSecrets.ebay.ref, 'primevault://tenants/t1/secrets/ebay-api-key');
  // No raw secret value should ever be in this object.
  assert.equal(JSON.stringify(c).includes('apiKeyValue'), false);
});
