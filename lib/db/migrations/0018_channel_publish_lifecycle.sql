-- External channel publish lifecycle.
--
-- Additive only: no drops, no deletes, no data rewrites of existing rows
-- beyond widening a CHECK constraint. Adds the columns needed to represent a
-- REAL external listing lifecycle on channel_listing_drafts (external id,
-- external status, sync/error timestamps) and a channel_publish_attempts log
-- for retry-safe, idempotent publish/update/end operations -- that log table
-- is where idempotency is actually enforced (see its unique index below);
-- channel_listing_drafts itself just holds the current resolved state. None
-- of this enables external publishing by itself -- publish_authorized on
-- channel_account_connections (migration 0009/0012) remains the separate,
-- explicit gate checked by application code before any provider call is
-- made.

ALTER TABLE channel_listing_drafts
  ADD COLUMN IF NOT EXISTS external_listing_id TEXT,
  ADD COLUMN IF NOT EXISTS external_offer_id TEXT,
  ADD COLUMN IF NOT EXISTS external_status TEXT,
  ADD COLUMN IF NOT EXISTS account_connection_ref_id BIGINT REFERENCES channel_account_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_publish_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_publish_error TEXT;

CREATE INDEX IF NOT EXISTS idx_channel_listing_drafts_external_listing_id
  ON channel_listing_drafts (channel, external_listing_id)
  WHERE external_listing_id IS NOT NULL;

-- Widen channel_status to represent a real external lifecycle. SUBMITTING
-- covers "request sent, no confirmed response yet" (the exact window where a
-- timeout must never be read as failure OR success). LIVE is set only after
-- the external API affirmatively confirms it. ENDED covers seller-initiated
-- or platform-initiated listing end. Existing values are untouched -- this
-- only adds new allowed values.
ALTER TABLE channel_listing_drafts
  DROP CONSTRAINT IF EXISTS channel_listing_drafts_channel_status_check;
ALTER TABLE channel_listing_drafts
  ADD CONSTRAINT channel_listing_drafts_channel_status_check CHECK (
    channel_status IN (
      'DRAFT', 'READY', 'APPROVAL_REQUIRED', 'SUBMITTING', 'LIVE',
      'EXPORTED', 'DISABLED', 'FAILED', 'ENDED'
    )
  );

-- Retry-safe publish/update/end log. One row per attempt (not per listing),
-- so "first publish succeeded, client timed out, retry occurs" is a second
-- row with the SAME idempotency_key that a unique index rejects as a
-- duplicate INSERT -- the caller catches that conflict and reconciles
-- against the first row's result instead of re-calling the provider.
CREATE TABLE IF NOT EXISTS channel_publish_attempts (
  id BIGSERIAL PRIMARY KEY,
  channel_listing_draft_id BIGINT NOT NULL REFERENCES channel_listing_drafts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('CREATE', 'UPDATE', 'END', 'SYNC')),
  idempotency_key TEXT NOT NULL,
  attempt_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (attempt_status IN ('PENDING', 'SUCCESS', 'FAILED')),
  external_listing_id TEXT,
  external_offer_id TEXT,
  error_code TEXT,
  error_message TEXT,
  request_correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- The actual idempotency guarantee: a second CREATE/UPDATE/END attempt for
-- the same draft with the same key cannot insert a second row.
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_publish_attempts_idem
  ON channel_publish_attempts (channel_listing_draft_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_channel_publish_attempts_draft
  ON channel_publish_attempts (channel_listing_draft_id, created_at DESC);
