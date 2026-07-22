# PrimeOpp — Next Product Build Plan

## Decision Order Walkthrough

1. **Barcode scan/manual barcode → product-intake** — **THIS IS THE GAP.** Nothing exists here at all (see barcode audit): no UI, no API route, no wiring to the real, tested `product-intake` classification logic.
2. Product-intake → enrichment — the bridge code exists in the modules themselves, but is moot until step 1 produces a real `ProductIntakeRecord` to feed it.
3. Enrichment → product listing draft — same: moot until step 1/2 exist.
4. Product listing draft → live `products` table — partially addressed this session (the dry-run `commerce-worker` adapter maps a canonical `Product` to the live schema), but still has nothing upstream feeding it real data, and the live schema has no draft/listing-state column to represent a "draft" in the first place.
5. Seller/admin approval — not applicable yet; there's no multi-source listing creation to approve.
6. Marketplace publishing — far downstream; no marketplace exists at all (see marketplace audit).
7. Pricing/Stripe activation — a real, ready code path; blocked only by the owner setting real keys in the Railway dashboard, not by anything to build.

**Selected next blocker: #1 — manual barcode/identifier entry, wired to the existing tested `product-intake` classification logic, surfaced in the live admin product form.**

## Why This One

- It's the actual root gap — every downstream step in the decision order depends on this existing first.
- It's the cheapest version of "barcode scanning" that's still real and useful: a text input + a lookup button, not a camera integration project.
- It reuses code that already exists and already passes 134 tests (`modules/product-intake`) — this isn't new business logic, it's wiring.
- It doesn't touch Stripe, doesn't touch the marketplace question, and doesn't require any schema decision about listing states yet — small, safe, isolated scope.

## What This Explicitly Does NOT Include (deliberately deferred)

- Camera-based scanning (a separate, larger investment — a real barcode-decode library, camera permissions UI, mobile testing).
- Any change to the marketplace/seller question.
- Any change to Stripe/payment configuration.
- Connecting `product-enrichment` or `commerce-core` yet — this step only needs to prove identifier classification works end-to-end from a real admin action, not the full pipeline.

## Exact Next Implementation Prompt (Paste-Ready)

> In `C:\Users\jp718\Documents\GitHub\PrimeOpp`, add manual barcode/identifier entry to the admin product form. Scope:
>
> 1. In `artifacts/api-server`, add a new route `POST /api/admin/products/classify-identifier` (admin-auth-protected, `requirePermission("products:write")`) that accepts `{ value: string }`, imports `modules/product-intake`'s identifier classification logic (note: `modules/product-intake` is a separate npm project outside the pnpm workspace — either add it as a pnpm workspace member if its own package.json/build can be adapted, or vendor just the pure `identifier-detector.ts` + `validation/index.ts` classification functions into `artifacts/api-server` as a local module, following the same "local structural mirror" pattern already used elsewhere in this repo — pick whichever is less invasive after inspecting `modules/product-intake/package.json` and its actual runtime dependencies), and returns the classified identifier type, validity, and confidence — no database write, this is a pure lookup/classification endpoint.
> 2. In `artifacts/primeopp/src/pages/admin.tsx`, add a barcode/identifier text input to the product form with a "Classify" button that calls the new endpoint and displays the result (type, valid/invalid, confidence) inline — informational only, does not yet auto-fill other fields or create the product.
> 3. Add tests: the classification function's existing test coverage should be preserved/reused (don't rewrite it), plus a new test for the new API route proving it requires admin auth and returns correct classification for a known-valid and a known-invalid barcode.
> 4. Do not wire this to `product-enrichment`, `commerce-core`, or any external barcode-lookup provider yet — that's explicitly the next step after this one, not part of this scope.
> 5. Run typecheck/build/test for both `artifacts/api-server` and `artifacts/primeopp` before considering this done, and manually verify the new field renders and calls the endpoint in a local dev run.
