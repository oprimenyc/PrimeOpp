-- Retail intelligence schema: generalized product identifier graph, retailer /
-- store / inventory model, and selected-platform price + fee intelligence.
--
-- Additive only. Does not drop columns, does not delete rows, does not enable
-- external provider calls, publishing, payments, payouts, escrow, or KYC.
-- Quantities remain NULLABLE by design: a status like "in stock" is never
-- converted into an invented number.

-- ── Retailers ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS retailers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'DISABLED' CHECK (
    status IN ('ENABLED', 'DISABLED', 'EXPERIMENTAL')
  ),
  adapter_key TEXT NOT NULL,
  adapter_version TEXT NOT NULL DEFAULT '0.0.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retailers_slug ON retailers (slug);
CREATE INDEX IF NOT EXISTS idx_retailers_status ON retailers (status);

-- ── Product identifier graph extension ───────────────────────────────────────
-- Generalize the existing product_identifiers table so one canonical product
-- can carry universal, retailer-specific, and marketplace-specific aliases.
-- Retailer / marketplace IDs are aliases only and never become the canonical
-- product identity.
ALTER TABLE product_identifiers
  ADD COLUMN IF NOT EXISTS namespace TEXT NOT NULL DEFAULT 'UNIVERSAL',
  ADD COLUMN IF NOT EXISTS raw_identifier TEXT,
  ADD COLUMN IF NOT EXISTS retailer_id BIGINT REFERENCES retailers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS platform_id TEXT;

-- Backfill raw_identifier from the original identifier value where missing so
-- the original raw identifier is always preserved.
UPDATE product_identifiers
  SET raw_identifier = identifier
  WHERE raw_identifier IS NULL;

-- Constrain namespace to the supported set.
ALTER TABLE product_identifiers
  DROP CONSTRAINT IF EXISTS product_identifiers_namespace_check;
ALTER TABLE product_identifiers
  ADD CONSTRAINT product_identifiers_namespace_check CHECK (
    namespace IN ('UNIVERSAL', 'RETAILER', 'MARKETPLACE')
  );

-- Expand identifier_type to include retailer- and marketplace-specific types.
-- Dropping the auto-named inline check and re-adding a named superset is
-- additive: no existing row is invalidated because the prior set is included.
ALTER TABLE product_identifiers
  DROP CONSTRAINT IF EXISTS product_identifiers_identifier_type_check;
ALTER TABLE product_identifiers
  ADD CONSTRAINT product_identifiers_identifier_type_check CHECK (
    identifier_type IN (
      -- Universal
      'UPC', 'UPC_A', 'EAN', 'EAN_13', 'GTIN', 'ISBN', 'SKU',
      'MODEL_NUMBER', 'STYLE_CODE', 'MPN',
      -- Retailer-specific
      'TARGET_TCIN', 'WALMART_ITEM_ID', 'BEST_BUY_SKU', 'HOME_DEPOT_ITEM_ID',
      'LOWES_ITEM_ID', 'OTHER_RETAILER_ID',
      -- Marketplace-specific
      'AMAZON_ASIN', 'EBAY_EPID', 'MERCARI_ITEM_ID', 'POSHMARK_ITEM_ID',
      'OTHER_PLATFORM_ID',
      -- Catch-all
      'OTHER'
    )
  );

CREATE INDEX IF NOT EXISTS idx_product_identifiers_namespace ON product_identifiers (namespace);
CREATE INDEX IF NOT EXISTS idx_product_identifiers_retailer_id ON product_identifiers (retailer_id);
CREATE INDEX IF NOT EXISTS idx_product_identifiers_platform_id ON product_identifiers (platform_id);

-- ── Retailer product aliases ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS retailer_products (
  id BIGSERIAL PRIMARY KEY,
  retailer_id BIGINT NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  retailer_item_id TEXT NOT NULL,
  retailer_sku TEXT,
  product_url TEXT,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_retailer_products_retailer_item
  ON retailer_products (retailer_id, retailer_item_id);
CREATE INDEX IF NOT EXISTS idx_retailer_products_product_id ON retailer_products (product_id);

-- ── Retailer stores ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS retailer_stores (
  id BIGSERIAL PRIMARY KEY,
  retailer_id BIGINT NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  external_store_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address_line_1 TEXT,
  city TEXT,
  region TEXT,
  postal_code TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_retailer_stores_external
  ON retailer_stores (retailer_id, external_store_id);
CREATE INDEX IF NOT EXISTS idx_retailer_stores_postal_code ON retailer_stores (postal_code);
CREATE INDEX IF NOT EXISTS idx_retailer_stores_active ON retailer_stores (active);

-- ── Inventory observations ───────────────────────────────────────────────────
-- quantity is intentionally NULLABLE. A status-only observation ("in stock",
-- "limited stock", "available nearby") must never be turned into an invented
-- number. quantity_confidence records how certain the quantity is.
CREATE TABLE IF NOT EXISTS inventory_observations (
  id BIGSERIAL PRIMARY KEY,
  retailer_product_id BIGINT NOT NULL REFERENCES retailer_products(id) ON DELETE CASCADE,
  retailer_store_id BIGINT NOT NULL REFERENCES retailer_stores(id) ON DELETE CASCADE,
  availability_status TEXT NOT NULL CHECK (
    availability_status IN (
      'IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'LIMITED_AVAILABILITY',
      'UNKNOWN', 'NOT_SUPPORTED', 'PROVIDER_REQUIRED', 'FAILED'
    )
  ),
  quantity INTEGER,
  quantity_confidence TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (
    quantity_confidence IN ('EXACT', 'ESTIMATED', 'STATUS_ONLY', 'UNKNOWN')
  ),
  price NUMERIC,
  currency TEXT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  source_type TEXT NOT NULL CHECK (
    source_type IN (
      'OFFICIAL_API', 'LICENSED_PROVIDER', 'USER_AUTHORIZED_BROWSER',
      'PUBLIC_PAGE_MONITOR', 'UNAVAILABLE'
    )
  ),
  source_status TEXT NOT NULL,
  adapter_version TEXT NOT NULL DEFAULT '0.0.0',
  raw_reference_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_observations_product ON inventory_observations (retailer_product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_observations_store ON inventory_observations (retailer_store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_observations_observed_at ON inventory_observations (observed_at DESC);

-- ── Selected-platform price observations ─────────────────────────────────────
-- Active (asking) prices and sold-comp prices are stored in separate columns
-- and must never be presented as the same thing. Recommendations stay nullable
-- and editable.
CREATE TABLE IF NOT EXISTS platform_price_observations (
  id BIGSERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  external_product_id TEXT,
  identifier_used TEXT,
  match_confidence TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (
    match_confidence IN ('HIGH', 'MEDIUM', 'LOW', 'UNKNOWN')
  ),
  condition TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (
    condition IN ('NEW', 'USED', 'REFURBISHED', 'OPEN_BOX', 'UNKNOWN')
  ),
  listing_type TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (
    listing_type IN ('ACTIVE', 'SOLD')
  ),
  active_listing_count INTEGER,
  sold_comp_count INTEGER,
  active_low NUMERIC,
  active_median NUMERIC,
  active_high NUMERIC,
  sold_low NUMERIC,
  sold_median NUMERIC,
  sold_high NUMERIC,
  recommended_list_price NUMERIC,
  estimated_platform_fees NUMERIC,
  estimated_shipping NUMERIC,
  estimated_net_proceeds NUMERIC,
  estimated_profit NUMERIC,
  currency TEXT NOT NULL DEFAULT 'USD',
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_type TEXT NOT NULL,
  source_status TEXT NOT NULL CHECK (
    source_status IN (
      'FOUND', 'NO_MATCH', 'INSUFFICIENT_DATA', 'NOT_CONFIGURED',
      'PROVIDER_REQUIRED', 'UNSUPPORTED', 'FAILED'
    )
  ),
  adapter_version TEXT NOT NULL DEFAULT '0.0.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_price_obs_product ON platform_price_observations (product_id);
CREATE INDEX IF NOT EXISTS idx_platform_price_obs_platform ON platform_price_observations (platform);
CREATE INDEX IF NOT EXISTS idx_platform_price_obs_observed_at ON platform_price_observations (observed_at DESC);

-- ── Versioned platform fee schedules ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_fee_schedules (
  id BIGSERIAL PRIMARY KEY,
  platform TEXT NOT NULL,
  category TEXT,
  effective_from DATE NOT NULL,
  effective_to DATE,
  percentage_fee NUMERIC,
  fixed_fee NUMERIC,
  payment_processing_fee NUMERIC,
  additional_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'SELLER_PROVIDED',
  version TEXT NOT NULL DEFAULT '1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_fee_schedules_platform ON platform_fee_schedules (platform);
CREATE INDEX IF NOT EXISTS idx_platform_fee_schedules_effective ON platform_fee_schedules (platform, effective_from DESC);
