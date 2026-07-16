/**
 * Sample fixture data for testing.
 *
 * DISCLAIMER: These are synthetic sample values for testing purposes only.
 * They are NOT verified against any live product database or real-world products.
 * Checksums are computed to be valid for demonstration.
 */

import type { RawProductInput, ScannerEvent } from "../src/types/index.js";

// ---------------------------------------------------------------------------
// Valid Barcodes (checksums verified correct)
// ---------------------------------------------------------------------------

/** Valid UPC-A: 036000291452 (sample consumer packaged good) */
export const VALID_UPC_A = "036000291452";

/** Valid UPC-A with separator formatting: 03600-02914-52 */
export const VALID_UPC_A_FORMATTED = "03600-02914-52";

/** Valid UPC-A with whitespace */
export const VALID_UPC_A_WHITESPACE = " 036000291452 ";

/** Invalid UPC-A: correct length, bad checksum */
export const INVALID_UPC_CHECKSUM = "036000291453";

/** Valid EAN-13: 5901234123457 */
export const VALID_EAN_13 = "5901234123457";

/** Invalid EAN-13: wrong length */
export const INVALID_EAN_LENGTH = "590123412345";

/** Valid EAN-13 with hyphens */
export const VALID_EAN_13_FORMATTED = "590-1234-12345-7";

/** Valid GTIN-14: 10012345678902 */
export const VALID_GTIN_14 = "10012345678902";

/** Valid ISBN-10: 0306406152 */
export const VALID_ISBN_10 = "0306406152";

/** Invalid ISBN-10: bad checksum */
export const INVALID_ISBN_10 = "0306406153";

/** Valid ISBN-10 with X check digit: 007462542X */
export const VALID_ISBN_10_X = "007462542X";

/** Valid ISBN-13: 9780306406157 */
export const VALID_ISBN_13 = "9780306406157";

/** Valid EAN-8: 96385074 */
export const VALID_EAN_8 = "96385074";

/** Apparel SKU */
export const APPAREL_SKU = "NK-DRF-2024-BLK-M";

/** Electronics model/SKU */
export const ELECTRONICS_SKU = "SNY-WH1000XM5-BLK";

/** Unknown short numeric */
export const UNKNOWN_SHORT = "12345";

/** Unknown too-long numeric */
export const UNKNOWN_LONG = "123456789012345678901234567890";

/** Empty string */
export const EMPTY_INPUT = "";

/** Whitespace-only input */
export const WHITESPACE_ONLY = "   \t  ";

// ---------------------------------------------------------------------------
// RawProductInput Fixtures
// ---------------------------------------------------------------------------

export const fixtureCameraScanUpc: RawProductInput = {
  rawValue: VALID_UPC_A,
  inputMethod: "CAMERA_SCAN",
  sourceContext: { deviceId: "cam-001" },
};

export const fixtureHardwareScannerUpc: RawProductInput = {
  rawValue: VALID_UPC_A,
  inputMethod: "HARDWARE_SCANNER",
  sourceContext: { deviceId: "usb-scanner-01" },
};

export const fixtureManualIsbn: RawProductInput = {
  rawValue: VALID_ISBN_13,
  inputMethod: "MANUAL_IDENTIFIER",
};

export const fixtureManualProduct: RawProductInput = {
  inputMethod: "MANUAL_PRODUCT",
  manualProduct: {
    title: "Handmade Ceramic Vase",
    brand: "Artisan Home",
    model: "CHV-2024",
    category: "Home Decor",
    description: "A hand-thrown ceramic vase with a matte glaze finish.",
  },
};

export const fixtureManualProductInsufficient: RawProductInput = {
  inputMethod: "MANUAL_PRODUCT",
  manualProduct: {
    category: "Miscellaneous",
  },
};

export const fixtureBatchImportItems: RawProductInput[] = [
  { rawValue: VALID_UPC_A, inputMethod: "BATCH_IMPORT" },
  { rawValue: VALID_EAN_13, inputMethod: "BATCH_IMPORT" },
  { rawValue: INVALID_UPC_CHECKSUM, inputMethod: "BATCH_IMPORT" },
  { rawValue: VALID_ISBN_13, inputMethod: "BATCH_IMPORT" },
  { rawValue: EMPTY_INPUT, inputMethod: "BATCH_IMPORT" },
];

export const fixtureDuplicateBatchItems: RawProductInput[] = [
  { rawValue: VALID_UPC_A, inputMethod: "MANUAL_IDENTIFIER" },
  { rawValue: VALID_UPC_A_FORMATTED, inputMethod: "MANUAL_IDENTIFIER" }, // same after normalization
  { rawValue: VALID_UPC_A_WHITESPACE, inputMethod: "MANUAL_IDENTIFIER" }, // same after normalization
];

// ---------------------------------------------------------------------------
// ScannerEvent Fixtures
// ---------------------------------------------------------------------------

export const fixtureScannerEvent: ScannerEvent = {
  value: VALID_UPC_A,
  symbology: "EAN_13",
  capturedAt: "2025-01-15T10:30:00Z",
  deviceId: "cam-001",
  metadata: { width: 640, height: 480 },
};

export const fixtureHardwareScannerString = "036000291452\r\n";

// ---------------------------------------------------------------------------
// Manual product duplicate fixtures
// ---------------------------------------------------------------------------

export const fixtureManualProductA: RawProductInput = {
  inputMethod: "MANUAL_PRODUCT",
  manualProduct: {
    title: "Vintage Leather Journal",
    brand: "Papyrus Co",
    model: "VLJ-100",
  },
};

export const fixtureManualProductADuplicate: RawProductInput = {
  inputMethod: "MANUAL_PRODUCT",
  manualProduct: {
    title: "vintage leather journal", // different casing, same after normalization
    brand: "PAPYRUS CO",
    model: "vlj-100",
  },
};