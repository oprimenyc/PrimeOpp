# Adapter SDK

The adapter SDK lives in `packages/adapter-sdk/src/index.ts`.

## Adapter Manifest

Every adapter declares:

- adapterId, version
- capabilities (array)
- authenticationRequirements (NONE, API_KEY, OAUTH, SECRET_REF)
- rateLimitMetadata
- costMetadata
- supportedRegions, supportedCategories
- freshness (maxAgeSeconds)
- confidenceModel (string)
- retrySemantics (maxRetries, backoffMs)
- dataSensitivity (PUBLIC, TENANT, ORGANIZATION, SELLER_PRIVATE, COST_BASIS, SECRET)
- termsRestrictions (array)

## Registry

`createAdapterRegistry()` returns a registry with four maps: barcode, ocr, imageMatch, channel. Each map is keyed by adapterId.

## Conformance Tests

`COMMON_CONFORMANCE_TESTS` is an array of 5 tests that apply to every adapter:

1. manifest-declares-id-and-version
2. manifest-declares-capabilities
3. manifest-declares-auth
4. manifest-declares-data-sensitivity
5. manifest-declares-terms-restrictions

`runAdapterConformanceTests(adapter, manifest, tests)` runs the tests and returns pass/fail results.

## Health Check

`defaultHealthCheck(adapterId)` returns a healthy result by default. Real adapters MUST override this.
