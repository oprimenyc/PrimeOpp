CREATE TABLE IF NOT EXISTS fulfillment_jobs (
  id BIGSERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'failed', 'completed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fulfillment_jobs_one_active_per_order
  ON fulfillment_jobs (order_id)
  WHERE status IN ('queued', 'processing', 'failed');

CREATE INDEX IF NOT EXISTS idx_fulfillment_jobs_due
  ON fulfillment_jobs (status, next_retry_at, created_at)
  WHERE status IN ('queued', 'failed');

CREATE INDEX IF NOT EXISTS idx_fulfillment_jobs_stale_processing
  ON fulfillment_jobs (updated_at)
  WHERE status = 'processing';

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_stripe_session_id
  ON orders (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent
  ON orders (stripe_payment_intent)
  WHERE stripe_payment_intent IS NOT NULL;
