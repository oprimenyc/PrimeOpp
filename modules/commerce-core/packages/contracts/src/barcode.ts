// Barcode framework contracts — Phase 4.

import type { Confidence, ISO8601, TenantScoped } from './internal.ts';

export type BarcodeFormat =
  | 'UPC_A'
  | 'UPC_E'
  | 'EAN_8'
  | 'EAN_13'
  | 'GTIN_14'
  | 'ISBN_10'
  | 'ISBN_13'
  | 'CODE_128'
  | 'QR'
  | 'CUSTOM';

export type ScanSource =
  | 'MOBILE_CAMERA'
  | 'USB_SCANNER'
  | 'BLUETOOTH_SCANNER'
  | 'BROWSER_SCANNER'
  | 'IMAGE_UPLOAD'
  | 'EXTERNAL_SDK'
  | 'MANUAL_ENTRY'
  | 'TEST_ADAPTER';

export interface BarcodePayload {
  format: BarcodeFormat;
  rawValue: string;
  normalizedValue: string;
  checkDigitValid: boolean;
  parsed?: Record<string, unknown>;
}

export interface ScanEvent {
  id: string;
  tenantId: string;
  organizationId?: string;
  sessionId: string;
  source: ScanSource;
  payload: BarcodePayload | null;
  confidence: Confidence;
  error?: {
    code: string;
    message: string;
  };
  /** Reference to the image evidence (when source is image-based). */
  imageEvidenceRef?: string;
  observedAt: ISO8601;
  /** True if user manually corrected the scan. */
  manuallyCorrected?: boolean;
  originalRawValue?: string;
}

export interface ScanSession {
  id: string;
  tenantId: string;
  organizationId?: string;
  startedAt: ISO8601;
  endedAt?: ISO8601;
  events: ScanEvent[];
  deviceLabel?: string;
  offlineQueued?: boolean;
}

export interface OfflineScanQueue {
  tenantId: string;
  pending: ScanEvent[];
  /** Maximum queue size before oldest entries are dropped (with audit). */
  maxSize: number;
}

export interface BarcodeValidationResult {
  valid: boolean;
  format: BarcodeFormat;
  normalized: string;
  checkDigitValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface BarcodeLookupResult {
  matched: boolean;
  candidates: Array<{
    productId: string;
    confidence: Confidence;
    source: string;
    evidenceRef?: string;
  }>;
  /** True if the barcode matched more than one product (collision). */
  collision: boolean;
}

export interface BarcodeAdapter {
  readonly adapterId: string;
  readonly version: string;
  readonly capabilities: string[];
  lookup(payload: BarcodePayload, scope: TenantScoped): Promise<BarcodeLookupResult>;
}

export const BARCODE_FORMATS: readonly BarcodeFormat[] = [
  'UPC_A',
  'UPC_E',
  'EAN_8',
  'EAN_13',
  'GTIN_14',
  'ISBN_10',
  'ISBN_13',
  'CODE_128',
  'QR',
  'CUSTOM',
] as const;
