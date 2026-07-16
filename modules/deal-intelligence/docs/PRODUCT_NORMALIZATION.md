# Product Normalization

The `product-normalization` package detects identifiers (UPC, EAN, GTIN,
ISBN, ASIN, SKU, MPN), variants (size, color, storage, pack, bundle,
edition), and cleans titles.

NEVER merges different sizes, colors, storage capacities, editions, pack
quantities, used/new inventory, or bundles with single units without
explicit evidence. `areCompatibleVariants` and `rejectIncompatibleMatch`
expose the rules.
