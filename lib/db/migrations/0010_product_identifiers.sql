-- Product identifier map for local barcode/SKU/style-code lookup.
-- Additive only: does not require existing products to have identifiers and
-- does not enable external provider calls, publishing, payments, or KYC.

CREATE TABLE IF NOT EXISTS product_identifiers (
  id BIGSERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  identifier TEXT NOT NULL,
  identifier_type TEXT NOT NULL CHECK (
    identifier_type IN ('UPC', 'EAN', 'GTIN', 'SKU', 'STYLE_CODE', 'ISBN', 'OTHER')
  ),
  normalized_identifier TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'MANUAL' CHECK (
    source IN ('MANUAL', 'IMPORT', 'LOCAL_CATALOG', 'GENERATED_REFERENCE')
  ),
  confidence TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (
    confidence IN ('HIGH', 'MEDIUM', 'LOW')
  ),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_identifiers_normalized_type
  ON product_identifiers (normalized_identifier, identifier_type);

CREATE INDEX IF NOT EXISTS idx_product_identifiers_product_id
  ON product_identifiers (product_id);

CREATE INDEX IF NOT EXISTS idx_product_identifiers_normalized
  ON product_identifiers (normalized_identifier);
