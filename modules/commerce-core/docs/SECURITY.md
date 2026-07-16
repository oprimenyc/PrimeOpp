# Security

## Tenant Isolation

- Every record carries `tenantId`.
- Every storage adapter filters by `tenantId`.
- Every cross-tenant access throws `CROSS_TENANT_*`.
- Cost basis, profit data, supplier data, and sourcing notes are tenant-private by default.
- Public product facts and tenant-private facts are stored separately.

## Secrets

- No raw secrets in code or config.
- Adapter authentication uses `SecretRef` (Prime Vault reference) — never an embedded secret value.
- `TenantConfig.adapterSecrets` maps adapterId → SecretRef.

## Input Validation

- All inputs validated via `@primeopp/schemas` runtime validators.
- Input size limits enforced (e.g. CUSTOM barcode ≤ 256 chars).
- File reference validation: image refs must match `evidence://...` pattern.
- URL validation: URLs are accepted only via explicit adapter contracts (SSRF-resistant).

## Prompt Injection Resistance

- `sanitizeOcrOutput` strips common prompt-injection patterns from OCR text.
- AI adapter boundaries are documented as requiring prompt-injection sanitization.
- All adapter output is treated as untrusted.

## HTML Stripping

- Untrusted HTML stripping contracts are documented as adapter requirements.
- Listing descriptions accept plain text by default; rich-text adapters must sanitize.

## Idempotency & Replay Protection

- Every mutating operation accepts `idempotencyKey`.
- `ReplayDetector` tracks seen event IDs and rejects duplicates.

## Concurrency Safety

- Inventory engine serializes per-record operations via Promise chain lock.
- Concurrent oversell attempts are prevented.

## Audit

- Every catalog mutation appends to `CatalogAuditLog`.
- Every commerce event is emitted via `CommerceEventSink` with sensitivity classification.
- Every evidence record carries a content hash for integrity verification.
