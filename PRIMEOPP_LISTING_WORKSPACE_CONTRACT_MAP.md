# PrimeOpp Listing Workspace Contract Map

Date: 2026-07-22
Repo: `C:\Users\jp718\Documents\GitHub\PrimeOpp`

## Summary

The corrected model is a crosslisting command center, not a public marketplace. Current live ecommerce/admin code remains intact. This pass adds a local listing workspace surface that creates canonical packages, local channel drafts, and local export packages with direct publish disabled.

## Contract Map

| Concept | Path/files | Exists | Live | DB table/schema | API route | UI route | Test coverage | Blocker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Current product table/model | `lib/db/migrations/0001_base_schema.sql`, `artifacts/api-server/src/routes/products.ts`, `artifacts/primeopp/src/lib/api.ts` | YES | YES | `products` | `/api/products` | `/admin`, storefront product pages | Existing API/build/typecheck coverage | Product model is storefront-centric, not listing-workspace source of truth |
| Current admin product create/edit flow | `artifacts/primeopp/src/pages/admin.tsx`, `artifacts/api-server/src/routes/products.ts` | YES | YES | `products` | `POST/PUT/DELETE /api/products` | `/admin` | Existing build/typecheck; product route covered indirectly | Product CRUD implies catalog publication, not crosslisting draft preparation |
| Current storefront product display | `artifacts/primeopp/src/pages/home.tsx`, `catalog.tsx`, `product.tsx`, `ProductCard.tsx` | YES | YES | `products` | `GET /api/products`, `GET /api/products/:id` | `/`, `/collections`, `/product/:id` | Existing build/typecheck | Storefront remains separate from listing workspace |
| Current order surface | `artifacts/api-server/src/routes/orders.ts`, `artifacts/primeopp/src/pages/customer.tsx`, `admin-orders.tsx` | YES | YES | `orders`, fulfillment/job tables | `/api/orders/*`, `/api/orders/lookup` | `/orders`, `/admin/orders` | Existing fail-closed payment tests | Order surface is current ecommerce only, not third-party listing transaction handling |
| Current contact surface | `lib/db/migrations/0007_contact_messages.sql`, `artifacts/api-server/src/routes/contact.ts`, `static-pages.tsx` | YES | YES | `contact_messages` | `/api/contact` | `/contact` | Build/typecheck | No blocker for listing workspace |
| Current wishlist surface | `artifacts/primeopp/src/lib/wishlist.ts`, `customer.tsx`, `product.tsx` | PARTIAL | YES | Browser local storage only | None | `/wishlist` | Build/typecheck | Local-only customer wishlist, unrelated to listing workspace |
| Product-intake identifier logic | `modules/product-intake/primeopp-product-intake/src/domain/identifier-detector.ts` | YES | NO | Module-local repository only | None in live API | None in live UI | Module tests exist | Not wired into live API; this pass adds lightweight classifier in API generator only |
| Enrichment outputs | `modules/product-enrichment/primeopp-product-enrichment/src`, `README.md`, `VERIFICATION.md` | YES | NO | Module-local contracts/cache | None in live API | None in live UI | Module tests exist | No live provider configured; no fake lookup added |
| Commerce-core canonical product/listing contracts | `modules/commerce-core/docs`, `modules/commerce-core/packages/*`, `schemas/*` | YES | NO | Module-local contracts | None in live API | None in live UI | Module tests/evidence exist | Not wired to live app; V1 uses a smaller API-local canonical package model |
| Marketplace/channel models | `modules/marketplace-platform/packages/canonical-listing`, `channel-registry`, `listing-transformer`, `listing-publisher` | YES | NO | Module-local packages and fixtures | None in live API | None in live UI | Module workflow tests/evidence exist | External publish is not live and remains disabled |
| Listing package model | `lib/db/migrations/0008_low_liability_listing_workspace.sql`, `artifacts/api-server/src/lib/listingWorkspace.ts` | YES | YES after migration/deploy | `canonical_listing_packages` | `POST /api/listings/packages` | `/admin/listings` | `artifacts/api-server/tests/listing-workspace.test.ts` | Requires migration applied before live package creation |
| Channel draft/export model | `lib/db/migrations/0008_low_liability_listing_workspace.sql`, `listingWorkspace.ts`, `routes/listings.ts` | YES | YES after migration/deploy | `channel_listing_drafts`, `listing_export_packages` | `POST /api/listings/packages` | `/admin/listings` | Focused generator/static tests | JSON export implemented; CSV is schema-supported but not generated in V1 |
| Connected account shell | `lib/db/migrations/0008_low_liability_listing_workspace.sql`, `routes/listings.ts`, `listing-workspace.tsx` | YES | YES after migration/deploy | `marketplace_account_connections` | `GET /api/listings/account-connections` | `/admin/listings` | Focused static/default tests | Connect button is shell-only; no credential capture or OAuth/provider flow |
| Disabled publish controls | `listingWorkspace.ts`, `listing-workspace.tsx` | YES | YES after deploy | Draft `publish_disabled_reason`; connection defaults | `POST /api/listings/packages` response | `/admin/listings` | Focused tests assert disabled mode | Future direct publish requires new approval and provider work |
| Camera scan/search intake shell | `listing-workspace.tsx` | PARTIAL | YES after deploy | Captured as `intake_source` | `POST /api/listings/packages` accepts `SCAN`/`SEARCH` | `/admin/listings` | Static UI test asserts shell exists | Camera image capture has no decoder; search has no provider lookup yet |
| Manual entry fallback | `listing-workspace.tsx`, `listingPackageSchema`, `listingWorkspace.ts` | YES | YES after deploy | `intake_source='MANUAL_FALLBACK'` allowed | `POST /api/listings/packages` | `/admin/listings` | Focused generator test | Fallback only by product direction; not primary product promise |

## Current Low-Liability Contract

`POST /api/listings/packages`

Input:

```json
{
  "source": "SCAN",
  "identifier": "123456789012",
  "product": {
    "title": "Operator entered title",
    "description": "Operator entered description",
    "images": [],
    "category": "category",
    "condition": "condition",
    "sizeVariant": "variant",
    "costBasis": 12,
    "targetPrice": 30,
    "shippingProfile": "standard"
  },
  "selectedChannels": ["general-resale"],
  "createExports": true
}
```

Output:

```json
{
  "canonicalListingPackageId": "1",
  "channelDrafts": [],
  "exports": [],
  "externalPublishEnabled": false,
  "approvalRequired": true,
  "liabilityMode": "seller_publishes_on_own_accounts"
}
```

Provider calls: none.

Payment calls: none.

Direct publish: disabled.
