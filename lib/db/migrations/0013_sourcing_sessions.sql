-- Sourcing sessions + review queue.
--
-- Additive only: does not drop tables or columns and does not delete rows. Does not enable
-- external provider calls, publishing, payments, or KYC. Reuses the existing
-- product-intake classifier/lookup and canonical-listing-package pipeline
-- instead of duplicating them.
--
-- A sourcing session represents one real trip ("ROSS -- Aug 8"). Items
-- scanned/entered during a session accumulate in a review queue and move
-- through an explicit status lifecycle. BUY/PASS/WATCH is a decision the
-- operator can set manually or accept from the fee-engine-derived
-- recommendation computed at read time (never persisted as a stored fake
-- number -- only real operator-entered acquisition cost/shipping and real
-- fee-schedule math are used).

CREATE TABLE IF NOT EXISTS sourcing_sessions (
  id BIGSERIAL PRIMARY KEY,
  admin_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  location_name TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED')),
  notes TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sourcing_sessions_admin_user ON sourcing_sessions (admin_user_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_sessions_status ON sourcing_sessions (status);
CREATE INDEX IF NOT EXISTS idx_sourcing_sessions_started_at ON sourcing_sessions (started_at DESC);

CREATE TABLE IF NOT EXISTS sourcing_session_items (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES sourcing_sessions(id) ON DELETE CASCADE,

  -- What was scanned/typed and how the product-intake classifier read it.
  raw_query TEXT NOT NULL,
  intake_source TEXT NOT NULL CHECK (intake_source IN ('BARCODE', 'MANUAL_IDENTIFIER', 'SEARCH')),
  identifier_type TEXT,
  normalized_identifier TEXT,
  lookup_status TEXT NOT NULL DEFAULT 'NOT_WIRED',
  lookup_source TEXT NOT NULL DEFAULT 'NONE',
  matched_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,

  -- Real-only product fields, prefilled from a lookup match when one exists.
  -- Never fabricated when there is no match.
  title TEXT,
  description TEXT,
  category TEXT,
  image_url TEXT,
  condition TEXT,

  -- Operator-entered economics. Both nullable -- absence is shown honestly,
  -- never assumed.
  acquisition_cost NUMERIC,
  shipping_estimate NUMERIC,
  currency TEXT NOT NULL DEFAULT 'USD',

  -- Which platform's price evidence (from platform_price_observations, when
  -- present) the review queue should use for this item's decision.
  target_platform TEXT,

  status TEXT NOT NULL DEFAULT 'SCANNED' CHECK (status IN (
    'SCANNED', 'IDENTIFYING', 'QUEUED', 'REVIEWING',
    'BUY', 'PASS', 'WATCH',
    'PURCHASED', 'LISTED', 'SOLD', 'ARCHIVED'
  )),
  notes TEXT,

  -- Same-session duplicate detection (same normalized identifier scanned
  -- twice). Self-referencing, never auto-deleted.
  duplicate_of_item_id BIGINT REFERENCES sourcing_session_items(id) ON DELETE SET NULL,

  -- Set once the operator moves this item into the existing listing
  -- workspace (Sell). Reuses canonical_listing_packages rather than
  -- duplicating listing state.
  canonical_listing_package_id BIGINT REFERENCES canonical_listing_packages(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sourcing_session_items_session_id ON sourcing_session_items (session_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_session_items_status ON sourcing_session_items (session_id, status);
CREATE INDEX IF NOT EXISTS idx_sourcing_session_items_normalized_identifier ON sourcing_session_items (session_id, normalized_identifier);
CREATE INDEX IF NOT EXISTS idx_sourcing_session_items_created_at ON sourcing_session_items (created_at DESC);
