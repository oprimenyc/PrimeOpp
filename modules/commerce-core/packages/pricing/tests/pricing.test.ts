import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceProduct, createPricingObservation, groupObservations, observationsAreComparable, buildPricingInputFromMarketplaceComparables } from '../src/index.ts';

test('priceProduct with no comps returns zero-confidence range', () => {
  const r = priceProduct({
    productId: 'p1',
    condition: 'GOOD',
    activeComps: [],
    soldComps: [],
    strategy: 'BALANCED',
    scope: { tenantId: 't1' },
  });
  assert.equal(r.comparableCount, 0);
  assert.equal(r.estimatedMarketValue.midpoint.amount, 0);
  assert.ok(r.warnings.some((w) => w.includes('no comparable')));
});

test('priceProduct with 3 sold comps uses soldMedian', () => {
  const sold = [
    createPricingObservation({ productId: 'p1', condition: 'GOOD', price: { amount: 100, currency: 'USD', precise: true, status: 'ACTUAL' }, currency: 'USD', quantity: 1, source: 'MARKETPLACE_SOLD_LISTING', listingStatus: 'SOLD', confidence: 0.95, evidenceRefs: [], scope: { tenantId: 't1' } }),
    createPricingObservation({ productId: 'p1', condition: 'GOOD', price: { amount: 110, currency: 'USD', precise: true, status: 'ACTUAL' }, currency: 'USD', quantity: 1, source: 'MARKETPLACE_SOLD_LISTING', listingStatus: 'SOLD', confidence: 0.95, evidenceRefs: [], scope: { tenantId: 't1' } }),
    createPricingObservation({ productId: 'p1', condition: 'GOOD', price: { amount: 120, currency: 'USD', precise: true, status: 'ACTUAL' }, currency: 'USD', quantity: 1, source: 'MARKETPLACE_SOLD_LISTING', listingStatus: 'SOLD', confidence: 0.95, evidenceRefs: [], scope: { tenantId: 't1' } }),
  ];
  const r = priceProduct({ productId: 'p1', condition: 'GOOD', activeComps: [], soldComps: sold, strategy: 'BALANCED', scope: { tenantId: 't1' } });
  assert.equal(r.estimatedMarketValue.midpoint.amount, 110);
  assert.equal(r.estimatedMarketValue.low.amount, 100);
  assert.equal(r.estimatedMarketValue.high.amount, 120);
  assert.equal(r.comparableCount, 3);
});

test('priceProduct with active-only warns about sell-through', () => {
  const active = [
    createPricingObservation({ productId: 'p1', condition: 'GOOD', price: { amount: 100, currency: 'USD', precise: true, status: 'ACTUAL' }, currency: 'USD', quantity: 1, source: 'MARKETPLACE_ACTIVE_LISTING', listingStatus: 'ACTIVE', confidence: 0.7, evidenceRefs: [], scope: { tenantId: 't1' } }),
  ];
  const r = priceProduct({ productId: 'p1', condition: 'GOOD', activeComps: active, soldComps: [], strategy: 'BALANCED', scope: { tenantId: 't1' } });
  assert.ok(r.warnings.some((w) => w.includes('active listings only')));
});

test('observationsAreComparable rejects mixed variants', () => {
  const obs = [
    createPricingObservation({ productId: 'p1', variantId: 'v1', condition: 'GOOD', price: { amount: 100, currency: 'USD', precise: true, status: 'ACTUAL' }, currency: 'USD', quantity: 1, source: 'MARKETPLACE_SOLD_LISTING', listingStatus: 'SOLD', confidence: 0.95, evidenceRefs: [], scope: { tenantId: 't1' } }),
    createPricingObservation({ productId: 'p1', variantId: 'v2', condition: 'GOOD', price: { amount: 100, currency: 'USD', precise: true, status: 'ACTUAL' }, currency: 'USD', quantity: 1, source: 'MARKETPLACE_SOLD_LISTING', listingStatus: 'SOLD', confidence: 0.95, evidenceRefs: [], scope: { tenantId: 't1' } }),
  ];
  const r = observationsAreComparable(obs);
  assert.equal(r.safe, false);
  assert.ok(r.reasons.some((rs) => rs.includes('multiple variants')));
});

test('observationsAreComparable rejects mixed conditions', () => {
  const obs = [
    createPricingObservation({ productId: 'p1', condition: 'GOOD', price: { amount: 100, currency: 'USD', precise: true, status: 'ACTUAL' }, currency: 'USD', quantity: 1, source: 'MARKETPLACE_SOLD_LISTING', listingStatus: 'SOLD', confidence: 0.95, evidenceRefs: [], scope: { tenantId: 't1' } }),
    createPricingObservation({ productId: 'p1', condition: 'NEW', price: { amount: 100, currency: 'USD', precise: true, status: 'ACTUAL' }, currency: 'USD', quantity: 1, source: 'MARKETPLACE_SOLD_LISTING', listingStatus: 'SOLD', confidence: 0.95, evidenceRefs: [], scope: { tenantId: 't1' } }),
  ];
  const r = observationsAreComparable(obs);
  assert.equal(r.safe, false);
});

test('observationsAreComparable rejects mixed bundle and single', () => {
  const obs = [
    createPricingObservation({ productId: 'p1', condition: 'GOOD', price: { amount: 100, currency: 'USD', precise: true, status: 'ACTUAL' }, currency: 'USD', quantity: 1, source: 'MARKETPLACE_SOLD_LISTING', listingStatus: 'SOLD', confidence: 0.95, evidenceRefs: [], scope: { tenantId: 't1' } }),
    createPricingObservation({ productId: 'p1', condition: 'GOOD', price: { amount: 200, currency: 'USD', precise: true, status: 'ACTUAL' }, currency: 'USD', quantity: 4, source: 'MARKETPLACE_SOLD_LISTING', listingStatus: 'SOLD', confidence: 0.95, evidenceRefs: [], scope: { tenantId: 't1' } }),
  ];
  const r = observationsAreComparable(obs);
  assert.equal(r.safe, false);
  assert.ok(r.reasons.some((rs) => rs.includes('bundle')));
});

test('QUICK_FLIP strategy lowers recommended list price', () => {
  const sold = [
    createPricingObservation({ productId: 'p1', condition: 'GOOD', price: { amount: 100, currency: 'USD', precise: true, status: 'ACTUAL' }, currency: 'USD', quantity: 1, source: 'MARKETPLACE_SOLD_LISTING', listingStatus: 'SOLD', confidence: 0.95, evidenceRefs: [], scope: { tenantId: 't1' } }),
    createPricingObservation({ productId: 'p1', condition: 'GOOD', price: { amount: 110, currency: 'USD', precise: true, status: 'ACTUAL' }, currency: 'USD', quantity: 1, source: 'MARKETPLACE_SOLD_LISTING', listingStatus: 'SOLD', confidence: 0.95, evidenceRefs: [], scope: { tenantId: 't1' } }),
    createPricingObservation({ productId: 'p1', condition: 'GOOD', price: { amount: 120, currency: 'USD', precise: true, status: 'ACTUAL' }, currency: 'USD', quantity: 1, source: 'MARKETPLACE_SOLD_LISTING', listingStatus: 'SOLD', confidence: 0.95, evidenceRefs: [], scope: { tenantId: 't1' } }),
  ];
  const balanced = priceProduct({ productId: 'p1', condition: 'GOOD', activeComps: [], soldComps: sold, strategy: 'BALANCED', scope: { tenantId: 't1' } });
  const flip = priceProduct({ productId: 'p1', condition: 'GOOD', activeComps: [], soldComps: sold, strategy: 'QUICK_FLIP', scope: { tenantId: 't1' } });
  assert.ok(flip.recommendedListPrice.amount < balanced.recommendedListPrice.amount);
});

test('custom listing price overrides recommended', () => {
  const sold = [
    createPricingObservation({ productId: 'p1', condition: 'GOOD', price: { amount: 100, currency: 'USD', precise: true, status: 'ACTUAL' }, currency: 'USD', quantity: 1, source: 'MARKETPLACE_SOLD_LISTING', listingStatus: 'SOLD', confidence: 0.95, evidenceRefs: [], scope: { tenantId: 't1' } }),
    createPricingObservation({ productId: 'p1', condition: 'GOOD', price: { amount: 110, currency: 'USD', precise: true, status: 'ACTUAL' }, currency: 'USD', quantity: 1, source: 'MARKETPLACE_SOLD_LISTING', listingStatus: 'SOLD', confidence: 0.95, evidenceRefs: [], scope: { tenantId: 't1' } }),
    createPricingObservation({ productId: 'p1', condition: 'GOOD', price: { amount: 120, currency: 'USD', precise: true, status: 'ACTUAL' }, currency: 'USD', quantity: 1, source: 'MARKETPLACE_SOLD_LISTING', listingStatus: 'SOLD', confidence: 0.95, evidenceRefs: [], scope: { tenantId: 't1' } }),
  ];
  const r = priceProduct({
    productId: 'p1', condition: 'GOOD', activeComps: [], soldComps: sold, strategy: 'BALANCED',
    customListingPrice: { amount: 200, currency: 'USD', precise: true, status: 'USER_ENTERED' },
    scope: { tenantId: 't1' },
  });
  assert.equal(r.recommendedListPrice.amount, 200);
  assert.equal(r.recommendedListPrice.status, 'USER_ENTERED');
});

test('groupObservations filters cross-tenant', () => {
  const obs = [
    createPricingObservation({ productId: 'p1', condition: 'GOOD', price: { amount: 100, currency: 'USD', precise: true, status: 'ACTUAL' }, currency: 'USD', quantity: 1, source: 'MARKETPLACE_SOLD_LISTING', listingStatus: 'SOLD', confidence: 0.95, evidenceRefs: [], scope: { tenantId: 't2' } }),
  ];
  const g = groupObservations(obs, { productId: 'p1', condition: 'GOOD', scope: { tenantId: 't1' } });
  assert.equal(g.sold.length, 0);
  assert.ok(g.warnings.length > 0);
});

test('buildPricingInputFromMarketplaceComparables wires normalized marketplace comps into pricing', () => {
  const built = buildPricingInputFromMarketplaceComparables({
    productId: 'p-market',
    condition: 'GOOD',
    strategy: 'BALANCED',
    scope: { tenantId: 't1' },
    comparableSet: {
      activeListings: [
        {
          marketplaceId: 'ebay',
          listingId: 'active-1',
          rawTitle: 'Active comp',
          condition: 'GOOD',
          askingPrice: { amount: '140.00', currency: 'USD' },
          soldPrice: null,
          shippingCost: null,
          marketplaceFees: null,
          listingStatus: 'ACTIVE_LISTING',
          soldDate: null,
          evidenceTimestamp: '2026-07-01T00:00:00.000Z'
        }
      ],
      soldComparables: [
        {
          marketplaceId: 'ebay',
          listingId: 'sold-1',
          rawTitle: 'Sold comp 1',
          condition: 'GOOD',
          askingPrice: null,
          soldPrice: { amount: '100.00', currency: 'USD' },
          shippingCost: { amount: '8.00', currency: 'USD' },
          marketplaceFees: null,
          listingStatus: 'SOLD_COMPARABLE',
          soldDate: '2026-06-01T00:00:00.000Z',
          evidenceTimestamp: '2026-06-02T00:00:00.000Z'
        },
        {
          marketplaceId: 'ebay',
          listingId: 'sold-2',
          rawTitle: 'Sold comp 2',
          condition: 'GOOD',
          askingPrice: null,
          soldPrice: { amount: '120.00', currency: 'USD' },
          shippingCost: null,
          marketplaceFees: null,
          listingStatus: 'SOLD_COMPARABLE',
          soldDate: '2026-06-03T00:00:00.000Z'
        },
        {
          marketplaceId: 'ebay',
          listingId: 'sold-3',
          rawTitle: 'Sold comp 3',
          condition: 'GOOD',
          askingPrice: null,
          soldPrice: { amount: '110.00', currency: 'USD' },
          shippingCost: null,
          marketplaceFees: null,
          listingStatus: 'SOLD_COMPARABLE',
          soldDate: '2026-06-04T00:00:00.000Z'
        }
      ]
    }
  });

  assert.equal(built.rejected.length, 0);
  assert.equal(built.input.activeComps.length, 1);
  assert.equal(built.input.soldComps.length, 3);

  const priced = priceProduct(built.input);
  assert.equal(priced.estimatedMarketValue.midpoint.amount, 110);
  assert.equal(priced.comparableCount, 4);
});

test('buildPricingInputFromMarketplaceComparables rejects malformed comp prices without inventing observations', () => {
  const built = buildPricingInputFromMarketplaceComparables({
    productId: 'p-market',
    condition: 'GOOD',
    strategy: 'BALANCED',
    scope: { tenantId: 't1' },
    comparableSet: {
      activeListings: [
        {
          marketplaceId: 'depop',
          listingId: 'bad-active',
          rawTitle: 'Bad active',
          condition: 'GOOD',
          askingPrice: { amount: 'not-a-number', currency: 'USD' },
          soldPrice: null,
          shippingCost: null,
          marketplaceFees: null,
          listingStatus: 'ACTIVE_LISTING',
          soldDate: null
        }
      ],
      soldComparables: []
    }
  });

  assert.equal(built.input.activeComps.length, 0);
  assert.equal(built.input.soldComps.length, 0);
  assert.equal(built.rejected.length, 1);
});
