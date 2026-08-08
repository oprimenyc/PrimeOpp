-- Distinguishes a product IDENTITY record (something the sourcing/identity-
-- correction flow needs so a scanned item can be linked and market evidence
-- can attach to it) from a PUBLISHABLE storefront product (something that
-- may legitimately appear in the public catalog and reach checkout).
--
-- Root cause this closes: POST /products has never server-side enforced the
-- "affiliate products require an affiliate link" rule -- that rule only ever
-- existed as a client-side check in admin.tsx's form (see handleSubmit).
-- IdentityCorrectionPanel calls the exact same POST /products endpoint with
-- only a title, so it silently produced a live, publicly-listed, checkout-
-- purchasable affiliate product with no link and no real price.
--
-- Additive only -- no drops. DEFAULT true means every existing row (all of
-- which were created through the admin form that already enforces the link
-- requirement) is grandfathered in as published; nothing already in the
-- catalog changes behavior.
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_products_is_published ON products (is_published);
