-- Backfills existing rows to the same normalization
-- lib/productIntake.ts's normalizeProductIdentifier() has always applied to
-- product_identifiers: strip whitespace/dashes/periods, then uppercase.
--
-- Root cause this closes: classifyProductIntake() (used for every scanned
-- sourcing item) only stripped whitespace/dashes/periods -- it never
-- uppercased -- while POST /product-identifiers (saved identity-correction
-- mappings) always uppercased via normalizeProductIdentifier(). Any
-- alphanumeric identifier (a SKU or style code, not a barcode) containing
-- lowercase letters classified/stored one way on the sourcing item but could
-- never match a mapping saved the other way, breaking the exact promise the
-- identity-correction flow makes ("this barcode resolves automatically next
-- time too"). POST /pricing/observations/manual (evidence, including the CSV
-- bulk-import path) applied no normalization at all, so evidence pasted in a
-- different case/formatting than a scan produced silently never matched
-- anything either. Application code (this same commit) now runs every one of
-- these through the identical normalizeProductIdentifier() call.
--
-- This migration is the data-side half of that fix: existing rows written
-- before this fix, in either table, are re-normalized in place to the same
-- convention so old data matches new data going forward. Additive/in-place
-- only -- no rows added or removed, no columns dropped. Excludes
-- PRODUCT_NAME-type sourcing items, which are free-text search strings
-- matched case-insensitively (findLocalCatalogProduct's `lower(title) LIKE
-- lower(...)`), not exact-match identifiers -- forcing those to uppercase
-- would just be a cosmetic, pointless change to search text.
UPDATE sourcing_session_items
SET normalized_identifier = UPPER(regexp_replace(normalized_identifier, '[\s\-.]', '', 'g'))
WHERE normalized_identifier IS NOT NULL
  AND identifier_type IS DISTINCT FROM 'PRODUCT_NAME';

UPDATE platform_price_observations
SET normalized_identifier = UPPER(regexp_replace(normalized_identifier, '[\s\-.]', '', 'g'))
WHERE normalized_identifier IS NOT NULL;
