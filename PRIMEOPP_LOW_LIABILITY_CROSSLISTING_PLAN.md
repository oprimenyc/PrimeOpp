# PrimeOpp Low-Liability Crosslisting Plan

Date: 2026-07-22
Repo: `C:\Users\jp718\Documents\GitHub\PrimeOpp`
Scope: PrimeOpp only

## Direction

PrimeOpp is a crosslisting command center first.

The public PrimeOpp marketplace is deferred. This MVP must not make PrimeOpp the seller of record, buyer marketplace, escrow/payment handler, fulfillment party, dispute handler, refund handler, or custodian of marketplace money.

Current live URL:

`https://primeopp-production-a554.up.railway.app`

The current live ecommerce/API slice is not the whole product. It proves a storefront/admin/API surface, but it does not yet prove the scan-to-crosslisting workflow.

## MVP Flow

Corrected low-liability flow:

`camera scan/search -> identify/classify product -> enrich listing data -> price/profit decision -> canonical listing package -> channel draft/export packages -> seller publishes through own accounts -> PrimeOpp tracks local package/draft/export status`

Manual barcode or identifier entry is fallback only. Camera scan/search is the primary intake direction, but camera decoding is still partial until a real scanner/decoder is wired.

## Source Of Truth

The canonical listing package is the source of truth.

It holds:

- source product identifier
- identifier type
- title
- description
- images
- category
- condition
- variant/size
- cost basis
- target price
- margin
- shipping profile
- package status

Channel drafts and exports are generated from the same canonical listing package. They are local/internal artifacts only.

## Liability Boundary

PrimeOpp MVP does not handle:

- buyer checkout for third-party seller listings
- escrow
- marketplace payment custody
- third-party fulfillment
- third-party refunds
- buyer/seller dispute handling
- buyer/seller messaging
- counterfeit-risk marketplace operations
- live external provider publication

External publish is disabled and approval-gated. A seller can copy/export the generated draft and publish through their own account outside PrimeOpp. Any future direct publish must require connected account setup, explicit authorization, provider-specific validation, and owner approval.

## Current Repo Evidence

Live connected slice:

- `artifacts/primeopp`: customer storefront and admin UI
- `artifacts/api-server`: Express API, admin auth, products, orders, contact, revenue, health
- `lib/db/migrations`: live database migrations through `0007_contact_messages.sql` before this pass

Disconnected or local-ready planning/code:

- `modules/product-intake/primeopp-product-intake`: identifier classification, normalization, scanner event contracts, dedupe
- `modules/product-enrichment/primeopp-product-enrichment`: enrichment service contracts, provider-neutral output, confidence/completeness/conflict handling
- `modules/commerce-core`: barcode/product identity/pricing/fee/profit/listing/channel contracts
- `modules/marketplace-platform`: canonical listing, registry, transformer, publisher, local/test adapters, workflow tests
- `modules/deal-intelligence`: pricing/deal intelligence and publication contracts adjacent to the owner flow

## What This Pass Adds

This pass adds a connected V1 listing workspace:

- additive DB schema for canonical listing packages
- additive DB schema for channel listing drafts
- additive DB schema for marketplace account connection shells
- additive DB schema for listing export packages
- protected `POST /api/listings/packages`
- protected account connection shell read endpoint
- admin/operator UI at `/admin/listings`
- focused generator tests

The flow creates local packages, local drafts, and local exports. It does not call providers, does not call Stripe, and does not claim live publishing.

## Claim Boundary

Safe to claim after validation:

- PrimeOpp has a low-liability listing workspace V1.
- PrimeOpp can create a canonical listing package locally.
- PrimeOpp can generate local channel drafts and JSON exports.
- External direct publish remains disabled.
- Seller publication happens through the seller's own accounts outside PrimeOpp.

Not safe to claim:

- PrimeOpp is a live public marketplace.
- PrimeOpp publishes listings directly to external providers.
- PrimeOpp performs live product lookup/comps automatically.
- PrimeOpp has live camera decoding unless a decoder is separately wired and verified.
