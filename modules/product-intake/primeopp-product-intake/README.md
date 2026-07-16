# primeopp-product-intake

**Normalize and validate product intake from barcode scans, identifiers, manual entry, and batch input.**

This is the first module in the PrimeOpp commerce-intelligence pipeline:

```
SCAN / INPUT → IDENTIFY → NORMALIZE → PREPARE FOR ENRICHMENT
```

---

## What This Module Does

- Accepts product identifiers from camera scans, hardware scanners, manual entry, batch uploads, or API calls.
- Detects and classifies barcode formats: UPC-A, UPC-E, EAN-8, EAN-13, GTIN-8/12/13/14, ISBN-10, ISBN-13, and SKUs.
- Normalizes identifiers into a stable canonical representation (deterministic: same input always produces same output).
- Validates format correctness, length constraints, and checksums (GTIN, ISBN-10, ISBN-13).
- Detects duplicate identifiers and duplicate manual product entries within an intake session.
- Processes batch intake where individual item failures do not fail the entire batch.
- Produces a stable, JSON-serializable `ProductIntakeRecord` ready for downstream consumption.

## What This Module Intentionally Does NOT Do

- **No marketplace comparisons.** It does not look up products on Amazon, eBay, or any marketplace.
- **No pricing or profitability analysis.** All pricing logic belongs in downstream modules.
- **No product enrichment.** It does not call external product databases or APIs.
- **No listing generation.** SEO listing creation is a separate downstream module.
- **No cross-listing logic.** Multi-marketplace payload building is handled later in the pipeline.
- **No AI-provider dependencies.** No LLM or AI service calls are part of core intake.
- **No persistent database requirement.** Uses an in-memory store by default; persistence is an integration decision.
- **No framework coupling.** Core logic is plain TypeScript, usable from any host application.

---

## Installation

```bash
npm install
```

No runtime dependencies are required. All dependencies are dev-only (TypeScript, Jest).

---

## Build

```bash
npm run build
```

Output goes to `dist/`.

---

## Test

```bash
npm test
```

Tests use Jest with ts-jest. See `VERIFICATION.md` for the full verification report.

---

## Usage

### Quick Start

```typescript
import {
  ProductIntakeService,
  InMemoryDeduplicationStore,
} from "primeopp-product-intake";

const service = new ProductIntakeService({
  deduplicationStore: new InMemoryDeduplicationStore(),
});

// Single barcode intake
const record = await service.intake({
  rawValue: "036000291452",
  inputMethod: "MANUAL_IDENTIFIER",
});

console.log(record.status);       // "ACCEPTED"
console.log(record.identifier?.identifierType);  // "UPC_A"
console.log(record.identifier?.checksumValid);   // true
```

### Scanner Input

```typescript
import {
  scannerEventToInput,
  hardwareScannerStringToEvent,
} from "primeopp-product-intake";

// Camera scan
const input = scannerEventToInput({
  value: "036000291452",
  symbology: "UPC_A",
  capturedAt: new Date().toISOString(),
});

// Hardware scanner (strips \r\n terminator)
const event = hardwareScannerStringToEvent("036000291452\r\n", "usb-01");
const input2 = scannerEventToInput(event);
```

### Batch Intake

```typescript
const result = await service.intakeBatch({
  items: [
    { rawValue: "036000291452", inputMethod: "BATCH_IMPORT" },
    { rawValue: "5901234123457", inputMethod: "BATCH_IMPORT" },
  ],
});

console.log(result.totalReceived);  // 2
console.log(result.accepted);       // 2
```

### Manual Product (No Barcode)

```typescript
const record = await service.intake({
  inputMethod: "MANUAL_PRODUCT",
  manualProduct: {
    title: "Handmade Ceramic Vase",
    brand: "Artisan Home",
    model: "CHV-2024",
  },
});
```

---

## Architecture

```
src/
  types/           Stable contracts (ProductIntakeRecord, etc.)
  domain/          Identifier detection, fingerprinting
  validation/      Checksum, format, length validation
  normalization/   Input cleaning, canonical representation
  deduplication/   Session-scoped duplicate detection
  batch/           Batch processor (fault-tolerant)
  application/     ProductIntakeService (orchestration)
  adapters/        Scanner event translation, in-memory repository
  errors/          Structured error types
  index.ts         Public barrel exports
```

The `ProductIntakeService` orchestrates the pipeline:
1. Normalize raw input
2. Detect and classify identifier type
3. Validate format and checksum
4. Check for duplicates (via pluggable store)
5. Create and persist the intake record
6. Return the result

---

## Identifier Support

| Format | Length | Checksum | Confidence | Notes |
|--------|--------|----------|------------|-------|
| UPC-A | 12 digits | GTIN | HIGH | Alternative: GTIN-12 |
| EAN-8 | 8 digits | GTIN | HIGH | Alternative: GTIN-8 |
| EAN-13 | 13 digits | GTIN | HIGH | Alternative: GTIN-13 |
| GTIN-14 | 14 digits | GTIN | HIGH | |
| ISBN-10 | 10 chars (0-9, X) | Mod 11 | HIGH | X = check digit 10 |
| ISBN-13 | 13 digits, prefix 978/979 | GTIN | HIGH | Also classifiable as EAN-13 |
| SKU | Alphanumeric | None | HIGH | No fixed format |
| UNKNOWN | Any | N/A | LOW | Ambiguity documented |

### Ambiguity Handling

- EAN-8 and GTIN-8 are structurally identical. We report `EAN_8` with `GTIN_8` as an alternative.
- UPC-A and GTIN-12 are structurally identical. We report `UPC_A` with `GTIN_12` as an alternative.
- ISBN-13 with prefix 978/979 is reported as `ISBN_13` with `EAN_13` and `GTIN_13` as alternatives.
- 10-digit numeric values that fail ISBN-10 checksum are reported as `UNKNOWN` with `ISBN_10` and `SKU` as alternatives.

---

## Validation Behavior

- **Whitespace**: Leading/trailing whitespace is trimmed.
- **Separators**: Hyphens, dots, and spaces within identifiers are safely removed.
- **Length**: Identifiers exceeding 50 characters are rejected. Manual fields exceeding 500 characters are rejected.
- **Checksums**: GTIN-family (UPC-A, EAN, GTIN) and ISBN checksums are validated. Invalid checksums set `checksumValid: false` and add a `CHECKSUM_INVALID` issue.
- **Empty input**: Rejected with `EMPTY_VALUE` or `NO_INPUT_DATA` issue.
- **Manual product minimum**: Requires at least a title, or both brand and model.
- **Result**: Structured `ValidationIssue[]` array with `code`, `message`, `severity`, and `field`. No uncontrolled exceptions for normal validation failures.

---

## Limitations

- **No external lookups.** This module cannot verify that a barcode corresponds to a real product. It validates format only.
- **No UPC-E expansion.** UPC-E compressed codes are not expanded to UPC-A.
- **Session-scoped deduplication only.** The default in-memory store does not persist across sessions. Production deployments need a database-backed store.
- **No GTIN-14 packaging level inference.** The indicator digit meaning is not interpreted.
- **ISBN-10 / 10-digit ambiguity.** A 10-digit numeric value that fails ISBN checksum cannot be distinguished from a numeric SKU without additional context.

---

## License

UNLICENSED — Internal PrimeOpp module. Not for public distribution.