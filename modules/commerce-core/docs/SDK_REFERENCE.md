# SDK Reference

The SDK lives in `packages/sdk/src/index.ts`.

## Creating an SDK

```typescript
import { createSdk } from '@primeopp/sdk';
const sdk = createSdk({ tenantId: 'my-tenant', organizationId: 'my-org' });
```

## Available Methods

| Method | Description |
|---|---|
| `validateBarcode(value, format?)` | Validate a barcode value. |
| `toBarcodePayload(value, format?)` | Convert a value to a BarcodePayload. |
| `resolveProductIdentity(input)` | Resolve a product identity from input. |
| `createProduct(product, actor?)` | Create a product in the catalog. |
| `getProduct(productId)` | Get a product by ID. |
| `listProducts(opts?)` | List products in tenant scope. |
| `inventoryOp(op)` | Execute an inventory operation. |
| `assessCondition(input)` | Assess condition from input. |
| `createPricingObservation(opts)` | Create a pricing observation. |
| `priceProduct(input)` | Price a product. |
| `assessFees(opts)` | Assess marketplace fees. |
| `estimateShipping(input)` | Estimate shipping. |
| `calculateProfit(input)` | Calculate profit and ROI. |
| `scoreOpportunity(input)` | Score an opportunity. |
| `createCanonicalListing(opts)` | Create a canonical listing. |
| `validateListingForPublication(listing)` | Validate a listing. |
| `listingPreview(listing)` | Get a text preview. |
| `disablePrimeOppMarketplace(listing, opts)` | Opt out of PrimeOpp Marketplace. |
| `acceptSelectedChannels(listing, opts)` | Accept selected channels. |
| `buildVariant(productId, attributes, opts?)` | Build a variant. |
| `detectVariantConflicts(a, b)` | Detect variant conflicts. |
| `initTenantConfig(opts)` | Initialize tenant config. |

## Pre-Wired Components

The SDK comes pre-wired with:

- In-memory evidence store
- In-memory catalog storage with audit log
- In-memory inventory storage
- In-memory tenant config store
- Default PrimeOpp Marketplace fee schedule
- Test-only channel adapters (PrimeOpp + ebay-test-adapter)
- Test-only barcode, OCR, and image-match adapters
