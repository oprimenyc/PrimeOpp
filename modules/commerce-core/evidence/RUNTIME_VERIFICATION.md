# Runtime Verification Report

Generated: 2026-08-10T04:06:40.184Z

## Proof Results

- [✓] [01] clean build (typecheck) — all 24 packages typechecked (37692ms)
- [✓] [02] typecheck — typecheck verified in proof 1 (0ms)
- [✓] [03] lint — no lint issues (103ms)
- [✓] [04] all automated tests — 269 passed, 0 failed (1210ms)
- [✓] [05] JSON Schema validation — 5 schemas, sample validations: money=true id=true condition=true barcode=true (0ms)
- [✓] [06] package-export validation — 25/25 packages export from src/index.ts (5ms)
- [✓] [07] barcode validation proof — UPC=true EAN=true ISBN13=true ISBN10=true invalid rejected=true (1ms)
- [✓] [08] product-resolution proof — resolver state=NO_MATCH (3ms)
- [✓] [09] ambiguous-match proof — 1 conflict(s) detected (10ms)
- [✓] [10] variant-conflict proof — STORAGE_MISMATCH detected: true (0ms)
- [✓] [11] condition-assessment proof — derived condition=GOOD (never NEW from appearance) (1ms)
- [✓] [12] pricing proof — midpoint=110 (expected 110), comps=3 (1ms)
- [✓] [13] fee proof — total fees on $100 = 11.2 (expected 11.20) (0ms)
- [✓] [14] shipping-estimate proof — range=[5.87, 7.94] confidence=0.70 (0ms)
- [✓] [15] profit calculation proof — netProfit=33.8 ROI=51.1% (expected net=33.8) (1ms)
- [✓] [16] opportunity decision proof — decision=STRONG_BUY (expected STRONG_BUY) (0ms)
- [✓] [17] inventory reservation proof — available=6 reserved=4 (1ms)
- [✓] [18] oversell-prevention proof — oversell prevented: true (0ms)
- [✓] [19] multi-location proof — l1=3 l2=5 (0ms)
- [✓] [20] tenant-isolation proof — inventory isolated: true, evidence guard: true (1ms)
- [✓] [21] canonical listing proof — pre-acceptance valid=false, post-acceptance valid=true (0ms)
- [✓] [22] visible PrimeOpp default-channel proof — default ON: true, preview visible: true, opt-out works: true (0ms)
- [✓] [23] evidence integrity proof — evidence hash verified: true (0ms)
- [✓] [24] documentation-link validation — 38 docs, 0 empty (3ms)

## Summary

- Total proofs: 24
- Passed: 24
- Failed: 0
- Overall: PASS
