# Barcode Framework

The barcode framework lives in `packages/barcode/src/index.ts`.

## Supported Formats

| Format | Length | Check digit algorithm |
|---|---|---|
| UPC-A | 12 digits | UPC weighted (odd × 3) |
| UPC-E | 6 or 8 digits | Expanded to UPC-A |
| EAN-8 | 8 digits | EAN weighted (odd × 1) |
| EAN-13 | 13 digits | EAN weighted (odd × 1) |
| GTIN-14 | 14 digits | EAN weighted (odd × 1) |
| ISBN-10 | 10 chars (last may be X) | Weighted 10..2, mod 11 |
| ISBN-13 | 13 digits | EAN weighted (odd × 1) |
| Code 128 | any ASCII | (no check digit in this framework) |
| QR | any string | (no check digit) |
| CUSTOM | ≤ 256 chars | (no check digit) |

## Validation API

```typescript
validateBarcode(value: string, format?: BarcodeFormat): BarcodeValidationResult
toBarcodePayload(value: string, format?: BarcodeFormat): BarcodePayload
```

## Scan Events and Sessions

Every scan produces a `ScanEvent` tied to a `ScanSession`. Events capture:

- source (MOBILE_CAMERA, USB_SCANNER, BROWSER_SCANNER, IMAGE_UPLOAD, EXTERNAL_SDK, MANUAL_ENTRY, TEST_ADAPTER)
- payload (validated barcode)
- confidence
- error (if check digit invalid)
- imageEvidenceRef (for image-based scans)
- manuallyCorrected flag (when user overrides the raw value)

## Offline Queue

`createOfflineScanQueue` returns a tenant-scoped queue with a max size. Overflow drops the oldest events with an audit log to stderr.

## Local Test Adapter

`LocalBarcodeLookupAdapter` (TEST-ONLY) provides deterministic barcode-to-product lookups from a fixture map.

## Camera Hardware

This package does NOT require camera hardware. Scanner contracts for mobile camera, USB/Bluetooth scanner, browser scanner, image-upload scanner, and external SDK are documented as seams.
