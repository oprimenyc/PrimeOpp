// OCR contracts — Phase 5.
// Provider-agnostic contracts for OCR extraction. Includes a local
// deterministic test adapter clearly labeled TEST-ONLY.

import type {
  OCRAdapter,
  OCRField,
  OCRRequest,
  OCRResult,
  TenantScoped,
} from '@primeopp/contracts';
import { nowUtc, uuid } from '@primeopp/contracts';

/**
 * A deterministic local OCR adapter for tests.
 *
 * TEST-ONLY. Do NOT use in production.
 *
 * The adapter looks up results from a pre-registered fixture map keyed
 * by imageEvidenceRef. This makes tests fully reproducible without any
 * external OCR provider.
 */
export class LocalTestOCRAdapter implements OCRAdapter {
  readonly adapterId = 'local.test.ocr';
  readonly version = '1.0.0';
  readonly capabilities: OCRField[] = [
    'TITLE', 'BRAND', 'MODEL_NUMBER', 'SERIAL_NUMBER', 'UPC', 'EAN', 'ISBN',
    'CATEGORY', 'COLOR', 'SIZE', 'CONDITION_NOTE', 'PRICE', 'WEIGHT', 'DIMENSIONS',
    'PACKAGE_TEXT', 'SHELF_TAG', 'LABEL', 'OTHER',
  ];
  readonly requiresNetwork = false;
  readonly costEstimate = { perCall: 0, currency: 'USD' };
  readonly supportedRegions = ['*'];

  private readonly fixture = new Map<string, Partial<Record<OCRField, string>>>();

  constructor(initial: Record<string, Partial<Record<OCRField, string>>> = {}) {
    for (const [k, v] of Object.entries(initial)) {
      this.fixture.set(k, v);
    }
  }

  register(imageEvidenceRef: string, fields: Partial<Record<OCRField, string>>): void {
    this.fixture.set(imageEvidenceRef, fields);
  }

  async extract(request: OCRRequest): Promise<OCRResult> {
    const found = this.fixture.get(request.imageEvidenceRef) ?? {};
    const fields = (request.fields ?? this.capabilities).map((f) => ({
      field: f,
      value: found[f] ?? '',
      normalizedValue: (found[f] ?? '').trim().toUpperCase(),
      confidence: found[f] !== undefined ? 0.95 : 0.0,
    })).filter((f) => f.value !== '');

    return {
      providerRef: this.adapterId,
      observedAt: nowUtc(),
      fields,
      rawText: Object.values(found).join('\n'),
      overallConfidence: fields.length > 0 ? 0.95 : 0.0,
      warnings: fields.length === 0 ? ['no fixture registered for imageEvidenceRef'] : [],
      unsupportedClaims: [],
      evidenceRef: `evidence/ocr/${uuid()}`,
    };
  }
}

/**
 * Sanitize OCR output to remove prompt-injection-like content.
 * This is a contract function — adapters MAY call this on their output
 * to reduce the risk of malicious OCR output influencing downstream logic.
 */
export function sanitizeOcrOutput(raw: string): { cleaned: string; removed: string[] } {
  const removed: string[] = [];
  // Strip known prompt-injection prefixes/suffixes (best-effort, not security boundary).
  const patterns = [
    /ignore\s+(all\s+)?previous\s+instructions?/gi,
    /system\s*:\s*/gi,
    /assistant\s*:\s*/gi,
    /you\s+are\s+(now|an?)\s+/gi,
    /\bdo\s+not\s+follow\b/gi,
  ];
  let cleaned = raw;
  for (const p of patterns) {
    cleaned = cleaned.replace(p, (m) => {
      removed.push(m);
      return '';
    });
  }
  return { cleaned: cleaned.trim(), removed };
}

/**
 * Merge multiple OCR results for the same image (e.g. from different providers).
 * Picks the field with the highest confidence per field name.
 */
export function mergeOcrResults(results: OCRResult[]): OCRResult {
  if (results.length === 0) {
    throw new Error('mergeOcrResults requires at least one result');
  }
  if (results.length === 1) return results[0];

  const bestByField = new Map<string, OCRResult['fields'][number]>();
  for (const r of results) {
    for (const f of r.fields) {
      const prev = bestByField.get(f.field);
      if (!prev || f.confidence > prev.confidence) {
        bestByField.set(f.field, f);
      }
    }
  }

  return {
    providerRef: `merged:${results.map((r) => r.providerRef).join('|')}`,
    observedAt: nowUtc(),
    fields: Array.from(bestByField.values()),
    rawText: results.map((r) => r.rawText ?? '').join('\n---\n'),
    overallConfidence: Math.max(...results.map((r) => r.overallConfidence)),
    warnings: results.flatMap((r) => r.warnings),
    unsupportedClaims: results.flatMap((r) => r.unsupportedClaims),
    evidenceRef: `evidence/ocr-merged/${uuid()}`,
  };
}

export interface OCRFieldExtractionOptions {
  /** If true, drop fields with confidence below this threshold. */
  minConfidence?: number;
  /** If true, normalize all string values to uppercase trimmed. */
  normalize?: boolean;
}

export function extractOcrFields(
  result: OCRResult,
  opts: OCRFieldExtractionOptions = {},
): Record<string, string> {
  const min = opts.minConfidence ?? 0;
  const out: Record<string, string> = {};
  for (const f of result.fields) {
    if (f.confidence < min) continue;
    const v = opts.normalize ? (f.normalizedValue ?? f.value.trim().toUpperCase()) : f.value;
    out[f.field] = v;
  }
  return out;
}

/**
 * Build a TenantScoped request envelope for OCR.
 */
export function createOcrRequest(
  imageEvidenceRef: string,
  scope: TenantScoped,
  fields?: OCRField[],
  locale?: string,
): OCRRequest {
  return { imageEvidenceRef, scope, ...(fields ? { fields } : {}), ...(locale ? { locale } : {}) };
}
