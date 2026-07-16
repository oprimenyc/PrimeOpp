# Testing

Tests use vitest. Run all tests:

```bash
npm test
```

Test coverage (160 tests across 30 files):

- Unit, schema, serialization tests (contracts, schemas)
- Retailer registry tests (20 retailers)
- Source ingestion and parser tests
- Product normalization and variant conflict tests
- Offer normalization tests
- Promotion and coupon stack tests
- Historical pricing and fake-discount tests
- Availability, restock, scarcity tests
- Deal validation, scoring, resale tests
- Affiliate, disclosure, alert, duplicate-alert tests
- Community submission and moderation tests
- Dead-deal and correction tests
- Tenant isolation tests
- URL security and malicious input tests
- Prompt-injection resistance tests
- Rate-limit, retry, circuit-breaker tests
- Windows path and Linux path tests
- CLI tests
- Package-export tests

No test requires real credentials, paid APIs or live retailer scraping.
All test adapters are labeled test-only.
