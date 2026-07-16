# Retailer Adapters

20 starter retailers are represented in the registry. For every retailer:

- adapter manifest (in `retailer-registry`)
- supported source methods
- URL patterns (via `domains`)
- extraction contracts (via `crawler-contracts` parsers)
- promotion concepts (via `RetailerPromotionMethod`)
- availability concepts (via `RetailerAvailabilityMethod`)
- regional limitations (via `regions`)
- authentication requirements (via `accessRestrictions`)
- affiliate notes (via `affiliateProgram`)
- known volatility (placeholder)
- terms/robots review placeholder — `legalReviewStatus: 'pending'`
- fixture pages or structured fixtures (provided in `fixtures/`)
- conformance tests (via `adapter-testkit`)

**No retailer claims live scraping support.** All evidence is
fixture-based. External live verification is pending.
