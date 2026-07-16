import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalTestChannelAdapter, PrimeOppMarketplaceTestAdapter, createChannelRegistry, registerChannel, listChannels, runConformanceSuite, buildCapabilityManifest } from '../src/index.ts';

test('LocalTestChannelAdapter is test-only', () => {
  const a = new LocalTestChannelAdapter('test-channel');
  assert.equal(a.testOnly, true);
  const m = a.getCapabilityManifest();
  assert.equal(m.testOnly, true);
});

test('PrimeOppMarketplaceTestAdapter is test-only', () => {
  const a = new PrimeOppMarketplaceTestAdapter();
  assert.equal(a.testOnly, true);
  assert.equal(a.channelRef, 'primeopp-marketplace');
});

test('channel registry registers and lists', () => {
  const reg = createChannelRegistry();
  registerChannel(reg, new LocalTestChannelAdapter('a'));
  registerChannel(reg, new LocalTestChannelAdapter('b'));
  const channels = listChannels(reg);
  assert.equal(channels.length, 2);
});

test('publishListing rejects without userAccepted', async () => {
  const a = new LocalTestChannelAdapter('test');
  const fakeListing = {
    id: 'l1', tenantId: 't1', productId: 'p1', title: 'T', bullets: [], attributes: {},
    condition: 'NEW' as const, images: [], videoRefs: [],
    price: { amount: { amount: 10, currency: 'USD', precise: true, status: 'USER_ENTERED' as const }, acceptOffers: false },
    quantity: 1, shippingPolicy: { kind: 'CALCULATED' as const, localPickupOnly: false, internationalAllowed: false, returnAllowed: true },
    tags: [], seoKeywords: [], productIdentifiers: [], sellerDisclosures: [], channelOverrides: {},
    selectedChannels: ['test'], alsoListOnPrimeOppMarketplace: false, state: 'DRAFT' as const,
    channelStates: {}, version: 0, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  };
  const r = await a.publishListing({ listing: fakeListing, scope: { tenantId: 't1' }, userAccepted: false });
  assert.equal(r.success, false);
});

test('publishListing succeeds with userAccepted', async () => {
  const a = new LocalTestChannelAdapter('test');
  const fakeListing = {
    id: 'l1', tenantId: 't1', productId: 'p1', title: 'T', bullets: [], attributes: {},
    condition: 'NEW' as const, images: [], videoRefs: [],
    price: { amount: { amount: 10, currency: 'USD', precise: true, status: 'USER_ENTERED' as const }, acceptOffers: false },
    quantity: 1, shippingPolicy: { kind: 'CALCULATED' as const, localPickupOnly: false, internationalAllowed: false, returnAllowed: true },
    tags: [], seoKeywords: [], productIdentifiers: [], sellerDisclosures: [], channelOverrides: {},
    selectedChannels: ['test'], alsoListOnPrimeOppMarketplace: false, state: 'DRAFT' as const,
    channelStates: {}, version: 0, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  };
  const r = await a.publishListing({ listing: fakeListing, scope: { tenantId: 't1' }, userAccepted: true });
  assert.equal(r.success, true);
  assert.ok(r.externalListingId);
});

test('runConformanceSuite passes for local test adapter', async () => {
  const a = new LocalTestChannelAdapter('test');
  const results = await runConformanceSuite(a);
  for (const r of results) {
    assert.equal(r.passed, true, `${r.test}: ${r.message}`);
  }
});

test('buildCapabilityManifest includes all canonical conditions', () => {
  const m = buildCapabilityManifest({ channelRef: 'test', capabilities: ['PUBLISH_LISTING'] });
  assert.equal(m.conditionMappings.NEW, 'New');
  assert.equal(m.conditionMappings.DAMAGED, 'Damaged');
  assert.equal(m.conditionMappings.REFURBISHED, 'Refurbished');
});
