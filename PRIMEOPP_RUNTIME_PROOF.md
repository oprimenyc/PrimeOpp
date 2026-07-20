# PrimeOpp Runtime Proof

All commands below were run for real, from `modules/commerce-core`, against a throwaway
`--data-dir` outside the repo. Each `catalog` invocation is a genuinely separate OS
process (`node packages/cli/src/index.ts ...`) — persistence is proven across real
process boundaries, not just within one script's in-memory state.

## 1. Success path — manual product entry

```
$ node packages/cli/src/index.ts catalog ingest manual-product.json --data-dir <dir> --tenant demo-tenant
Created canonical product product_1d6af5349bacd292: "Anker PowerCore 10000 Portable Charger"
EXIT: 0
```

## 2. Success path — recognized barcode via local fixture provider

```
$ node packages/cli/src/index.ts catalog ingest barcode-fixture.json --data-dir <dir> --tenant demo-tenant
Created canonical product product_42f5195c5a187dee: "Kraft Original Macaroni & Cheese Dinner, 7.25 oz Box"
EXIT: 0
```

## 3. Duplicate path — same barcode submitted again (intake-level dedup)

```
$ node packages/cli/src/index.ts catalog ingest barcode-fixture.json --data-dir <dir> --tenant demo-tenant
Duplicate of intake record 32e2bb78-a54c-4748-9035-2abca8e531a6 -- not re-ingested.
EXIT: 1
```

## 4. Failure path — insufficient manual data (intake rejection)

```
$ node packages/cli/src/index.ts catalog ingest insufficient-manual.json --data-dir <dir> --tenant demo-tenant
Rejected at intake: Manual product entry requires at least a title, or both brand and model.
EXIT: 1
```

## 5. Bad input — missing file

```
$ node packages/cli/src/index.ts catalog ingest does-not-exist.json --data-dir <dir> --tenant demo-tenant
File not found: <dir>/does-not-exist.json
EXIT: 2
```

## 6. Bad input — malformed JSON

```
$ node packages/cli/src/index.ts catalog ingest malformed.json --data-dir <dir> --tenant demo-tenant
Invalid JSON in <dir>/malformed.json: Expected property name or '}' in JSON at position 2 (line 1 column 3)
EXIT: 2
```

## 7. Catalog list (human-readable) — persisted across the two prior process runs

```
$ node packages/cli/src/index.ts catalog list --data-dir <dir> --tenant demo-tenant
product_1d6af5349bacd292  Anker PowerCore 10000 Portable Charger  (identifiers=0, version=0)
product_42f5195c5a187dee  Kraft Original Macaroni & Cheese Dinner, 7.25 oz Box  (identifiers=1, version=0)
EXIT: 0
```

## 8. Catalog list (`--json`)

Full `Product` records printed as JSON, including provenance/lineage, confidence
breakdown, and identifiers — confirmed well-formed and complete (see session transcript
for full output; omitted here for length).

## 9. The actual bug fix, proven — identity-level dedup independent of intake-level dedup

This is the core defect found and fixed this session: `PrimeOppSdk`'s identity resolver
adapter was test-only and never checked the real catalog, so identity-based duplicate
detection was silently non-functional. Proof that the fix works, via two separate
processes:

```
# Simulate a fresh operator session: wipe intake.json (no memory of prior submissions),
# but KEEP catalog.json (the persisted canonical catalog from steps 1-2 above).
$ rm <dir>/intake.json

$ node packages/cli/src/index.ts catalog ingest barcode-fixture.json --data-dir <dir> --tenant demo-tenant --json
{
  "outcome": "ALREADY_IN_CATALOG",
  "resolution": {
    "state": "EXACT_MATCH",
    "candidates": [{
      "productId": "product_42f5195c5a187dee",
      "confidence": 1,
      "matchedFields": ["barcode"],
      "source": "catalog.persisted.product-identity"
    }],
    "selectedCandidateId": "product_42f5195c5a187dee",
    "recommendedNextAction": "use selected candidate as canonical product"
  },
  "reason": "use selected candidate as canonical product"
}
EXIT: 1

$ node packages/cli/src/index.ts catalog list --data-dir <dir> --tenant demo-tenant
product_1d6af5349bacd292  Anker PowerCore 10000 Portable Charger  (identifiers=0, version=0)
product_42f5195c5a187dee  Kraft Original Macaroni & Cheese Dinner, 7.25 oz Box  (identifiers=1, version=0)
EXIT: 0
```

Catalog size stayed at exactly 2 after this re-ingestion attempt — no duplicate was
created, even though intake-level memory was wiped. The `catalog.persisted.product-identity`
adapter correctly found the existing product by exact barcode match against the
persisted catalog file, something the prior `LocalTestProductIdentityAdapter`-based
wiring could never do.

## Automated equivalent of the above

The exact same scenarios (minus the CLI process boundary, which is additionally proven
above) are asserted in `modules/commerce-core/packages/pipeline/tests/pipeline.test.ts`,
including a dedicated file-backed-persistence test that also spans separate object
instances pointed at the same on-disk files. See `PRIMEOPP_TEST_REPORT.md`.
