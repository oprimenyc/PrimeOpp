# Discount Validation

Detects 16 discount kinds: fake-inflated-msrp, repeated-sale-price,
ordinary-recurring-discount, genuine-historical-low, near-historical-low,
lowest-observed-price, temporary-markdown, regional-markdown,
member-only-markdown, clearance, liquidation, pricing-error,
likely-stale-price, unavailable-teaser-price, bundle-value-distortion,
shipping-offset-discount.

Produces: advertised discount %, effective discount %, historical
discount %, confidence, risk flags, evidence, explanation,
verification needed.

Does NOT rely on advertised percentage alone.
