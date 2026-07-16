# OCR and Image Match Contracts

OCR contracts: `packages/ocr-contracts/src/index.ts`.
Image match contracts: `packages/image-match-contracts/src/index.ts`.

## OCR Fields

The framework supports 18 OCR field types: TITLE, BRAND, MODEL_NUMBER, SERIAL_NUMBER, UPC, EAN, ISBN, CATEGORY, COLOR, SIZE, CONDITION_NOTE, PRICE, WEIGHT, DIMENSIONS, PACKAGE_TEXT, SHELF_TAG, LABEL, OTHER.

Every OCR result includes:

- `providerRef` — adapter ID
- `fields` — array of `OCRFieldValue` with confidence and optional bounding box
- `rawText` — for forensic review
- `overallConfidence`
- `warnings` and `unsupportedClaims` — claims the consumer should not trust
- `evidenceRef`

## Image Match Results

Every `ImageMatchResult` includes:

- `candidates` — array of `{ productId, similarity, source }`
- `detectedLogos` — with confidence and optional bounding box
- `imageQualityScore` in [0, 1]
- `duplicateOf` — set when input appears to be a duplicate
- `lowQuality` — flag for too-dark/too-blurry inputs

## Sanitization

`sanitizeOcrOutput(raw)` strips common prompt-injection patterns from OCR text. This is a contract helper, NOT a security boundary — adapters MUST treat all OCR output as untrusted.

## Local Test Adapters

- `LocalTestOCRAdapter` (TEST-ONLY) — deterministic fixture-based OCR
- `LocalTestImageMatchAdapter` (TEST-ONLY) — deterministic pseudo-similarity

No paid OCR or image provider is embedded or required.
