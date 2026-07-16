# External Order Ingestion

**Package:** primeopp-marketplace-platform

**Last updated:** 2026-01-01

## Validation

- Tenant match
- Seller channel account match
- HMAC-SHA256 signature verification
- Idempotency / duplicate detection
- Stale event detection (>7 days)
- Suspicious mismatch detection

## Tests

See Workflow E + duplicate-event test in packages/sdk/test/workflows.test.ts
