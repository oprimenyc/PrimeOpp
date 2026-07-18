import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMarketplaceComparable,
  normalizeMarketplaceComparableSet,
  summarizeMarketplaceComparables
} from '@primeopp-marketplace/search-contracts';

describe('marketplace comparable normalization', () => {
  it('separates active listings from sold comparables', () => {
    const set = normalizeMarketplaceComparableSet([
      {
        marketplaceId: ' ebay ',
        listingId: 'active-1',
        title: 'Active shoe',
        currency: 'usd',
        askingPrice: 120
      },
      {
        marketplaceId: 'ebay',
        listingId: 'sold-1',
        title: 'Sold shoe',
        currency: 'USD',
        soldPrice: 100,
        shippingCost: 12,
        marketplaceFees: 3,
        soldDate: '2026-07-01T00:00:00Z'
      }
    ]);

    assert.equal(set.activeListings.length, 1);
    assert.equal(set.soldComparables.length, 1);
    assert.equal(set.soldComparables[0]!.buyerTotal?.amount, '115.00');
    assert.equal(set.soldComparables[0]!.askingPrice, null);
    assert.equal(set.activeListings[0]!.soldPrice, null);
  });

  it('rejects malformed records without throwing or inventing values', () => {
    const set = normalizeMarketplaceComparableSet([
      {
        marketplaceId: '',
        listingId: 'x',
        title: 'bad',
        currency: 'USD',
        askingPrice: 1
      },
      {
        marketplaceId: 'depop',
        listingId: 'no-price',
        title: 'bad',
        currency: 'USD'
      },
      {
        marketplaceId: 'depop',
        listingId: 'negative',
        title: 'bad',
        currency: 'USD',
        soldPrice: -1
      }
    ]);

    assert.equal(set.activeListings.length, 0);
    assert.equal(set.soldComparables.length, 0);
    assert.equal(set.rejected.length, 3);
    assert.deepEqual(set.rejected.map((failure) => failure.code), [
      'INVALID_COMPARABLE_ID',
      'COMPARABLE_PRICE_MISSING',
      'COMPARABLE_PRICE_MISSING'
    ]);
  });

  it('deduplicates by marketplace and listing id', () => {
    const set = normalizeMarketplaceComparableSet([
      {
        marketplaceId: 'stockx',
        listingId: 'same',
        title: 'first',
        currency: 'USD',
        askingPrice: 200
      },
      {
        marketplaceId: 'stockx',
        listingId: 'same',
        title: 'second',
        currency: 'USD',
        askingPrice: 180
      }
    ]);

    assert.equal(set.activeListings.length, 1);
    assert.equal(set.activeListings[0]!.rawTitle, 'second');
  });

  it('summarizes sold and active prices independently', () => {
    const set = normalizeMarketplaceComparableSet([
      { marketplaceId: 'goat', listingId: 's1', title: 'sold 1', currency: 'USD', soldPrice: 80, soldDate: '2026-06-01T00:00:00Z' },
      { marketplaceId: 'goat', listingId: 's2', title: 'sold 2', currency: 'USD', soldPrice: 120, soldDate: '2026-07-01T00:00:00Z' },
      { marketplaceId: 'goat', listingId: 'a1', title: 'active 1', currency: 'USD', askingPrice: 140 }
    ]);
    const summary = summarizeMarketplaceComparables(set);

    assert.equal(summary.soldComparablesCount, 2);
    assert.equal(summary.activeListingsCount, 1);
    assert.equal(summary.medianSoldPrice?.amount, '100.00');
    assert.equal(summary.medianAskingPrice?.amount, '140.00');
    assert.equal(summary.newestSoldDate, '2026-07-01T00:00:00.000Z');
  });

  it('returns warning details for invalid currency without using the invalid amount', () => {
    const result = normalizeMarketplaceComparable({
      marketplaceId: 'mercari',
      listingId: 'bad-currency',
      title: 'Bad currency',
      currency: 'BAD',
      askingPrice: 50
    });

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'COMPARABLE_PRICE_MISSING');
  });
});
