# E.V.E. Verification Guide

E.V.E. (independent verification entity) can verify material execution results produced by this package.

## Verification Surface

E.V.E. can verify:

1. **Evidence integrity**: `EvidenceStore.verify(id)` checks that stored content hash matches the recorded hash.
2. **Operation terminal states**: Every `OperationResult` carries an explicit `state` — E.V.E. can confirm operations terminated (no silent failures).
3. **Idempotency replay**: `InventoryOperationResult.idempotentReplay` indicates whether an operation was a replay.
4. **Audit trail**: `CatalogAuditLog` records every mutation with before/after snapshots.
5. **Event log**: `CommerceEventSink.events` (in-memory) or external event sink records every state change.
6. **Tenant isolation**: Cross-tenant access guards throw — E.V.E. can attempt cross-tenant access to verify denial.
7. **Verify command output**: `npm run verify` produces `evidence/RUNTIME_VERIFICATION.md` and four JSON evidence files.

## Evidence Files

```text
evidence/
  RUNTIME_VERIFICATION.md
  TEST_RESULTS.json
  WORKFLOW_RESULTS.json
  SECURITY_RESULTS.json
  PACKAGE_RESULTS.json
```

## Independent Verification

E.V.E. should:

1. Run `npm run verify` independently (not trust this package's self-report).
2. Inspect `evidence/TEST_RESULTS.json` for test counts.
3. Inspect `evidence/WORKFLOW_RESULTS.json` for workflow A-L outcomes.
4. Inspect `evidence/SECURITY_RESULTS.json` for adapter conformance.
5. Inspect `evidence/PACKAGE_RESULTS.json` for package-export completeness.

## Critical Rule

**Runtime evidence outweighs documentation claims.** If E.V.E.'s independent verification produces different results than this package's self-report, E.V.E. wins.
