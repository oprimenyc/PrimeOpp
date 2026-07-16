# Fee Engine

The fee engine lives in `packages/fee-engine/src/index.ts`.

## Fee Types

15 types: MARKETPLACE_COMMISSION, PAYMENT_PROCESSING, LISTING_FEE, INSERTION_FEE, PROMOTION_FEE, AUTHENTICATION_FEE, FULFILLMENT_FEE, STORAGE_FEE, WITHDRAWAL_FEE, CURRENCY_CONVERSION, TAX_WITHHOLDING_ESTIMATE, RETURN_RESERVE, SHIPPING_LABEL_MARKUP, SUBSCRIPTION_ALLOCATION, CUSTOM_FEE.

## Fee Models

5 models: PERCENTAGE, FIXED, TIERED, CAPPED, MINIMUM.

## Versioned Schedules

Every `FeeScheduleEntry` carries `effectiveFrom` and optional `effectiveTo`. The `assessFees` function only applies entries that are currently effective, and flags stale entries (past `effectiveTo`) in the output.

## Scope Filtering

Entries can be scoped by:

- category
- sellerTier
- promotionRef
- marketplaceRef

`findApplicableEntry` picks the most specific entry for a given fee type.

## Critical Rule

**Never hardcode current marketplace fees as permanent business logic.** All fee schedules are loaded from configuration. The default PrimeOpp Marketplace schedule is illustrative only.

## Stale Fee Warnings

When any line item uses a stale entry, the assessment's `estimated` flag is set to true and `staleWarnings` lists the offending fee types.
