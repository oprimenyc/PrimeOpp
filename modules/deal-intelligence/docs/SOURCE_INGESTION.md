# Source Ingestion

The `source-ingestion` package records observations with full provenance.
Source precedence (1 = highest):
1. `official-api` / `retailer-feed`
2. `affiliate-feed`
3. `structured-csv` / `structured-json` / `webhook` / `rss` / `product-feed` / `authorized-partner-feed`
4. `browser-operator`
5. `community-submission`
6. `manual-entry` / `retailer-newsletter` / `email-export`
7. unknown / unsupported

Every observation includes: source, retailer, product identifier, URL,
observed price, availability, promotion, coupon, region, store, timestamp,
evidence, confidence, terms restriction, freshness, extraction method,
and precedence. Provenance is never stripped.
