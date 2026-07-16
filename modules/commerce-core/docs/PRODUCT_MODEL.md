# Canonical Product Model

The canonical product model lives in `packages/contracts/src/product.ts` and is capable of representing every product kind the platform supports.

## Product Kinds

```typescript
type ProductKind =
  | 'PHYSICAL' | 'DIGITAL' | 'POD' | 'DROPSHIP' | 'AFFILIATE'
  | 'SERVICE' | 'BUNDLE' | 'KIT' | 'LOT' | 'MULTIPACK'
  | 'SERIALIZED' | 'UNIQUE_COLLECTIBLE';
```

## Core Fields

Every `Product` has:

- **Identity**: `id`, `schemaVersion`, `title`, `brand`, `model`, `category`
- **Tenant scope**: `tenantId`, optional `organizationId`
- **Identifiers**: array of `ProductIdentifier` (UPC, EAN, GTIN, ISBN, ASIN, SKU, MPN, etc.)
- **Variants**: array of `ProductVariant` keyed by `attributeHash`
- **Condition**: optional `ConditionAssessment` (NEVER inferred from appearance alone)
- **Images and documents**: arrays of `ProductImage` and `ProductDocument`
- **Source and provenance**: `ProductSource` + lineage entries
- **Ownership**: `ProductOwnership` with tenant + optional consignor
- **Cost basis and acquisition**: optional `ProductCostBasis` and `ProductAcquisition`
- **Locations**: optional array of `ProductLocation`
- **Confidence**: `ProductConfidence` with per-dimension scores
- **Evidence**: `ProductEvidence` with refs and rationale
- **Lifecycle state**: `ProductListingState` and per-channel `ProductChannelState`

## Identifier Model

Every `ProductIdentifier` carries:

- `type` (UPC, EAN, ISBN, ASIN, SKU, MPN, MODEL_NUMBER, SERIAL_NUMBER, MARKETPLACE_LISTING_ID, RETAILER_PRODUCT_ID, INTERNAL_ID, CUSTOM_SELLER_ID, URL, CUSTOM)
- `value`
- `source` (where the identifier was observed)
- `verification` (UNVERIFIED, CHECK_DIGIT_VALID, PROVIDER_VERIFIED, HUMAN_CONFIRMED, CONFLICTED, INVALID)
- `confidence` in [0, 1]
- `observedAt` ISO 8601
- optional `expiresAt`, `evidenceRef`, `notes`

Never assume one barcode equals one exact product variant without evidence.
