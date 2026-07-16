# Pricing Observations

Pricing observation types and helpers live in `packages/pricing/src/index.ts`.

## Sources

10 sources: RETAILER_LISTING, MARKETPLACE_ACTIVE_LISTING, MARKETPLACE_SOLD_LISTING, AUCTION_RESULT, LOCAL_MARKETPLACE, WHOLESALE_CATALOG, SELLER_PROVIDED_COMP, HISTORICAL_RECORD, MANUAL_OBSERVATION, AFFILIATE_FEED.

## Required Fields

Every `PricingObservation` carries:

- product identity (productId, optional variantId)
- condition (canonical)
- price (Money)
- shipping (optional)
- currency
- quantity
- listing status (ACTIVE / SOLD / ENDED / UNKNOWN)
- observedAt
- confidence
- evidence refs
- freshness (seconds since observation)
- optional authenticity status

## Comparability Rules

`observationsAreComparable(obs)` rejects observations that mix:

- multiple variants
- multiple conditions
- active and sold listings
- multiple currencies
- bundle and single-unit listings

## Freshness Weight

`freshnessWeight(observedAt)` returns a weight in [0, 1] using a 30-day half-life. Older observations contribute less to the pricing estimate.

## Grouping

`groupObservations(obs, opts)` filters by tenant, product, variant, condition, and listing status. Returns separate `active` and `sold` arrays plus warnings for rejected observations.
