# Contract Compatibility

## Future integration seams

| External system | Integration seam in this package | Status |
|-----------------|----------------------------------|--------|
| PrimeOpp (public site) | `publishing-contracts` Publication target `primeopp-website` | PENDING |
| PrimeOpp Commerce Core | `product-normalization` (ProductCandidate), `resale-opportunity` (ResaleAnalysis) | PENDING |
| Foundry | Adapter SDK `AdapterCapability` healthCheck + retrySemantics | PENDING |
| E.V.E. | `evidence` (chain-of-custody), `observability` events | PENDING |
| PrimeOS | `tenant-config` (TenantConfig isolation) | PENDING |
| AMOS | `amos-contracts` (AmosJob) | PENDING |
| Browser Operator | `browser-contracts` (BrowserOperatorAdapter) | PENDING |
| Prime Vault | All credential fields are `credentialRef` strings, never raw values | PENDING |

## Reused contracts

None. All contracts in this package are newly authored and may evolve before
the consuming systems declare formal compatibility.

## Compatibility classes

| Class | Meaning |
|-------|---------|
| VERIFIED | Source code inspected and contract confirmed compatible. |
| INFERRED | Source code unavailable; compatibility inferred from public documentation. |
| CLAIMED | External system claims compatibility but no evidence reviewed. |
| UNKNOWN | No information available. |

All seams in this package are currently **UNKNOWN** until the consuming
systems declare compatibility.
