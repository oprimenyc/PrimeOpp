# Integration Guide for PrimeOpp Codebase Owners

This document explains how to integrate `primeopp-product-intake` into the real PrimeOpp application.

---

## Public Exports

The module's barrel export (`src/index.ts`) exposes:

### Types (stable contracts)
- `ProductIntakeRecord` — Primary output contract for downstream modules.
- `RawProductInput` — Input contract.
- `BatchProductIntakeRequest` / `BatchProductIntakeResult` — Batch contracts.
- `NormalizedProductIdentifier` — Classified, validated identifier.
- `ScannerEvent` — Provider-neutral scanner event contract.
- `IntakeDeduplicationStore` — Deduplication store interface.
- `IntakeRecordRepository` — Persistence repository interface.
- `ValidationIssue` — Structured validation result.
- All enum-like union types: `ProductIdentifierType`, `InputMethod`, `IntakeStatus`, `ClassificationConfidence`, `ValidationSeverity`.

### Services
- `ProductIntakeService` — Primary orchestration service.

### Adapters
- `InMemoryDeduplicationStore` — Default in-memory dedup (testing/sessions).
- `InMemoryIntakeRecordRepository` — Default in-memory persistence.
- `scannerEventToInput()`, `hardwareScannerStringToEvent()`, `cameraScanToEvent()`, `apiSubmissionToInput()` — Scanner translation helpers.

### Domain Utilities
- `analyzeIdentifier()` — Standalone identifier classification.
- `generateProductFingerprint()` — Manual product dedup fingerprint.
- `validateManualProductMinimum()` — Minimum field validation.

### Validation Utilities
- `normalizeRawIdentifier()`, `isNumeric()`, `validateGtinChecksum()`, `validateIsbn10Checksum()`, `validateIsbn13Checksum()`.

### Errors
- `IntakeError`, `InvalidInputError`, `DuplicateIntakeError`, `AdapterError`, `UnsupportedInputError`, `InternalIntakeError`.

---

## Required Interfaces

### IntakeDeduplicationStore

The deduplication store must implement:

```typescript
interface IntakeDeduplicationStore {
  findByIdentifier(normalizedValue: string): Promise<ProductIntakeRecord | undefined>;
  findByFingerprint(fingerprint: string): Promise<ProductIntakeRecord | undefined>;
  save(record: ProductIntakeRecord): Promise<void>;
}
```

### IntakeRecordRepository (optional)

If you want the service to persist records to your database:

```typescript
interface IntakeRecordRepository {
  save(record: ProductIntakeRecord): Promise<void>;
  findById(intakeId: string): Promise<ProductIntakeRecord | undefined>;
  findAll(): Promise<ProductIntakeRecord[];
}
```

---

## Host Application Responsibilities

1. **Dependency injection**: Provide a production-backed `IntakeDeduplicationStore` and optionally `IntakeRecordRepository`.
2. **Session management**: Create a new `ProductIntakeService` instance per intake session (or share one if cross-session dedup is desired).
3. **Error handling**: The service returns structured records with status codes. Handle `REJECTED`, `DUPLICATE`, and `NEEDS_REVIEW` appropriately in your UI/API.
4. **Downstream handoff**: Route `ACCEPTED` and `NEEDS_REVIEW` records to the Product Enrichment module.

---

## Database Integration Options

### Option A: Replace DeduplicationStore

Implement the interface against your database (PostgreSQL, MongoDB, Redis):

```typescript
class PostgresDeduplicationStore implements IntakeDeduplicationStore {
  async findByIdentifier(normalizedValue: string) {
    // SELECT * FROM intake_records WHERE normalized_identifier = $1 LIMIT 1
  }
  async findByFingerprint(fingerprint: string) {
    // SELECT * FROM intake_records WHERE product_fingerprint = $1 LIMIT 1
  }
  async save(record: ProductIntakeRecord) {
    // INSERT INTO intake_records (intake_id, ...) VALUES (...)
  }
}
```

### Option B: Use the in-memory store for session dedup, persist separately

```typescript
const service = new ProductIntakeService({
  deduplicationStore: new InMemoryDeduplicationStore(), // session-scoped
  recordRepository: new PostgresIntakeRecordRepository(), // persistent
});
```

---

## API Endpoint Example

```typescript
// Express example (framework-agnostic service works with any host)
app.post("/api/intake", async (req, res) => {
  const input: RawProductInput = {
    rawValue: req.body.barcode,
    inputMethod: "API",
    sourceContext: { userId: req.user.id },
  };

  const record = await intakeService.intake(input);
  res.json(record);
});

app.post("/api/intake/batch", async (req, res) => {
  const result = await intakeService.intakeBatch({
    items: req.body.items,
  });
  res.json(result);
});
```

---

## Web UI Integration Example

```typescript
// Browser-based barcode scanner integration
import { BrowserBarcodeDetector } from "some-scanner-lib";

scanner.on("detected", async (barcode) => {
  const record = await intakeService.intake({
    rawValue: barcode.rawValue,
    inputMethod: "CAMERA_SCAN",
    sourceContext: { cameraId: barcode.cameraId },
  });

  if (record.status === "ACCEPTED") {
    showSuccessUI(record);
  } else if (record.status === "DUPLICATE") {
    showDuplicateWarning(record);
  } else {
    showErrorUI(record.validationIssues);
  }
});
```

---

## Mobile Scanner Integration Example

```typescript
// React Native / Capacitor scanner integration
import { BarcodeScanner } from "@some-mobile-scanner";

const scanResult = await BarcodeScanner.scan();

const record = await intakeService.intake({
  rawValue: scanResult.data,
  inputMethod: "CAMERA_SCAN",
  sourceContext: { platform: "ios", deviceModel: "iPhone 15" },
});

// Send record to backend
await api.post("/api/intake", record);
```

---

## Downstream Module Handoff Contract

The `ProductIntakeRecord` is the handoff contract. Downstream modules should:

1. Accept `ProductIntakeRecord` as input (or its `intakeId` for lookup).
2. Read `identifier.normalizedValue` and `identifier.identifierType` for enrichment lookups.
3. Read `manualProduct` for non-barcoded products.
4. Check `status` — only process `ACCEPTED` or `NEEDS_REVIEW` records.
5. Ignore `REJECTED` and `DUPLICATE` records.
6. Never modify the intake record — it's an immutable log entry.

```typescript
// Example downstream enrichment consumer
function processForEnrichment(record: ProductIntakeRecord) {
  if (record.status !== "ACCEPTED" && record.status !== "NEEDS_REVIEW") return;

  if (record.identifier) {
    return enrichByBarcode(record.identifier.normalizedValue, record.identifier.identifierType);
  }
  if (record.manualProduct) {
    return enrichByTextSearch(record.manualProduct);
  }
}
```

---

## Known Integration Decisions

These decisions must be made by the real PrimeOpp codebase owner:

1. **Persistence layer**: Which database? Schema design for `intake_records` table.
2. **Session boundaries**: Is deduplication session-scoped or global?
3. **ID generation**: Use database sequence, UUID, or ULID for `intakeId`?
4. **Batch size limits**: Should the API enforce a maximum batch size?
5. **Rate limiting**: Per-user or per-session rate limits on intake.
6. **Event bus**: Should intake events be published to a message queue for downstream consumers?
7. **Cross-session dedup**: Should previously intake'd products be checked against future sessions?
8. **Logging and observability**: Which logging framework? What metrics to track?