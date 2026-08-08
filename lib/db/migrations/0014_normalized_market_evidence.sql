-- Normalize platform_price_observations to support evidence for a product
-- that has never existed in PrimeOpp's own catalog -- the actual sourcing
-- scenario (scan something arbitrary at Ross/Burlington/a thrift store,
-- decide later whether it's worth buying).
--
-- Additive only: no dropped tables, no dropped columns, no deleted rows.
-- product_id's NOT NULL constraint is loosened (a constraint relaxation
-- allows strictly more rows than before, not fewer) and a new CHECK ensures
-- a row is always scoped to something -- either the operator's own catalog
-- product, or a normalized identifier from an arbitrary scanned item, or
-- both. Existing rows (there are currently none written by any live code
-- path -- confirmed: /pricing/market never persists) are unaffected either
-- way.

ALTER TABLE platform_price_observations ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE platform_price_observations ADD COLUMN IF NOT EXISTS normalized_identifier TEXT;
ALTER TABLE platform_price_observations ADD COLUMN IF NOT EXISTS identifier_type TEXT;
ALTER TABLE platform_price_observations ADD COLUMN IF NOT EXISTS source_url TEXT;

-- A row must be attached to *something* -- the operator's own catalog
-- product, a normalized identifier from a scanned item, or both. Never both
-- null (that would be evidence for nothing, and nothing could ever query it
-- back out again).
ALTER TABLE platform_price_observations
  ADD CONSTRAINT platform_price_observations_scoped_chk
  CHECK (product_id IS NOT NULL OR normalized_identifier IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_platform_price_obs_normalized_identifier
  ON platform_price_observations (normalized_identifier, platform);

-- source_type already accepted free text (no CHECK constraint existed);
-- this documents the values now in real use rather than changing the schema:
--   'PROVIDER'      -- a live marketplace adapter (none configured yet)
--   'MANUAL_ENTRY'  -- an operator typed in a real observed price themselves
--   'CSV_IMPORT'    -- reserved for a future bulk-import path; not built yet
