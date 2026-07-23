-- OAuth connection flow extension for channel_account_connections.
--
-- Additive only. Adds columns for a documented OAuth authorization-code + PKCE
-- flow: provider key, short-lived state/verifier hashes for CSRF/PKCE
-- validation, and ENCRYPTED-ONLY token storage fields. No column ever holds a
-- plaintext token. Defaults keep every connection monitoring-only and
-- publish-unauthorized. This migration does not enable provider calls or
-- external publishing on its own.

ALTER TABLE channel_account_connections
  ADD COLUMN IF NOT EXISTS provider_key TEXT,
  -- Short-lived, single-use CSRF state and PKCE verifier are stored as SHA-256
  -- hashes only, cleared on callback. They are not tokens.
  ADD COLUMN IF NOT EXISTS oauth_state_hash TEXT,
  ADD COLUMN IF NOT EXISTS pkce_verifier_hash TEXT,
  ADD COLUMN IF NOT EXISTS oauth_state_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS redirect_uri TEXT,
  -- Access/refresh tokens, when a live flow is configured, are stored only as
  -- AES-256-GCM ciphertext with their IV and auth tag in separate columns.
  -- There is deliberately no plaintext token column.
  ADD COLUMN IF NOT EXISTS access_token_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS access_token_iv TEXT,
  ADD COLUMN IF NOT EXISTS access_token_auth_tag TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token_iv TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token_auth_tag TEXT,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS connection_health TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS last_health_check_at TIMESTAMPTZ;

-- Constrain connection_health to the supported set.
ALTER TABLE channel_account_connections
  DROP CONSTRAINT IF EXISTS channel_account_connections_connection_health_check;
ALTER TABLE channel_account_connections
  ADD CONSTRAINT channel_account_connections_connection_health_check CHECK (
    connection_health IN ('HEALTHY', 'EXPIRED', 'REVOKED', 'ERROR', 'NOT_CONNECTED', 'UNKNOWN')
  );

-- Defense-in-depth: a token ciphertext must never be stored without its IV and
-- auth tag (which would indicate a broken/plaintext write path).
ALTER TABLE channel_account_connections
  DROP CONSTRAINT IF EXISTS channel_account_connections_token_shape_check;
ALTER TABLE channel_account_connections
  ADD CONSTRAINT channel_account_connections_token_shape_check CHECK (
    access_token_ciphertext IS NULL
    OR (access_token_iv IS NOT NULL AND access_token_auth_tag IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_channel_account_connections_provider_key
  ON channel_account_connections (provider_key);
