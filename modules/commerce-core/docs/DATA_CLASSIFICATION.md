# Data Classification

## Sensitivity Levels

`EventSensitivity` has 6 levels, in increasing order of restriction:

1. **PUBLIC** — safe to share across tenants and externally. Examples: canonical product facts (UPC, brand), public category taxonomy.
2. **TENANT** — visible to anyone in the tenant. Examples: inventory records, listing drafts, scan events.
3. **ORGANIZATION** — visible to anyone in the organization. Examples: cross-location inventory aggregation, org-level pricing policy.
4. **SELLER_PRIVATE** — visible only to the seller. Examples: sourcing notes, supplier identities.
5. **COST_BASIS** — visible only to those authorized to see costs. Examples: purchase price, lot allocation, per-unit cost basis.
6. **SECRET** — never appears in plaintext. Examples: API keys (stored as SecretRef to Prime Vault).

## Cross-Tenant Sharing

`redactEventForSharing(event)` drops COST_BASIS, SELLER_PRIVATE, and SECRET events entirely. TENANT and ORGANIZATION events have their payload stripped for PUBLIC sharing.

## Storage

- In-memory stores do NOT enforce encryption at rest (they are ephemeral).
- The `EvidenceStore` interface accepts encrypted backing stores; the in-memory implementation is for tests only.
- The `TenantConfigStore` interface accepts encrypted backing stores; same caveat.

## Audit Trail

Every mutation produces an audit entry. Audit entries themselves are TENANT sensitivity by default; entries that touch SELLER_PRIVATE or COST_BASIS data carry those higher sensitivities.
