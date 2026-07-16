# Variant Engine

The variant engine lives in `packages/variant-engine/src/index.ts`.

## Variant Axes

16 axes are supported: SIZE, COLOR, MATERIAL, STYLE, STORAGE, CAPACITY, EDITION, REGION, PLATFORM, SHOE_SIZE, APPAREL_SIZE, WIDTH, CONDITION, BUNDLE_QTY, PACKAGE_COUNT, MODEL_REVISION, CUSTOM.

## Normalization

`normalizeVariantValue(axis, value)` uppercases, trims, collapses whitespace, and applies axis-specific normalizations:

- COLOR: BLK → BLACK, WHT → WHITE, GRY → GREY → GRAY, etc.
- STORAGE: "128 Gigabytes" → "128GB"
- SHOE_SIZE / APPAREL_SIZE: whitespace stripped

## Hashing

`computeVariantHash(attributes)` produces a deterministic 16-char hex hash of normalized attributes. Two variants with the same normalized attributes have the same hash.

## Conflict Detection

`detectVariantConflicts(left, right)` returns an array of `VariantConflict` objects. Each conflict has a kind:

- SIZE_MISMATCH, COLOR_MISMATCH, STORAGE_MISMATCH, EDITION_MISMATCH, MULTIPACK_MISMATCH, CONDITION_MISMATCH, REGION_MISMATCH, MODEL_REVISION_MISMATCH
- MISSING_DISTINGUISHING_AXIS — one variant has a distinguishing axis the other lacks
- CONFLICTING_SAME_AXIS — same axis, different values
- CUSTOM

## Comparability

`canCompareAcrossVariants(left, right)` returns false if any conflict exists. The pricing engine uses this to reject mixed-variant comparisons.

## Tested Scenarios

- sneaker size mismatch
- console storage mismatch
- apparel color mismatch
- book edition mismatch
- multipack mismatch
- refurbished vs used mismatch
- regional model mismatch
