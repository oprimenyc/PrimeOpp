-- OAuth-ready channel connection shells for the low-liability listing workspace.
-- This table stores connection intent/status only. It does not store plaintext
-- tokens, enable provider publishing, process payments, create payouts, or make
-- PrimeOpp a marketplace operator.

CREATE TABLE IF NOT EXISTS channel_account_connections (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  display_name TEXT,
  connection_status TEXT NOT NULL DEFAULT 'NOT_CONNECTED' CHECK (
    connection_status IN (
      'NOT_CONNECTED',
      'AUTH_REQUIRED',
      'CONNECTED_MONITORING_ONLY',
      'CONNECTED_DRAFTS_ONLY',
      'PUBLISH_DISABLED',
      'ERROR'
    )
  ),
  scopes_requested JSONB NOT NULL DEFAULT '[]'::jsonb,
  scopes_granted JSONB NOT NULL DEFAULT '[]'::jsonb,
  token_storage_status TEXT NOT NULL DEFAULT 'NOT_IMPLEMENTED' CHECK (
    token_storage_status IN (
      'NOT_STORED',
      'ENCRYPTED',
      'EXTERNAL_SECRET_STORE',
      'NOT_IMPLEMENTED'
    )
  ),
  monitoring_only BOOLEAN NOT NULL DEFAULT TRUE,
  publish_authorized BOOLEAN NOT NULL DEFAULT FALSE,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channel_account_connections_user_id ON channel_account_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_account_connections_channel ON channel_account_connections(channel);
CREATE INDEX IF NOT EXISTS idx_channel_account_connections_status ON channel_account_connections(connection_status);
