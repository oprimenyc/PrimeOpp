import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanonicalListing, validateListingForPublication, listingPreview, disablePrimeOppMarketplace, acceptSelectedChannels, transitionListingState, defaultShippingPolicy } from '../src/index.ts';

test('createCanonicalListing includes primeopp-marketplace by default', () => {
  const l = createCanonicalListing({
    productId: 'p1', title: 'Test', tenantId: 't1',
    price: { amount: { amount: 10, currency: 'USD', precise: true, status: 'USER_ENTERED' }, acceptOffers: false },
    quantity: 1, condition: 'NEW', selectedChannels: ['ebay-test-adapter'],
  });
  assert.equal(l.alsoListOnPrimeOppMarketplace, true);
  assert.ok(l.selectedChannels.includes('primeopp-marketplace'));
});

test('disablePrimeOppMarketplace removes primeopp-marketplace and produces evidence', () => {
  const l = createCanonicalListing({
    productId: 'p1', title: 'Test', tenantId: 't1',
    price: { amount: { amount: 10, currency: 'USD', precise: true, status: 'USER_ENTERED' }, acceptOffers: false },
    quantity: 1, condition: 'NEW', selectedChannels: ['ebay-test-adapter'],
  });
  const { listing, evidenceRef } = disablePrimeOppMarketplace(l, { reason: 'test', userRef: 'u1' });
  assert.equal(listing.alsoListOnPrimeOppMarketplace, false);
  assert.ok(!listing.selectedChannels.includes('primeopp-marketplace'));
  assert.ok(evidenceRef.startsWith('evidence/seller-acceptance/'));
  assert.equal(listing.sellerAcceptanceEvidenceRef, evidenceRef);
});

test('validateListingForPublication rejects missing seller acceptance', () => {
  const l = createCanonicalListing({
    productId: 'p1', title: 'Test', tenantId: 't1',
    price: { amount: { amount: 10, currency: 'USD', precise: true, status: 'USER_ENTERED' }, acceptOffers: false },
    quantity: 1, condition: 'NEW', selectedChannels: [],
  });
  const v = validateListingForPublication(l);
  assert.equal(v.valid, false);
  assert.ok(v.errors.some((e) => e.includes('seller acceptance')));
});

test('acceptSelectedChannels produces evidence', () => {
  const l = createCanonicalListing({
    productId: 'p1', title: 'Test', tenantId: 't1',
    price: { amount: { amount: 10, currency: 'USD', precise: true, status: 'USER_ENTERED' }, acceptOffers: false },
    quantity: 1, condition: 'NEW', selectedChannels: ['ebay-test-adapter'],
  });
  const { listing, evidenceRef } = acceptSelectedChannels(l, { userRef: 'u1' });
  assert.equal(listing.sellerAcceptanceEvidenceRef, evidenceRef);
});

test('transitionListingState enforces valid transitions', () => {
  const l = createCanonicalListing({
    productId: 'p1', title: 'Test', tenantId: 't1',
    price: { amount: { amount: 10, currency: 'USD', precise: true, status: 'USER_ENTERED' }, acceptOffers: false },
    quantity: 1, condition: 'NEW', selectedChannels: ['ebay-test-adapter'],
  });
  assert.equal(l.state, 'DRAFT');
  const ready = transitionListingState(l, 'READY');
  assert.equal(ready.state, 'READY');
  assert.throws(() => transitionListingState(l, 'ACTIVE'), /INVALID_TRANSITION/);
});

test('listingPreview shows selected channels with PrimeOpp marker', () => {
  const l = createCanonicalListing({
    productId: 'p1', title: 'Test', tenantId: 't1',
    price: { amount: { amount: 10, currency: 'USD', precise: true, status: 'USER_ENTERED' }, acceptOffers: false },
    quantity: 1, condition: 'NEW', selectedChannels: ['ebay-test-adapter'],
  });
  const preview = listingPreview(l);
  assert.ok(preview.includes('primeopp-marketplace'));
  assert.ok(preview.includes('PrimeOpp default ON'));
});

test('defaultShippingPolicy returns calculated shipping with returns', () => {
  const p = defaultShippingPolicy();
  assert.equal(p.kind, 'CALCULATED');
  assert.equal(p.returnAllowed, true);
  assert.equal(p.returnWindowDays, 30);
});

test('listing with alsoListOnPrimeOppMarketplace=true but no primeopp channel fails validation', () => {
  // Manually construct an inconsistent listing.
  const l = createCanonicalListing({
    productId: 'p1', title: 'Test', tenantId: 't1',
    price: { amount: { amount: 10, currency: 'USD', precise: true, status: 'USER_ENTERED' }, acceptOffers: false },
    quantity: 1, condition: 'NEW', selectedChannels: [],
  });
  // Force the inconsistent state.
  const inconsistent = { ...l, selectedChannels: ['ebay-test-adapter'] };
  const v = validateListingForPublication(inconsistent);
  assert.equal(v.valid, false);
  assert.ok(v.errors.some((e) => e.includes('alsoListOnPrimeOppMarketplace')));
});
