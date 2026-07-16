// Barcode framework — Phase 4.
// Local barcode-processing framework with format validation,
// check-digit validation, normalization, scan events and sessions.

import type {
  BarcodeAdapter,
  BarcodeFormat,
  BarcodeLookupResult,
  BarcodePayload,
  BarcodeValidationResult,
  OfflineScanQueue,
  ScanEvent,
  ScanSession,
  ScanSource,
  TenantScoped,
} from '@primeopp/contracts';
import { nowUtc, uuid } from '@primeopp/contracts';

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

export function detectFormat(rawValue: string): BarcodeFormat {
  const digits = rawValue.replace(/[^0-9]/g, '');
  // ISBN_13 must be checked BEFORE EAN_13 (it is a subset).
  if (/^97[89][0-9]{10}$/.test(digits)) return 'ISBN_13';
  if (/^[0-9]{8}$/.test(digits)) return 'EAN_8';
  if (/^[0-9]{12}$/.test(digits)) return 'UPC_A';
  if (/^[0-9]{13}$/.test(digits)) return 'EAN_13';
  if (/^[0-9]{14}$/.test(digits)) return 'GTIN_14';
  if (/^[0-9]{9}[0-9Xx]$/.test(rawValue.trim().replace(/[-\s]/g, ''))) return 'ISBN_10';
  return 'CODE_128';
}

// ---------------------------------------------------------------------------
// Check-digit algorithms
// ---------------------------------------------------------------------------

/**
 * Compute the EAN-13 / EAN-8 / GTIN-14 / ISBN-13 check digit.
 * For EAN family formats, odd positions (1-indexed) are weighted × 1
 * and even positions × 3.
 *
 * @param dataDigits the data digits WITHOUT the check digit
 *                   (12 for EAN-13/ISBN-13, 7 for EAN-8, 13 for GTIN-14)
 */
export function computeEanCheckDigit(dataDigits: string): number {
  const digits = dataDigits.replace(/[^0-9]/g, '').split('').map(Number);
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    // i=0 → position 1 (odd) → × 1; i=1 → position 2 (even) → × 3; etc.
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * Compute the UPC-A check digit. UPC-A weights differ from EAN-13:
 * odd positions are weighted × 3 (effectively EAN-13 with a leading 0).
 *
 * @param elevenDataDigits the 11 data digits (without the check digit)
 */
export function computeUpcACheckDigit(elevenDataDigits: string): number {
  // Prepend a 0 to make this EAN-13-style.
  return computeEanCheckDigit('0' + elevenDataDigits);
}

/**
 * Backwards-compatible alias. Computes a check digit using EAN-13 weights.
 * For UPC-A use computeUpcACheckDigit instead.
 * @deprecated use computeEanCheckDigit or computeUpcACheckDigit
 */
export function computeUpcEanCheckDigit(dataDigits: string): number {
  return computeEanCheckDigit(dataDigits);
}

/**
 * Compute the ISBN-10 check digit. May be 'X' (value 10).
 */
export function computeIsbn10CheckDigit(nineDigits: string): string {
  const digits = nineDigits.replace(/[^0-9]/g, '').split('').map(Number);
  if (digits.length !== 9) throw new Error('ISBN-10 check digit requires exactly 9 digits');
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * (10 - i);
  }
  const check = (11 - (sum % 11)) % 11;
  return check === 10 ? 'X' : String(check);
}

/**
 * Compute ISBN-13 check digit (same as EAN-13).
 */
export function computeIsbn13CheckDigit(twelveDigits: string): number {
  return computeEanCheckDigit(twelveDigits);
}

// ---------------------------------------------------------------------------
// Per-format validators
// ---------------------------------------------------------------------------

function validateUpcA(value: string): { valid: boolean; normalized: string; checkDigitValid: boolean } {
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length !== 12) return { valid: false, normalized: digits, checkDigitValid: false };
  const expected = computeUpcACheckDigit(digits.slice(0, 11));
  return { valid: true, normalized: digits, checkDigitValid: expected === Number(digits[11]) };
}

function validateEan13(value: string): { valid: boolean; normalized: string; checkDigitValid: boolean } {
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length !== 13) return { valid: false, normalized: digits, checkDigitValid: false };
  const expected = computeEanCheckDigit(digits.slice(0, 12));
  return { valid: true, normalized: digits, checkDigitValid: expected === Number(digits[12]) };
}

function validateEan8(value: string): { valid: boolean; normalized: string; checkDigitValid: boolean } {
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length !== 8) return { valid: false, normalized: digits, checkDigitValid: false };
  const expected = computeEanCheckDigit(digits.slice(0, 7));
  return { valid: true, normalized: digits, checkDigitValid: expected === Number(digits[7]) };
}

function validateGtin14(value: string): { valid: boolean; normalized: string; checkDigitValid: boolean } {
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length !== 14) return { valid: false, normalized: digits, checkDigitValid: false };
  const expected = computeEanCheckDigit(digits.slice(0, 13));
  return { valid: true, normalized: digits, checkDigitValid: expected === Number(digits[13]) };
}

function validateIsbn10(value: string): { valid: boolean; normalized: string; checkDigitValid: boolean } {
  const cleaned = value.replace(/[-\s]/g, '').toUpperCase();
  if (!/^[0-9]{9}[0-9X]$/.test(cleaned)) return { valid: false, normalized: cleaned, checkDigitValid: false };
  const expected = computeIsbn10CheckDigit(cleaned.slice(0, 9));
  return { valid: true, normalized: cleaned, checkDigitValid: expected === cleaned[9] };
}

function validateIsbn13(value: string): { valid: boolean; normalized: string; checkDigitValid: boolean } {
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length !== 13) return { valid: false, normalized: digits, checkDigitValid: false };
  const expected = computeIsbn13CheckDigit(digits.slice(0, 12));
  return { valid: true, normalized: digits, checkDigitValid: expected === Number(digits[12]) };
}

function validateUpcE(value: string): { valid: boolean; normalized: string; checkDigitValid: boolean } {
  const digits = value.replace(/[^0-9]/g, '');
  // UPC-E is 6 or 8 digits (with NSC and check digit). We accept 8 here.
  if (digits.length !== 8 && digits.length !== 6) return { valid: false, normalized: digits, checkDigitValid: false };
  if (digits.length === 8) {
    // For UPC-E stored as 8 digits, last digit is check digit.
    // Expand to UPC-A and validate.
    const expanded = expandUpcE(digits);
    if (!expanded) return { valid: false, normalized: digits, checkDigitValid: false };
    const upc = validateUpcA(expanded);
    return { valid: true, normalized: digits, checkDigitValid: upc.checkDigitValid };
  }
  return { valid: true, normalized: digits, checkDigitValid: true };
}

/**
 * Expand a 6-digit UPC-E to a 12-digit UPC-A.
 * Returns null if input is not a valid UPC-E.
 */
export function expandUpcE(sixOrEight: string): string | null {
  let digits = sixOrEight.replace(/[^0-9]/g, '');
  if (digits.length === 6) {
    // 6-digit UPC-E cannot be expanded without the implicit number system digit
    // and check digit; callers should pass the full 8-digit form.
    return null;
  }
  if (digits.length !== 8) return null;
  const ns = digits[0];
  if (ns !== '0' && ns !== '1') return null;
  const check = digits[7];
  const mid = digits.slice(1, 7);
  let body: string;
  const last = mid[5];
  if (last === '0' || last === '1' || last === '2') {
    body = mid.slice(0, 2) + last + '0000' + mid.slice(2, 5);
  } else if (last === '3') {
    body = mid.slice(0, 3) + '00000' + mid.slice(3, 5);
  } else if (last === '4') {
    body = mid.slice(0, 4) + '00000' + mid[4];
  } else {
    body = mid.slice(0, 5) + '0000' + last;
  }
  return ns + body + check;
}

// ---------------------------------------------------------------------------
// Public validate API
// ---------------------------------------------------------------------------

export function validateBarcode(value: string, format?: BarcodeFormat): BarcodeValidationResult {
  const fmt = format ?? detectFormat(value);
  const errors: string[] = [];
  const warnings: string[] = [];
  let result: { valid: boolean; normalized: string; checkDigitValid: boolean };

  switch (fmt) {
    case 'UPC_A': result = validateUpcA(value); break;
    case 'UPC_E': result = validateUpcE(value); break;
    case 'EAN_8': result = validateEan8(value); break;
    case 'EAN_13': result = validateEan13(value); break;
    case 'GTIN_14': result = validateGtin14(value); break;
    case 'ISBN_10': result = validateIsbn10(value); break;
    case 'ISBN_13': result = validateIsbn13(value); break;
    case 'CODE_128': {
      // Code 128 is permissive; any non-empty ASCII string is structurally valid.
      const cleaned = value.trim();
      result = { valid: cleaned.length > 0, normalized: cleaned, checkDigitValid: true };
      break;
    }
    case 'QR': {
      // QR payloads can be anything; we just normalize whitespace.
      result = { valid: value.length > 0, normalized: value.trim(), checkDigitValid: true };
      break;
    }
    case 'CUSTOM': {
      result = { valid: value.length > 0 && value.length <= 256, normalized: value, checkDigitValid: true };
      if (value.length > 256) errors.push('CUSTOM barcode exceeds 256 chars');
      break;
    }
    default:
      errors.push(`unsupported format ${fmt}`);
      return { valid: false, format: fmt, normalized: value, checkDigitValid: false, errors, warnings };
  }

  if (!result.valid) errors.push(`value not valid for format ${fmt}`);
  if (!result.checkDigitValid) errors.push(`check digit invalid for format ${fmt}`);

  return {
    valid: errors.length === 0,
    format: fmt,
    normalized: result.normalized,
    checkDigitValid: result.checkDigitValid,
    errors,
    warnings,
  };
}

/**
 * Convert any barcode value into a BarcodePayload.
 */
export function toBarcodePayload(value: string, format?: BarcodeFormat): BarcodePayload {
  const v = validateBarcode(value, format);
  return {
    format: v.format,
    rawValue: value,
    normalizedValue: v.normalized,
    checkDigitValid: v.checkDigitValid,
    ...(v.format === 'ISBN_10' || v.format === 'ISBN_13' ? { parsed: { isbn: v.normalized } } : {}),
  };
}

// ---------------------------------------------------------------------------
// Scan events and sessions
// ---------------------------------------------------------------------------

export interface CreateScanEventInput {
  tenantId: string;
  organizationId?: string;
  sessionId: string;
  source: ScanSource;
  rawValue: string;
  format?: BarcodeFormat;
  confidence: number;
  imageEvidenceRef?: string;
  manuallyCorrected?: boolean;
  originalRawValue?: string;
}

export function createScanEvent(input: CreateScanEventInput): ScanEvent {
  const payload = toBarcodePayload(input.rawValue, input.format);
  return {
    id: uuid(),
    tenantId: input.tenantId,
    ...(input.organizationId ? { organizationId: input.organizationId } : {}),
    sessionId: input.sessionId,
    source: input.source,
    payload,
    confidence: input.confidence,
    ...(input.imageEvidenceRef ? { imageEvidenceRef: input.imageEvidenceRef } : {}),
    observedAt: nowUtc(),
    ...(input.manuallyCorrected ? { manuallyCorrected: true, originalRawValue: input.originalRawValue } : {}),
    ...(payload.checkDigitValid ? {} : { error: { code: 'CHECK_DIGIT_INVALID', message: `Check digit invalid for ${payload.format}` } }),
  };
}

export function createScanSession(tenantId: string, organizationId?: string): ScanSession {
  return {
    id: uuid(),
    tenantId,
    ...(organizationId ? { organizationId } : {}),
    startedAt: nowUtc(),
    events: [],
  };
}

export function appendScanEvent(session: ScanSession, event: ScanEvent): ScanSession {
  if (event.tenantId !== session.tenantId) {
    throw new Error(`TENANT_MISMATCH: scan event tenant ${event.tenantId} does not match session tenant ${session.tenantId}`);
  }
  return { ...session, events: [...session.events, event] };
}

export function endScanSession(session: ScanSession): ScanSession {
  return { ...session, endedAt: nowUtc() };
}

// ---------------------------------------------------------------------------
// Offline scan queue
// ---------------------------------------------------------------------------

export function createOfflineScanQueue(tenantId: string, maxSize = 1000): OfflineScanQueue {
  return { tenantId, pending: [], maxSize };
}

export function enqueueOfflineScan(queue: OfflineScanQueue, event: ScanEvent): OfflineScanQueue {
  let pending = [...queue.pending, event];
  let dropped: ScanEvent[] = [];
  if (pending.length > queue.maxSize) {
    dropped = pending.slice(0, pending.length - queue.maxSize);
    pending = pending.slice(pending.length - queue.maxSize);
  }
  // Side-effect: log dropped events via stderr.
  if (dropped.length > 0) {
    process.stderr.write(`[offline-scan-queue] tenant=${queue.tenantId} dropped=${dropped.length} oldest=${dropped[0].id}\n`);
  }
  return { ...queue, pending };
}

export function flushOfflineScanQueue(queue: OfflineScanQueue): { flushed: ScanEvent[]; remaining: OfflineScanQueue } {
  return {
    flushed: [...queue.pending],
    remaining: { ...queue, pending: [] },
  };
}

// ---------------------------------------------------------------------------
// In-memory barcode lookup adapter (local, test-only)
// ---------------------------------------------------------------------------

export interface LocalBarcodeCatalogEntry {
  payload: BarcodePayload;
  productId: string;
  confidence: number;
  source: string;
  evidenceRef?: string;
}

export class LocalBarcodeLookupAdapter implements BarcodeAdapter {
  readonly adapterId = 'local.barcode-lookup';
  readonly version = '1.0.0';
  readonly capabilities = ['LOOKUP'];
  private readonly entries = new Map<string, LocalBarcodeCatalogEntry[]>();

  constructor(initial: LocalBarcodeCatalogEntry[] = []) {
    for (const e of initial) {
      this.register(e);
    }
  }

  register(entry: LocalBarcodeCatalogEntry): void {
    const key = entry.payload.normalizedValue;
    const list = this.entries.get(key) ?? [];
    list.push(entry);
    this.entries.set(key, list);
  }

  async lookup(payload: BarcodePayload, _scope: TenantScoped): Promise<BarcodeLookupResult> {
    const list = this.entries.get(payload.normalizedValue) ?? [];
    if (list.length === 0) {
      return { matched: false, candidates: [], collision: false };
    }
    return {
      matched: true,
      candidates: list.map((e) => ({
        productId: e.productId,
        confidence: e.confidence,
        source: e.source,
        ...(e.evidenceRef ? { evidenceRef: e.evidenceRef } : {}),
      })),
      collision: list.length > 1,
    };
  }
}

/**
 * Build a test-only barcode adapter pre-populated from a fixture.
 * Clearly labeled test-only.
 */
export function createTestBarcodeAdapter(entries: LocalBarcodeCatalogEntry[] = []): LocalBarcodeLookupAdapter {
  return new LocalBarcodeLookupAdapter(entries);
}
