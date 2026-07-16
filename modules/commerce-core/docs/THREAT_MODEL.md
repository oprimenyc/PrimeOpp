# Threat Model

## Threats and Mitigations

| Threat | Mitigation |
|---|---|
| Product spoofing | Identity resolver never silently chooses low-confidence matches; requires human review below 0.5 confidence. |
| Barcode collision | Local lookup adapter flags `collision: true` when multiple products share a barcode. |
| False comp poisoning | Pricing observations are tenant-scoped; cross-tenant observations are rejected with warnings. |
| Variant mismatch | Variant engine flags SIZE_MISMATCH, COLOR_MISMATCH, etc. Pricing/inventory comparisons are blocked across conflicting variants. |
| Condition fraud | Condition engine never infers NEW from appearance; requires explicit seal evidence. |
| Counterfeit risk | SNEAKERS and COLLECTIBLES profiles require authenticity verification; `authenticityStatus` propagated through pricing observations. |
| Price manipulation | Pricing engine uses median (not max) of sold comps; active-only pricing produces lower confidence. |
| Inventory oversell | Per-record Promise chain lock serializes concurrent operations; idempotency keys prevent double-counting. |
| Duplicate listing | Listing validation requires seller acceptance evidence; `selectedChannels` uniqueness enforced. |
| Duplicate sale | SALE_ALLOCATE consumes reserved first, then available; oversell throws OVERSELL_PREVENTED. |
| Fee schedule tampering | Fee schedules are versioned with effective dates; stale entries flagged in output. |
| Shipping estimate manipulation | Shipping estimator produces a RANGE, not a single value; confidence decreases with missing data. |
| Cross-tenant access | Tenant guards at every layer; evidence, inventory, catalog all enforce tenant isolation. |
| Malicious URL ingestion | URLs accepted only via explicit adapter contracts; SSRF resistance is documented requirement. |
| Affiliate-link substitution | Affiliate offers carry `affiliateOfferRef`; substitution would change the ref and be detected by audit. |
| Seller-account takeover | Tenant config carries roles and permissions; seller actions are scoped to their tenantId. |
| Fraudulent evidence | Evidence records carry content hashes; integrity can be verified via `verifyEvidenceIntegrity`. |

## Attack Surface

This package has no network surface. All adapters are local test adapters. The attack surface is limited to:

1. Malicious input via CLI file arguments (mitigated by JSON parsing + schema validation)
2. Malicious OCR/image match output (mitigated by sanitization contracts)
3. Concurrent race conditions (mitigated by per-record locking)
