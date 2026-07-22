-- Low-liability crosslisting workspace.
-- These tables store local canonical packages, channel drafts, account shells,
-- and export payloads. They do not enable direct external publishing, buyer
-- checkout, escrow, fulfillment, disputes, refunds, or credential custody.

CREATE TABLE IF NOT EXISTS canonical_listing_packages (
  id BIGSERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  source_identifier TEXT NOT NULL,
  identifier_type TEXT NOT NULL,
  intake_source TEXT NOT NULL CHECK (intake_source IN ('SCAN', 'SEARCH', 'MANUAL_FALLBACK')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  category TEXT NOT NULL DEFAULT 'uncategorized',
  condition TEXT NOT NULL DEFAULT 'unspecified',
  size_variant TEXT,
  cost_basis NUMERIC,
  target_price NUMERIC,
  margin NUMERIC,
  shipping_profile TEXT,
  status TEXT NOT NULL DEFAULT 'APPROVAL_REQUIRED' CHECK (
    status IN ('DRAFT', 'READY', 'APPROVAL_REQUIRED', 'EXPORTED', 'DISABLED', 'FAILED')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canonical_listing_packages_product_id ON canonical_listing_packages(product_id);
CREATE INDEX IF NOT EXISTS idx_canonical_listing_packages_status ON canonical_listing_packages(status);
CREATE INDEX IF NOT EXISTS idx_canonical_listing_packages_created_at ON canonical_listing_packages(created_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_account_connections (
  id BIGSERIAL PRIMARY KEY,
  owner_scope TEXT NOT NULL DEFAULT 'operator',
  channel TEXT NOT NULL,
  connection_status TEXT NOT NULL DEFAULT 'NOT_CONNECTED' CHECK (
    connection_status IN ('NOT_CONNECTED', 'MONITORING_ONLY', 'AUTH_REQUIRED', 'PUBLISH_DISABLED')
  ),
  monitoring_only BOOLEAN NOT NULL DEFAULT TRUE,
  publish_authorized BOOLEAN NOT NULL DEFAULT FALSE,
  credential_reference TEXT,
  credential_plaintext_guard BOOLEAN NOT NULL DEFAULT FALSE CHECK (credential_plaintext_guard = FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_account_connections_channel ON marketplace_account_connections(channel);
CREATE INDEX IF NOT EXISTS idx_marketplace_account_connections_status ON marketplace_account_connections(connection_status);

CREATE TABLE IF NOT EXISTS channel_listing_drafts (
  id BIGSERIAL PRIMARY KEY,
  canonical_listing_id BIGINT NOT NULL REFERENCES canonical_listing_packages(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  account_connection_id BIGINT REFERENCES marketplace_account_connections(id) ON DELETE SET NULL,
  channel_status TEXT NOT NULL DEFAULT 'APPROVAL_REQUIRED' CHECK (
    channel_status IN ('DRAFT', 'READY', 'APPROVAL_REQUIRED', 'EXPORTED', 'DISABLED', 'FAILED')
  ),
  channel_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_validation_error TEXT,
  publish_disabled_reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channel_listing_drafts_canonical ON channel_listing_drafts(canonical_listing_id);
CREATE INDEX IF NOT EXISTS idx_channel_listing_drafts_channel_status ON channel_listing_drafts(channel, channel_status);

CREATE TABLE IF NOT EXISTS listing_export_packages (
  id BIGSERIAL PRIMARY KEY,
  canonical_listing_id BIGINT NOT NULL REFERENCES canonical_listing_packages(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  export_format TEXT NOT NULL CHECK (
    export_format IN ('COPY_FIELDS', 'CSV', 'JSON', 'API_DRAFT_DISABLED')
  ),
  export_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listing_export_packages_canonical ON listing_export_packages(canonical_listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_export_packages_created_at ON listing_export_packages(created_at DESC);
