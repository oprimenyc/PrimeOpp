CREATE TABLE IF NOT EXISTS product_reviews (
  id BIGSERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  photo_url TEXT,
  is_verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  helpful_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  moderated_at TIMESTAMPTZ,
  moderated_by INTEGER REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_status
  ON product_reviews (product_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_reviews_rating
  ON product_reviews (product_id, rating);

CREATE TABLE IF NOT EXISTS product_review_votes (
  review_id BIGINT NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
  voter_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (review_id, voter_key)
);

CREATE TABLE IF NOT EXISTS product_recommendations (
  id BIGSERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  recommended_product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  placement TEXT NOT NULL CHECK (placement IN (
    'frequently_bought_together',
    'related_products',
    'complete_the_look',
    'customers_also_bought',
    'cart_upsell',
    'checkout_upsell',
    'post_purchase_upsell'
  )),
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, recommended_product_id, placement)
);

CREATE INDEX IF NOT EXISTS idx_product_recommendations_lookup
  ON product_recommendations (product_id, placement, priority DESC);

CREATE TABLE IF NOT EXISTS abandoned_carts (
  id BIGSERIAL PRIMARY KEY,
  cart_token TEXT NOT NULL UNIQUE,
  email TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'recovered', 'expired')),
  recovery_email_count INTEGER NOT NULL DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  recovered_order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_status_updated
  ON abandoned_carts (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS discounts (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN (
    'coupon',
    'automatic',
    'bogo',
    'free_shipping',
    'tiered',
    'volume',
    'first_order',
    'referral'
  )),
  value_type TEXT NOT NULL CHECK (value_type IN ('percent', 'fixed', 'shipping')),
  value NUMERIC(10,2) NOT NULL DEFAULT 0,
  minimum_subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discounts_active
  ON discounts (is_active, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS loyalty_accounts (
  id BIGSERIAL PRIMARY KEY,
  customer_email TEXT NOT NULL UNIQUE,
  points_balance INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  vip_level TEXT NOT NULL DEFAULT 'insider' CHECK (vip_level IN ('insider', 'vip', 'elite')),
  birthday DATE,
  referral_code TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loyalty_points_history (
  id BIGSERIAL PRIMARY KEY,
  loyalty_account_id BIGINT NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_history_account
  ON loyalty_points_history (loyalty_account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS email_workflows (
  id BIGSERIAL PRIMARY KEY,
  workflow_type TEXT NOT NULL CHECK (workflow_type IN (
    'welcome',
    'order_confirmation',
    'shipping',
    'delivery',
    'review_request',
    'abandoned_cart',
    'win_back',
    'new_product',
    'coupon_reminder'
  )),
  subject TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workflow_type)
);

INSERT INTO discounts (code, name, discount_type, value_type, value, minimum_subtotal)
VALUES
  ('FIRST15', 'First Order Discount', 'first_order', 'percent', 15, 50),
  ('VIP20', 'VIP Reward Discount', 'coupon', 'percent', 20, 100),
  (NULL, 'Free Shipping Threshold', 'free_shipping', 'shipping', 0, 100)
ON CONFLICT DO NOTHING;

INSERT INTO email_workflows (workflow_type, subject, delay_minutes)
VALUES
  ('welcome', 'Welcome to PrimeOpp', 0),
  ('order_confirmation', 'Your PrimeOpp order is confirmed', 0),
  ('shipping', 'Your PrimeOpp order shipped', 0),
  ('delivery', 'Your drop was delivered', 0),
  ('review_request', 'How did your PrimeOpp drop fit?', 10080),
  ('abandoned_cart', 'Your PrimeOpp cart is waiting', 60),
  ('win_back', 'A new drop is calling', 43200),
  ('new_product', 'New PrimeOpp drop just landed', 0),
  ('coupon_reminder', 'Your PrimeOpp code expires soon', 2880)
ON CONFLICT DO NOTHING;
