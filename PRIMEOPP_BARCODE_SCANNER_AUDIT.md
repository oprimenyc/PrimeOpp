# PrimeOpp Barcode / Scanner Flow Audit (Source-Verified)

## Answer: Barcode Scanner Exists — **PARTIAL** (backend math only, fully disconnected; zero UI, live or local)

## Evidence

**Camera-based scanner UI**: **NO.** No camera capture code, no browser `getUserMedia`/barcode-decode library (e.g. no `zxing`, `quagga`, `@zxing/library` or similar dependency anywhere in `package.json` files across the whole repo — verified: `modules/product-intake`'s own package.json has zero runtime dependencies beyond devDependencies for testing/building). `modules/product-intake/src/adapters/scanner-adapters.ts` has a `cameraScanToEvent(detectedValue, symbology, deviceId)` function, but it takes an **already-decoded** barcode string as input — it does not decode an image itself. The file's own comment is explicit: `"PROVIDER-DEPENDENT: The actual scanner hardware/browser API is provider-specific. These adapters define the translation layer."` This is a stub waiting for a real integration, not an integration.

**Manual barcode entry field**: **NO.** The live admin product-creation form (`artifacts/primeopp/src/pages/admin.tsx`) has fields for title, category, price, stock level, shipping info, external link, per-color hex/price, and thumbnail — confirmed by reading every `<input>` in the file (lines 287–496). There is no barcode/UPC/SKU input field anywhere in it, and no separate "scan a product" page exists in `artifacts/primeopp/src/pages/` (the full page list is `home, catalog, product, cart, order-success, customer, static-pages, privacy, terms, not-found, admin, admin-login, admin-dashboard, admin-orders` — none of these is a scanner or lookup page).

**UPC/EAN/GTIN lookup provider wired**: **NO.** Grepped for known barcode-lookup provider names (`upcitemdb`, `barcodelookup`) and any HTTP call referencing barcode APIs across `modules/product-intake`, `modules/product-enrichment`, `modules/commerce-core` — no hits. `modules/product-enrichment/src/providers/http-provider.ts` is a generic, provider-agnostic HTTP adapter interface (accepts any configured provider), not a wired connection to a specific barcode database. No provider is actually configured or called anywhere.

**Barcode number classification/checksum validation**: **YES, real, and genuinely well-built** — this is the one part of "barcode scanning" that actually exists as working code: `modules/product-intake/src/domain/identifier-detector.ts` deterministically classifies a cleaned identifier string into UPC_A/EAN_8/EAN_13/GTIN variants/ISBN_10/ISBN_13 by length + checksum math (`modules/product-intake/src/validation/index.ts` has `validateGtinChecksum`, `validateIsbn10Checksum`, `validateIsbn13Checksum`). This is unit-tested (134/134 tests pass, per the surface-map validation matrix) and is a real, correct implementation of barcode-*number* validation — it's just never been given a real barcode to validate, because nothing feeds it one.

**Product lookup service (by identifier, against a catalog)**: `commerce-core`'s `ProductIdentityResolver` (`modules/commerce-core/packages/product-identity/src/index.ts`) can match a barcode against an **in-memory or adapter-backed catalog** — but the only implemented adapter is `LocalTestProductIdentityAdapter`, explicitly commented `"TEST-ONLY. Returns deterministic candidates from a fixture map."` No adapter exists that queries the live PrimeOpp Postgres `products` table or any external database.

**DB persistence of a scan event**: **NO dedicated table.** The live `products` table has no barcode/UPC/GTIN column at all (see `lib/db/migrations/0001_base_schema.sql` — full column list checked, none of them is an identifier field). `modules/product-intake`'s `ProductIntakeRecord` type has an `identifier` field, but that's an in-memory/library type with its own pluggable repository interface (`IntakeRecordRepository`) — no concrete implementation wired to the live Postgres exists.

**Enrichment after scan**: The `product-enrichment` module can take an intake record and enrich it (real, tested code, per the surface map) — but this only matters once something actually produces a `ProductIntakeRecord` from a real scan, which nothing currently does.

**Scan-to-listing flow (scan → product row in the live storefront)**: **NO.** No code path connects a scanned/entered barcode to a row being created in the live `products` table. The commerce-worker adapter built earlier this session (`artifacts/commerce-worker`, dry-run only) is the closest thing to a bridge, but it maps an already-built canonical `Product` object to the live schema — it does not scan, intake, or enrich anything itself, and is not wired to any live route.

## Direct Answers

- **Barcode scanner exists**: PARTIAL (identifier-classification math only; no capture, no lookup, no listing creation)
- **Camera-based scanner exists**: NO
- **Manual barcode entry exists**: NO (not in the live admin form, not as any other route)
- **Product lookup provider wired**: NO
- **Scan-to-listing flow exists**: NO
- **Live route**: NONE
- **Local route**: NONE (no dev-only scanner page found either)
- **API route**: NONE (no `/api/*` route accepts a barcode/scan payload)
- **Tests**: PASS, but only for the disconnected identifier-classification library (`modules/product-intake`, 134/134) and disconnected identity-resolution library (`modules/commerce-core`, 269/269) — zero tests exist for anything scan-related in the live app, because nothing scan-related exists in the live app.

## What the Owner Can Test Today

Nothing barcode-related. There is no page, button, or API endpoint anywhere in the deployed app that accepts a barcode or scans one. The admin can only create products by typing every field manually.

## What Must Be Built Next (in order)

1. A real camera-decode library (e.g. a barcode-scanning JS library) wired into a new admin page/component — currently 100% missing, this is the actual gap, not a connection problem.
2. A manual barcode-entry input, at minimum, would be far cheaper than camera scanning and would immediately let the existing (real, tested) `identifier-detector.ts` classification logic do something useful — but even this simplest version doesn't exist yet in the live app.
3. Once either exists, wire the resulting identifier through `product-intake` → `product-enrichment` → `commerce-core` (all real, tested) → the commerce-worker adapter (built this session, dry-run only) → the live `products` table.
