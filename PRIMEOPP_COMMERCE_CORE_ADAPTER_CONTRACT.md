# PrimeOpp Commerce-Core → Live Products Adapter — Contract Map

## Pipeline Shape

```
product-intake (ProductIntakeRecord)
   -> product-enrichment (EnrichedProductProfile)
   -> commerce-core/product-identity (buildResolutionInputFromEnrichedProfile -> ResolutionResult)
   -> commerce-core/canonical-catalog (buildCanonicalProductFromResolutionResult -> Product)
   -> [THIS ADAPTER] -> live `products` table row
```

The three upstream modules already bridge to each other (verified in source, not assumed):
`product-identity/src/index.ts` has `buildResolutionInputFromEnrichedProfile()`, a documented "sole handoff point between enrichment output and canonical identity resolution." `canonical-catalog/src/index.ts` has `buildCanonicalProductFromResolutionResult()`, which turns a `NO_MATCH` `ResolutionResult` into a canonical `Product`. **This adapter's job starts where that chain ends**: it consumes a canonical `Product` (commerce-core's `@primeopp/contracts` `Product` type) and maps it to a row in the live `products` table. It does not re-implement or duplicate the intake/enrichment/resolution logic — those are out of scope and already tested (see the validation matrix from the surface-map session).

## 1. Commerce-Core Canonical `Product` Model (source)

Full type at `modules/commerce-core/packages/contracts/src/product.ts`. Fields relevant to this adapter:

| Field | Type | Required on `Product`? |
|---|---|---|
| `id` | `string` | required |
| `kind` | `ProductKind` (12 values: `PHYSICAL, DIGITAL, POD, DROPSHIP, AFFILIATE, SERVICE, BUNDLE, KIT, LOT, MULTIPACK, SERIALIZED, UNIQUE_COLLECTIBLE`) | required |
| `title` | `string` | required |
| `description` | `string?` | optional |
| `category` | `{taxonomy, path[], leaf, confidence}?` | optional |
| `images` | `ProductImage[]` (`{id, url?, evidenceRef, kind, ...}`) | required array (can be empty) |
| `variants` | `ProductVariant[]` (`{attributes: VariantAttribute[] with axis/value/confidence, ...}`) | required array (can be empty) |
| `fulfillmentMode` | `ProductFulfillmentMode` (7 values incl. `POD_FULFILLED`) | required |
| `ownership.tenantId` | `TenantId` | required |
| `archived` | `boolean?` | optional |
| `version` | `number` | required |
| **price** | **not present anywhere on `Product`** | — |
| **stock/inventory** | **not present anywhere on `Product`** | — |
| **POD vendor (printful/tapstitch)** | **not present anywhere on `Product`** | — |

Price is produced by a *separate* pricing engine (`modules/commerce-core/packages/pricing`, `PricingResult`/`PricingObservation` types) that operates on a `productId` reference, not embedded in `Product` itself. Inventory/stock is likewise a separate concern (`packages/inventory`). This is a structural fact of the canonical model, not a gap in this adapter.

## 2. Product-Intake Output (`ProductIntakeRecord`)

`modules/product-intake/primeopp-product-intake/src/types/index.ts`. Carries `identifier` (normalized barcode/SKU) and/or `manualProduct` (`{title?, brand?, model?, category?, description?}`), plus `status: ACCEPTED|REJECTED|DUPLICATE|NEEDS_REVIEW`. This is upstream of enrichment — the adapter does not consume this directly, only the canonical `Product` it eventually contributes to.

## 3. Product-Enrichment Output (`EnrichedProductProfile`)

`modules/product-enrichment/primeopp-product-enrichment/src/contracts/output.ts`. Carries `identifiers` (upc/ean/gtin/isbn/sku/mpn buckets), `identity` (canonicalTitle/brand/model), `classification` (category/subcategory/taxonomyPath), `media.images`, `confidence`, `status: ENRICHED|PARTIAL|AMBIGUOUS|NOT_FOUND|FAILED`. Also upstream — feeds `buildResolutionInputFromEnrichedProfile()`, not consumed directly by this adapter.

## 4. Live `products` Table Schema (destination)

`lib/db/migrations/0001_base_schema.sql`:

| Column | Type | Constraint |
|---|---|---|
| `id` | `SERIAL` | PK, auto |
| `type` | `TEXT` | **NOT NULL, CHECK IN ('pod', 'affiliate')** — only 2 values allowed |
| `title` | `TEXT` | **NOT NULL** |
| `description` | `TEXT` | nullable |
| `price` | `NUMERIC` | nullable |
| `category` | `TEXT` | nullable |
| `thumbnail_url` | `TEXT` | nullable |
| `external_link` | `TEXT` | nullable |
| `stock_level` | `INTEGER` | nullable |
| `shipping_info` | `TEXT` | nullable |
| `colors` | `JSONB` | NOT NULL, DEFAULT `'[]'` |
| `sizes` | `JSONB` | NOT NULL, DEFAULT `'[]'` |
| `pod_provider` | `TEXT` | nullable, CHECK NULL or IN ('printful', 'tapstitch') |
| `printful_variant_id` | `TEXT` | nullable |
| `tapstitch_variant_id` | `TEXT` | nullable |
| `created_at` | `TIMESTAMPTZ` | auto default |

Admin-side validation (`artifacts/api-server/src/lib/validation.ts` `productSchema`) additionally expects `colors: [{name, hex, price}]` and `sizes: string[]` — richer than the raw column type, and the shape this adapter should target for `colors`/`sizes` so a mapped row is actually usable by the existing admin API, not just DB-valid.

## 5. Field-by-Field Map

| Live column | Required? | Source on canonical `Product` | Mapping | Data-loss risk |
|---|---|---|---|---|
| `type` | **yes** | `kind` | `POD -> 'pod'`, `AFFILIATE -> 'affiliate'`; **all other 10 kinds have no valid destination value** | **High** — most canonical products (PHYSICAL, DIGITAL, DROPSHIP, SERVICE, BUNDLE, KIT, LOT, MULTIPACK, SERIALIZED, UNIQUE_COLLECTIBLE) cannot be represented at all. Must be an explicit `SKIP`/`ERROR`, never silently coerced to `pod` or `affiliate`. |
| `title` | **yes** | `title` | direct copy | none (both required non-empty strings) |
| `description` | no | `description` | direct copy | none |
| `category` | no | `category.leaf` (fallback: last segment of `category.path`) | join/pick | Medium — `taxonomy`, full `path`, and `confidence` are dropped; only the leaf category name survives. |
| `thumbnail_url` | no | `images` (first entry where `kind === 'PRIMARY'`, else `images[0]`) `.url` | pick one | **High** — canonical `Product` can carry many images (`PRIMARY`, `GALLERY`, `DEFECT`, `PACKAGING`, `LABEL`); only one URL survives, and images without a `url` (evidence-ref-only, "offline-capable" images) map to nothing. |
| `colors` | defaultable | `variants[].attributes` where `axis === 'COLOR'` | build `{name: value, hex: null, price: null}` per distinct color value | **High** — canonical model has no `hex` or per-color `price` field at all; those must come from elsewhere or stay `null`, which the admin `productSchema` validator would reject if it required them (it requires a valid hex — so color rows without a known hex cannot pass admin validation and must be flagged, not force-defaulted to a fake color). |
| `sizes` | defaultable | `variants[].attributes` where `axis` is `SIZE`, `SHOE_SIZE`, or `APPAREL_SIZE` | distinct `value` list | Low — sizes are plain strings on both sides. |
| `pod_provider` | no | **not present on `Product`** | none — cannot be inferred safely from `fulfillmentMode: 'POD_FULFILLED'` alone (doesn't say *which* POD vendor) | **High** — always `null` in this pass; a real value would require a separate, explicit input alongside the canonical Product (e.g. from the acquisition/source metadata of whatever created it), which doesn't exist yet. |
| `printful_variant_id` / `tapstitch_variant_id` | no | **not present on `Product`** | none | Always `null` in this pass — same reason as `pod_provider`. |
| `price` | no | **not present on `Product` at all** (separate `PricingResult`) | adapter accepts an optional external `price` input alongside the `Product`; `null` if not supplied | By design, not a bug — price is intentionally not part of the canonical Product model. |
| `stock_level` | no | **not present on `Product`** (separate `inventory` package) | none | Always `null` in this pass. |
| `external_link` | no | `source.ref` when `source.kind` is `'CATALOG'` or `'IMPORT'` and the value is a valid http(s) URL | conditional pick | Low-medium — only populated when the source really was a URL-shaped catalog/import reference; otherwise `null`. |
| `shipping_info` | no | **not present on `Product`** | none | Always `null`. |

## 6. Data-Loss Risks Summary (Ranked)

1. **Kind vocabulary loss (High)** — 10 of 12 canonical `ProductKind` values have no live `type` equivalent. The adapter must treat unsupported kinds as a hard `SKIP` with an explicit reason, never a silent default.
2. **Color richness loss (High)** — canonical variants carry no `hex` and no per-color `price`; the live admin schema wants both. Colors without a resolvable hex must be flagged, not fabricated.
3. **Image richness loss (High)** — many images/evidence refs collapse into one `thumbnail_url`, and images without a plain `url` (evidence-only) are unrepresentable.
4. **POD vendor loss (High)** — `pod_provider`/variant IDs have no canonical source at all; always `null` until a separate input channel exists.
5. **Price/stock absence (by design, not loss)** — these were never part of the canonical `Product`; the adapter accepts them as optional side-channel inputs, not something extracted from `Product` itself.
6. **Provenance/evidence/confidence loss (Medium)** — the live table has no columns for any canonical audit trail (evidence refs, confidence scores, lineage). Acceptable for a dry-run/reporting pass; would need new columns before any of that could survive a real write.

## 7. Dedupe / Upsert Key Options

**The live `products` table has no column to store the canonical `Product.id` (or any other stable external reference).** This is the single biggest open question for a future write-mode pass:

- **Option A — heuristic key (used by this dry-run adapter, since no schema change is authorized in this mission):** match on `(lower(title), type)`. Weak — a title edit or re-enrichment breaks the match, and two genuinely different products with the same title/type would collide. Acceptable *only* because this pass never writes.
- **Option B — recommended real fix (not implemented in this mission, requires a migration):** add a nullable `external_id TEXT UNIQUE` column to `products`, populated with the canonical `Product.id`. This is the only way to get a true idempotent upsert. Out of scope here because this mission is dry-run-only and explicitly does not authorize schema/migration changes.

The dry-run adapter implements Option A and reports its plan (`insert` if no title/type match found, `update` if one is, `skip`/`error` for unsupported kinds or missing required fields) — it never actually decides this question, since it never writes.
