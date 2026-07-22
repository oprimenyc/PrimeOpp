# PrimeOpp Next Crosslisting Build Plan

Date: 2026-07-22
Repo: `C:\Users\jp718\Documents\GitHub\PrimeOpp`

## Chosen Next Blocker

Manual barcode/identifier entry and classification in the admin/API.

## Why This Is Next

Decision priority says:

1. camera barcode scanner if no scan input exists
2. listing draft model/UI if scan cannot create a listing draft
3. marketplace channel model if listing draft exists but no channels
4. dry-run crosslisting publisher if channels exist
5. provider integration only after dry-run and approval gate exist
6. Stripe/revenue activation only after listing flow is real

No scan input exists in the live app. A full camera scanner is larger than necessary for the next safe step, but a manual barcode/identifier input creates the first real live entry point and can reuse already-tested `product-intake` logic.

This should come before listing draft UI because a draft should be created from a real intake/enrichment candidate, not from another hand-built form.

## What Not To Build Yet

Do not build yet:

- Live external marketplace adapters.
- eBay/Amazon/Walmart/Etsy/etc provider calls.
- Camera scanning as the first step.
- Marketplace/crosslisting claims.
- Stripe/revenue activation as a substitute for listing-flow proof.
- Migrations for marketplace tables before the draft model is designed.
- Provider credential storage until dry-run + approval gates exist.
- Fake wrappers around marketplace APIs.

## Desired Result Of Next Build

Admin/operator can enter an identifier such as a UPC/EAN/GTIN/SKU and receive a classification result:

- normalized value
- identifier type
- validity
- checksum status where applicable
- confidence
- ambiguity notes
- validation issues

No DB writes. No provider calls. No product creation. No enrichment yet.

## Exact Paste-Ready Implementation Prompt

```text
MODEL:
Codex or Claude Code - high reasoning

TARGET REPO:
C:\Users\jp718\Documents\GitHub\PrimeOpp

BRANCH:
integration/full-primeopp-platform

MISSION:
PRIMEOPP SCAN ENTRY POINT - MANUAL IDENTIFIER CLASSIFICATION ONLY

Scope:
PrimeOpp only.

Goal:
Add the first real scan-to-crosslist entry point: manual barcode/identifier classification in the admin surface. Do not build enrichment, listing drafts, marketplace publishing, provider integrations, Stripe changes, migrations, or camera scanning in this pass.

DO NOT:
- deploy
- call Stripe
- call marketplace APIs
- call barcode/product lookup providers
- mutate providers
- run migrations
- print secrets or env values
- change DNS
- touch other repos
- force push or rewrite history
- create fake marketplace integrations
- claim crosslisting works

OWNER APPROVAL GRANTED:
- inspect PrimeOpp repo
- reuse existing tested identifier classification logic from modules/product-intake if practical
- add a minimal local copy/adapter of pure classification code if importing the module is too invasive
- add admin-auth-protected API endpoint
- add admin UI field/button/result display
- add focused tests
- commit/push non-force if changed

IMPLEMENTATION:

1. API:
   - Add POST /api/admin/products/classify-identifier in artifacts/api-server.
   - Require admin auth and requirePermission("products:write").
   - Accept { value: string }.
   - Return normalized value, identifier type, isValidFormat, checksumValid if applicable, confidence, ambiguityNote, alternativeTypes, and validation issues.
   - No database reads/writes.
   - No external HTTP calls.

2. Classification logic:
   - Prefer reusing modules/product-intake/primeopp-product-intake/src/domain/identifier-detector.ts and validation helpers if it can be imported cleanly.
   - If workspace/import friction is high, copy only the pure local classification/checksum logic into artifacts/api-server with a source note and tests. Do not bring unrelated intake storage/batch code.

3. UI:
   - In artifacts/primeopp/src/pages/admin.tsx, add a manual barcode/identifier input to the product form.
   - Add a Classify button.
   - Display result inline.
   - Do not auto-fill product fields yet.
   - Do not create products from the identifier yet.

4. Tests:
   - API test for unauthenticated rejection.
   - API test for valid UPC-A, invalid checksum, SKU/manual identifier behavior.
   - Preserve existing tests.

5. Validation:
   - Run targeted typecheck/build/test for artifacts/api-server and artifacts/primeopp.
   - Document results in a short proof doc.

FINAL HANDOFF MUST INCLUDE:
- endpoint added
- UI field added
- tests/typecheck/build results
- secrets printed: NO
- providers mutated: NO
- migrations run: NO
- marketplace APIs called: NO
- next blocker after this
```

