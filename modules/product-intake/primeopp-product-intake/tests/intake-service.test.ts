/**
 * Integration tests for the ProductIntakeService.
 *
 * These tests exercise the full pipeline: normalize → detect → validate → dedup → record.
 * Deduplication uses the in-memory store (VERIFIED LOCAL BEHAVIOR).
 */

import { ProductIntakeService } from "../src/application/index.js";
import { InMemoryDeduplicationStore } from "../src/deduplication/index.js";
import {
  scannerEventToInput,
  hardwareScannerStringToEvent,
} from "../src/adapters/index.js";
import type { RawProductInput } from "../src/types/index.js";

function createService() {
  return new ProductIntakeService({
    deduplicationStore: new InMemoryDeduplicationStore(),
    idGenerator: () => `test-${crypto.randomUUID()}`,
  });
}

// ---------------------------------------------------------------------------
// Single Intake Tests
// ---------------------------------------------------------------------------

describe("ProductIntakeService - single intake", () => {
  test("valid UPC-A is accepted", async () => {
    const svc = createService();
    const record = await svc.intake({
      rawValue: "036000291452",
      inputMethod: "MANUAL_IDENTIFIER",
    });
    expect(record.status).toBe("ACCEPTED");
    expect(record.identifier?.identifierType).toBe("UPC_A");
    expect(record.identifier?.checksumValid).toBe(true);
  });

  test("invalid UPC checksum is needs-review", async () => {
    const svc = createService();
    const record = await svc.intake({
      rawValue: "036000291453",
      inputMethod: "MANUAL_IDENTIFIER",
    });
    expect(record.status).toBe("NEEDS_REVIEW");
    expect(record.identifier?.identifierType).toBe("UPC_A");
    expect(record.identifier?.checksumValid).toBe(false);
  });

  test("valid EAN-13 is accepted", async () => {
    const svc = createService();
    const record = await svc.intake({
      rawValue: "5901234123457",
      inputMethod: "MANUAL_IDENTIFIER",
    });
    expect(record.status).toBe("ACCEPTED");
    expect(record.identifier?.identifierType).toBe("EAN_13");
  });

  test("valid GTIN-14 is accepted", async () => {
    const svc = createService();
    const record = await svc.intake({
      rawValue: "10012345678902",
      inputMethod: "MANUAL_IDENTIFIER",
    });
    expect(record.status).toBe("ACCEPTED");
    expect(record.identifier?.identifierType).toBe("GTIN_14");
  });

  test("valid ISBN-10 is accepted", async () => {
    const svc = createService();
    const record = await svc.intake({
      rawValue: "0306406152",
      inputMethod: "MANUAL_IDENTIFIER",
    });
    expect(record.status).toBe("ACCEPTED");
    expect(record.identifier?.identifierType).toBe("ISBN_10");
  });

  test("invalid ISBN-10 checksum leads to UNKNOWN rejection", async () => {
    const svc = createService();
    const record = await svc.intake({
      rawValue: "0306406153",
      inputMethod: "MANUAL_IDENTIFIER",
    });
    expect(record.status).toBe("REJECTED");
  });

  test("valid ISBN-13 is accepted", async () => {
    const svc = createService();
    const record = await svc.intake({
      rawValue: "9780306406157",
      inputMethod: "MANUAL_IDENTIFIER",
    });
    expect(record.status).toBe("ACCEPTED");
    expect(record.identifier?.identifierType).toBe("ISBN_13");
  });

  test("SKU input is accepted", async () => {
    const svc = createService();
    const record = await svc.intake({
      rawValue: "NKDRF2024BLKM",
      inputMethod: "MANUAL_IDENTIFIER",
    });
    expect(record.status).toBe("ACCEPTED");
    expect(record.identifier?.identifierType).toBe("SKU");
  });

  test("unknown short identifier is rejected", async () => {
    const svc = createService();
    const record = await svc.intake({
      rawValue: "12345",
      inputMethod: "MANUAL_IDENTIFIER",
    });
    expect(record.status).toBe("REJECTED");
  });

  test("empty input is rejected", async () => {
    const svc = createService();
    const record = await svc.intake({
      rawValue: "",
      inputMethod: "MANUAL_IDENTIFIER",
    });
    expect(record.status).toBe("REJECTED");
  });

  test("no input data at all is rejected", async () => {
    const svc = createService();
    const record = await svc.intake({
      inputMethod: "MANUAL_IDENTIFIER",
    });
    expect(record.status).toBe("REJECTED");
    expect(record.validationIssues.some((i) => i.code === "NO_INPUT_DATA")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Manual Product Tests
// ---------------------------------------------------------------------------

describe("ProductIntakeService - manual product intake", () => {
  test("valid manual product without barcode is accepted", async () => {
    const svc = createService();
    const record = await svc.intake({
      inputMethod: "MANUAL_PRODUCT",
      manualProduct: {
        title: "Handmade Ceramic Vase",
        brand: "Artisan Home",
        model: "CHV-2024",
      },
    });
    expect(record.status).toBe("ACCEPTED");
    expect(record.manualProduct?.title).toBe("Handmade Ceramic Vase");
    expect(record.identifier).toBeUndefined();
  });

  test("insufficient manual product data is rejected", async () => {
    const svc = createService();
    const record = await svc.intake({
      inputMethod: "MANUAL_PRODUCT",
      manualProduct: {
        category: "Miscellaneous",
      },
    });
    expect(record.status).toBe("REJECTED");
    expect(record.validationIssues.some((i) => i.code === "INSUFFICIENT_MANUAL_DATA")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Duplicate Detection Tests
// ---------------------------------------------------------------------------

describe("ProductIntakeService - duplicate detection", () => {
  test("duplicate barcode detected", async () => {
    const svc = createService();
    const input: RawProductInput = { rawValue: "036000291452", inputMethod: "MANUAL_IDENTIFIER" };

    const first = await svc.intake(input);
    expect(first.status).toBe("ACCEPTED");

    const second = await svc.intake(input);
    expect(second.status).toBe("DUPLICATE");
    expect(second.duplicateOf).toBe(first.intakeId);
  });

  test("same barcode in different formatting is duplicate", async () => {
    const svc = createService();

    const first = await svc.intake({ rawValue: "036000291452", inputMethod: "MANUAL_IDENTIFIER" });
    expect(first.status).toBe("ACCEPTED");

    // Same barcode, formatted with hyphens
    const second = await svc.intake({ rawValue: "03600-02914-52", inputMethod: "MANUAL_IDENTIFIER" });
    expect(second.status).toBe("DUPLICATE");
    expect(second.duplicateOf).toBe(first.intakeId);
  });

  test("same barcode with whitespace is duplicate", async () => {
    const svc = createService();

    const first = await svc.intake({ rawValue: "036000291452", inputMethod: "MANUAL_IDENTIFIER" });
    expect(first.status).toBe("ACCEPTED");

    const second = await svc.intake({ rawValue: "  036000291452  ", inputMethod: "MANUAL_IDENTIFIER" });
    expect(second.status).toBe("DUPLICATE");
  });

  test("different barcodes are not duplicates", async () => {
    const svc = createService();

    const first = await svc.intake({ rawValue: "036000291452", inputMethod: "MANUAL_IDENTIFIER" });
    expect(first.status).toBe("ACCEPTED");

    const second = await svc.intake({ rawValue: "5901234123457", inputMethod: "MANUAL_IDENTIFIER" });
    expect(second.status).toBe("ACCEPTED");
  });

  test("duplicate manual product fingerprint detected", async () => {
    const svc = createService();

    const first = await svc.intake({
      inputMethod: "MANUAL_PRODUCT",
      manualProduct: { title: "Vintage Leather Journal", brand: "Papyrus Co", model: "VLJ-100" },
    });
    expect(first.status).toBe("ACCEPTED");

    // Same product, different casing
    const second = await svc.intake({
      inputMethod: "MANUAL_PRODUCT",
      manualProduct: { title: "vintage leather journal", brand: "PAPYRUS CO", model: "vlj-100" },
    });
    expect(second.status).toBe("DUPLICATE");
    expect(second.duplicateOf).toBe(first.intakeId);
  });
});

// ---------------------------------------------------------------------------
// Scanner Adapter Integration
// ---------------------------------------------------------------------------

describe("ProductIntakeService - scanner adapter integration", () => {
  test("camera scan event → accepted intake", async () => {
    const svc = createService();

    const event = {
      value: "036000291452",
      symbology: "UPC_A",
      capturedAt: "2025-01-15T10:30:00Z",
      deviceId: "cam-001",
    };

    const input = scannerEventToInput(event);
    const record = await svc.intake(input);
    expect(record.status).toBe("ACCEPTED");
    expect(record.inputMethod).toBe("CAMERA_SCAN");
    expect(record.sourceContext?.scannerSymbology).toBe("UPC_A");
  });

  test("hardware scanner string → event → accepted intake", async () => {
    const svc = createService();

    const rawString = "036000291452\r\n";
    const event = hardwareScannerStringToEvent(rawString, "usb-01");
    const input = scannerEventToInput(event);
    const record = await svc.intake(input);
    expect(record.status).toBe("ACCEPTED");
    expect(record.inputMethod).toBe("HARDWARE_SCANNER");
  });
});

// ---------------------------------------------------------------------------
// Serialization Tests
// ---------------------------------------------------------------------------

describe("ProductIntakeService - serialization", () => {
  test("intake record is JSON-serializable", async () => {
    const svc = createService();
    const record = await svc.intake({
      rawValue: "036000291452",
      inputMethod: "MANUAL_IDENTIFIER",
    });

    const serialized = JSON.stringify(record);
    const parsed = JSON.parse(serialized) as typeof record;

    expect(parsed.intakeId).toBe(record.intakeId);
    expect(parsed.identifier?.normalizedValue).toBe("036000291452");
    expect(parsed.status).toBe("ACCEPTED");
  });

  test("batch result is JSON-serializable", async () => {
    const svc = createService();
    const result = await svc.intakeBatch({
      items: [
        { rawValue: "036000291452", inputMethod: "BATCH_IMPORT" },
        { rawValue: "5901234123457", inputMethod: "BATCH_IMPORT" },
      ],
    });

    const serialized = JSON.stringify(result);
    const parsed = JSON.parse(serialized);

    expect(parsed.totalReceived).toBe(2);
    expect(parsed.accepted).toBe(2);
  });
});