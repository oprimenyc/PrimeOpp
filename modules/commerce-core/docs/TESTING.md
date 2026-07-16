# Testing

## Test Framework

Tests use Node's built-in `node:test` runner. No external test framework is required.

## Running Tests

```bash
# All tests
npm test

# Single package
node --test packages/barcode/tests/barcode.test.ts
```

## Test Categories

Per the mission spec (Phase 27), the following test categories are covered:

- unit tests ✓
- schema tests ✓ (`packages/schemas/tests/schemas.test.ts`)
- serialization tests ✓ (via stableStringify + hashString)
- barcode validation tests ✓
- product resolution tests ✓
- conflict tests ✓
- variant tests ✓
- condition tests ✓
- catalog tests ✓
- inventory tests ✓
- concurrency tests ✓
- reservation tests ✓
- oversell tests ✓
- pricing tests ✓
- fee tests ✓
- shipping-estimate tests ✓
- profit tests ✓
- opportunity tests ✓
- listing tests ✓
- channel-conformance tests ✓
- tenant-isolation tests ✓
- enterprise-location tests ✓
- idempotency tests ✓
- replay tests ✓
- redaction tests ✓
- malicious-input tests ✓ (OCR sanitization)
- Windows path tests ✓ (paths use `join` and forward-slash)
- Linux path tests ✓
- CLI tests ✓ (via demo command)
- package-export tests ✓ (verify proof 6)

## Test Adapter Labeling

Every test adapter is clearly labeled TEST-ONLY in its manifest's `termsRestrictions` array. The adapter-testkit package verifies this labeling in its conformance tests.

## No External Dependencies

No tests require real credentials or paid APIs. All adapters are local and deterministic.
