CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('pod', 'affiliate')),
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC,
  category TEXT,
  thumbnail_url TEXT,
  external_link TEXT,
  stock_level INTEGER,
  shipping_info TEXT,
  colors JSONB NOT NULL DEFAULT '[]'::jsonb,
  sizes JSONB NOT NULL DEFAULT '[]'::jsonb,
  pod_provider TEXT CHECK (pod_provider IS NULL OR pod_provider IN ('printful', 'tapstitch')),
  printful_variant_id TEXT,
  tapstitch_variant_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_type ON products (type);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products (created_at DESC);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  customer_email TEXT NOT NULL DEFAULT '',
  customer_name TEXT,
  shipping_address JSONB,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC,
  total NUMERIC,
  fulfillment_provider TEXT,
  fulfillment_order_id TEXT,
  fulfillment_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT orders_status_check CHECK (
    status IN ('pending', 'paid', 'processing', 'fulfilled', 'shipped', 'delivered', 'refunded')
  )
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders (customer_email);
