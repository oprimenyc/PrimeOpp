# Listing Contracts

Listing contracts live in `packages/listing-contracts/src/index.ts`.

## Canonical Listing

A `CanonicalListing` carries:

- identity: id, productId, variantId, title, subtitle, description, bullets
- classification: category, attributes, condition, conditionNotes
- media: images (evidence refs), videoRefs
- pricing: ListingPrice (amount, minimumOffer, acceptOffers)
- inventory: quantity, sku, locationId
- shipping: ShippingPolicy
- metadata: tags, seoKeywords, authenticityData, productIdentifiers, sellerDisclosures
- channel: channelOverrides, selectedChannels, alsoListOnPrimeOppMarketplace, sellerAcceptanceEvidenceRef
- lifecycle: state, channelStates, version

## Lifecycle States

11 states: DRAFT, READY, APPROVAL_REQUIRED, APPROVED, PUBLISHING, ACTIVE, PAUSED, SOLD, ENDED, ERROR, NEEDS_ATTENTION, ARCHIVED.

`transitionListingState` enforces valid transitions (e.g. DRAFT → READY → APPROVED → PUBLISHING → ACTIVE).

## One Canonical Listing → Many Channels

The same `CanonicalListing` can be distributed to multiple channels. Per-channel overrides live in `channelOverrides`. Per-channel state lives in `channelStates`.

## Validation

`validateListingForPublication` checks:

- title present and ≤ 80 chars (warning if longer)
- quantity ≥ 0
- price > 0
- at least one image (warning if missing)
- at least one channel selected
- seller acceptance evidence present
- PrimeOpp default flag consistency

## Listing Preview

`listingPreview(listing)` produces a human-readable summary showing all selected channels with PrimeOpp default ON/OFF markers.
