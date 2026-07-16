import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSdk } from '../src/index.ts';

test('SDK initializes with all engines', () => {
  const sdk = createSdk({ tenantId: 't1' });
  assert.ok(sdk.catalog);
  assert.ok(sdk.inventory);
  assert.ok(sdk.identityResolver);
  assert.ok(sdk.eventSink);
  assert.ok(sdk.testAdapters);
});

test('SDK validates barcode', () => {
  const sdk = createSdk({ tenantId: 't1' });
  const r = sdk.validateBarcode('036000291452');
  assert.equal(r.valid, true);
});

test('SDK assesses fees with primeopp schedule', () => {
  const sdk = createSdk({ tenantId: 't1' });
  const a = sdk.assessFees({ marketplaceRef: 'primeopp-marketplace', basis: { amount: 100, currency: 'USD', precise: false, status: 'AUTHORITATIVE' } });
  assert.equal(a.total.amount, 11.2);
});

test('SDK estimates shipping', () => {
  const sdk = createSdk({ tenantId: 't1' });
  const est = sdk.estimateShipping({
    packageSpec: { kind: 'SMALL', weight: 2, weightUnit: 'LB', length: 10, width: 8, height: 6, dimensionUnit: 'IN' },
    scope: sdk.scope,
  });
  assert.ok(est.estimatedRange.midpoint.amount > 0);
});

test('SDK creates listing with PrimeOpp default ON', () => {
  const sdk = createSdk({ tenantId: 't1' });
  const l = sdk.createCanonicalListing({
    productId: 'p1', title: 'Test', tenantId: 't1',
    price: { amount: { amount: 10, currency: 'USD', precise: true, status: 'USER_ENTERED' }, acceptOffers: false },
    quantity: 1, condition: 'NEW', selectedChannels: [],
  });
  assert.equal(l.alsoListOnPrimeOppMarketplace, true);
  assert.ok(l.selectedChannels.includes('primeopp-marketplace'));
});

test('SDK can opt out of PrimeOpp Marketplace', () => {
  const sdk = createSdk({ tenantId: 't1' });
  const l = sdk.createCanonicalListing({
    productId: 'p1', title: 'Test', tenantId: 't1',
    price: { amount: { amount: 10, currency: 'USD', precise: true, status: 'USER_ENTERED' }, acceptOffers: false },
    quantity: 1, condition: 'NEW', selectedChannels: [],
  });
  const { listing } = sdk.disablePrimeOppMarketplace(l, { userRef: 'u1' });
  assert.equal(listing.alsoListOnPrimeOppMarketplace, false);
});

test('SDK initializes tenant config', async () => {
  const sdk = createSdk({ tenantId: 't1' });
  const cfg = await sdk.initTenantConfig({ name: 'Test Tenant' });
  assert.equal(cfg.tenantId, 't1');
  assert.equal(cfg.name, 'Test Tenant');
});

test('SDK buildVariant works', () => {
  const sdk = createSdk({ tenantId: 't1' });
  const v = sdk.buildVariant('p1', [{ axis: 'COLOR', value: 'Red', source: 's', confidence: 0.9 }]);
  assert.ok(v.id);
  assert.equal(v.attributeHash.length, 16);
});

test('SDK calculates profit', () => {
  const sdk = createSdk({ tenantId: 't1' });
  const r = sdk.calculateProfit({
    productId: 'p1',
    listingPrice: { amount: 100, currency: 'USD', precise: true, status: 'ACTUAL' },
    costBasis: { amount: 50, currency: 'USD', precise: true, status: 'ACTUAL' },
    inboundCost: { amount: 5, currency: 'USD', precise: true, status: 'ACTUAL' },
    taxTreatment: 'EXCLUDED',
    scope: sdk.scope,
  });
  assert.ok(r.netProfit.amount > 0);
});
