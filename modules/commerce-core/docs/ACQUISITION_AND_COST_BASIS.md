# Acquisition and Cost Basis

Acquisition and cost basis types live in `packages/contracts/src/product.ts`.

## Acquisition Methods

15 methods: RETAIL_PURCHASE, ONLINE_PURCHASE, THRIFT_PURCHASE, ESTATE_SALE, GARAGE_SALE, AUCTION, LIQUIDATION_PALLET, WHOLESALE, CONSIGNMENT, DONATION, TRADE, PERSONAL_INVENTORY, MANUFACTURED_POD, DROPSHIP, AFFILIATE, TRANSFER.

## Cost Line Items

A `ProductCostBasis` carries 12 optional cost line items:

- purchasePrice, tax, inboundShipping, buyerFees, inspection, repair, cleaning, authentication
- storage, labor, packaging
- other (array)

Each line item is tagged with `EpistemicStatus` (ACTUAL, AUTHORITATIVE, ESTIMATED, USER_ENTERED, UNKNOWN).

## Lot Allocation

For lot/pallet purchases, `lotAllocation` records the lot total, units in lot, and per-unit allocated cost.

## Critical Rule

**Never treat estimated costs as actual costs without marking them.** Every cost line carries its own epistemic status, and `hasEstimated` is true if any component is estimated.

## Currency

Cost basis uses a single currency. `exchangeRateRef` is a Prime Vault-style reference for multi-currency acquisitions.
