// OCR and image match contracts — Phase 5.

import type { Confidence, ISO8601, TenantScoped } from './internal.ts';

// ---------------------------------------------------------------------------
// OCR
// ---------------------------------------------------------------------------

export type OCRField =
  | 'TITLE'
  | 'BRAND'
  | 'MODEL_NUMBER'
  | 'SERIAL_NUMBER'
  | 'UPC'
  | 'EAN'
  | 'ISBN'
  | 'CATEGORY'
  | 'COLOR'
  | 'SIZE'
  | 'CONDITION_NOTE'
  | 'PRICE'
  | 'WEIGHT'
  | 'DIMENSIONS'
  | 'PACKAGE_TEXT'
  | 'SHELF_TAG'
  | 'LABEL'
  | 'OTHER';

export interface OCRBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OCRFieldValue {
  field: OCRField;
  value: string;
  normalizedValue?: string;
  confidence: Confidence;
  boundingBox?: OCRBoundingBox;
}

export interface OCRResult {
  providerRef: string;
  observedAt: ISO8601;
  fields: OCRFieldValue[];
  /** Raw OCR text for forensic review. */
  rawText?: string;
  /** Provider-reported overall confidence. */
  overallConfidence: Confidence;
  warnings: string[];
  /** Claims the provider made that the consumer should not trust (e.g. inferred brands). */
  unsupportedClaims: string[];
  evidenceRef: string;
}

export interface OCRRequest {
  imageEvidenceRef: string;
  fields?: OCRField[];
  locale?: string;
  scope: TenantScoped;
}

export interface OCRAdapter {
  readonly adapterId: string;
  readonly version: string;
  readonly capabilities: OCRField[];
  readonly requiresNetwork: boolean;
  readonly costEstimate: { perCall: number; currency: string };
  readonly supportedRegions: string[];
  extract(request: OCRRequest): Promise<OCRResult>;
}

// ---------------------------------------------------------------------------
// Image matching
// ---------------------------------------------------------------------------

export interface ImageMatchResult {
  providerRef: string;
  observedAt: ISO8601;
  /** Candidate product IDs with similarity scores in [0, 1]. */
  candidates: Array<{
    productId: string;
    similarity: Confidence;
    source: string;
  }>;
  detectedLogos: Array<{ label: string; confidence: Confidence; boundingBox?: OCRBoundingBox }>;
  imageQualityScore: Confidence;
  /** True if this image appears to be a duplicate of an existing image. */
  duplicateOf?: string;
  /** True if input image was too small / dark / blurry to match. */
  lowQuality: boolean;
  warnings: string[];
  evidenceRef: string;
}

export interface ImageMatchRequest {
  imageEvidenceRef: string;
  scope: TenantScoped;
  /** Optional reference catalog to search against. */
  catalogRef?: string;
}

export interface ImageMatchAdapter {
  readonly adapterId: string;
  readonly version: string;
  readonly capabilities: string[];
  match(request: ImageMatchRequest): Promise<ImageMatchResult>;
}
