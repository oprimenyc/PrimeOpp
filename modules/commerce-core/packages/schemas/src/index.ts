// Runtime validators for PrimeOpp Commerce Core.
// Hand-rolled lightweight validators (no external deps).
// Each validator returns { valid, errors, value }.

import type {
  BarcodeFormat,
  CanonicalCondition,
  Money,
  OperationResult,
  Product,
  ProductIdentifier,
  TenantScoped,
  TerminalState,
} from '@primeopp/contracts';

export interface ValidationOutcome<T> {
  valid: boolean;
  errors: string[];
  value: T | null;
}

function ok<T>(value: T): ValidationOutcome<T> {
  return { valid: true, errors: [], value };
}

function err<T>(...errors: string[]): ValidationOutcome<T> {
  return { valid: false, errors, value: null };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isBool(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

function isISO8601(v: unknown): v is string {
  if (!isString(v)) return false;
  // Permissive: must parse as Date.
  const d = new Date(v);
  return !isNaN(d.getTime());
}

export function validateString(v: unknown, opts: { minLen?: number; maxLen?: number; pattern?: RegExp } = {}): ValidationOutcome<string> {
  if (!isString(v)) return err('expected string');
  if (opts.minLen !== undefined && v.length < opts.minLen) return err(`string shorter than minLen=${opts.minLen}`);
  if (opts.maxLen !== undefined && v.length > opts.maxLen) return err(`string longer than maxLen=${opts.maxLen}`);
  if (opts.pattern !== undefined && !opts.pattern.test(v)) return err(`string does not match pattern ${opts.pattern}`);
  return ok(v);
}

export function validateNumber(v: unknown, opts: { min?: number; max?: number; integer?: boolean } = {}): ValidationOutcome<number> {
  if (!isNumber(v)) return err('expected finite number');
  if (opts.min !== undefined && v < opts.min) return err(`number less than min=${opts.min}`);
  if (opts.max !== undefined && v > opts.max) return err(`number greater than max=${opts.max}`);
  if (opts.integer === true && !Number.isInteger(v)) return err('expected integer');
  return ok(v);
}

export function validateConfidence(v: unknown): ValidationOutcome<number> {
  return validateNumber(v, { min: 0, max: 1 });
}

export function validateMoney(v: unknown): ValidationOutcome<Money> {
  if (!isObject(v)) return err('expected object');
  const amount = validateNumber(v.amount, { min: 0 });
  if (!amount.valid) return err('money.amount invalid');
  const currency = validateString(v.currency, { pattern: /^[A-Z]{3}$/ });
  if (!currency.valid) return err('money.currency must be ISO 4217 (3 uppercase letters)');
  if (!isBool(v.precise)) return err('money.precise must be boolean');
  const status = v.status;
  if (!['ACTUAL', 'AUTHORITATIVE', 'ESTIMATED', 'USER_ENTERED', 'UNKNOWN'].includes(status as string)) {
    return err('money.status invalid');
  }
  return ok({
    amount: amount.value!,
    currency: currency.value!,
    precise: v.precise as boolean,
    status: status as Money['status'],
  });
}

const VALID_BARCODE_FORMATS: readonly string[] = [
  'UPC_A', 'UPC_E', 'EAN_8', 'EAN_13', 'GTIN_14', 'ISBN_10', 'ISBN_13', 'CODE_128', 'QR', 'CUSTOM',
];

export function validateBarcodeFormat(v: unknown): ValidationOutcome<BarcodeFormat> {
  if (!isString(v) || !VALID_BARCODE_FORMATS.includes(v)) {
    return err(`invalid barcode format; must be one of ${VALID_BARCODE_FORMATS.join(', ')}`);
  }
  return ok(v as BarcodeFormat);
}

const VALID_CONDITIONS: readonly string[] = [
  'NEW', 'NEW_WITH_TAGS', 'NEW_WITHOUT_TAGS', 'NEW_OPEN_BOX', 'LIKE_NEW', 'EXCELLENT', 'VERY_GOOD',
  'GOOD', 'FAIR', 'POOR', 'FOR_PARTS', 'REFURBISHED', 'SELLER_REFURBISHED', 'MANUFACTURER_REFURBISHED',
  'DAMAGED', 'CUSTOM',
];

export function validateCanonicalCondition(v: unknown): ValidationOutcome<CanonicalCondition> {
  if (!isString(v) || !VALID_CONDITIONS.includes(v)) {
    return err(`invalid condition; must be one of ${VALID_CONDITIONS.join(', ')}`);
  }
  return ok(v as CanonicalCondition);
}

const VALID_TERMINAL_STATES: readonly string[] = [
  'SUCCEEDED', 'PARTIALLY_SUCCEEDED', 'REQUIRES_REVIEW', 'FAILED', 'CANCELLED',
];

export function validateTerminalState(v: unknown): ValidationOutcome<TerminalState> {
  if (!isString(v) || !VALID_TERMINAL_STATES.includes(v)) {
    return err(`invalid terminal state; must be one of ${VALID_TERMINAL_STATES.join(', ')}`);
  }
  return ok(v as TerminalState);
}

export function validateTenantScoped(v: unknown): ValidationOutcome<TenantScoped> {
  if (!isObject(v)) return err('expected object');
  const tid = validateString(v.tenantId, { minLen: 1, maxLen: 256 });
  if (!tid.valid) return err('tenantId must be a non-empty string');
  if (v.organizationId !== undefined) {
    const oid = validateString(v.organizationId, { minLen: 1, maxLen: 256 });
    if (!oid.valid) return err('organizationId must be a non-empty string when present');
  }
  return ok({
    tenantId: tid.value!,
    ...(v.organizationId !== undefined ? { organizationId: v.organizationId as string } : {}),
  });
}

export function validateProductIdentifier(v: unknown): ValidationOutcome<ProductIdentifier> {
  if (!isObject(v)) return err('expected object');
  const type = validateString(v.type, { minLen: 1 });
  if (!type.valid) return err('identifier.type invalid');
  const value = validateString(v.value, { minLen: 1, maxLen: 4096 });
  if (!value.valid) return err('identifier.value invalid');
  const source = validateString(v.source, { minLen: 1 });
  if (!source.valid) return err('identifier.source invalid');
  const confidence = validateConfidence(v.confidence);
  if (!confidence.valid) return err('identifier.confidence invalid');
  const observedAt = isISO8601(v.observedAt);
  if (!observedAt) return err('identifier.observedAt must be ISO 8601');
  if (!['UNVERIFIED', 'CHECK_DIGIT_VALID', 'PROVIDER_VERIFIED', 'HUMAN_CONFIRMED', 'CONFLICTED', 'INVALID'].includes(v.verification as string)) {
    return err('identifier.verification invalid');
  }
  if (v.expiresAt !== undefined && !isISO8601(v.expiresAt)) {
    return err('identifier.expiresAt must be ISO 8601 when present');
  }
  return ok({
    type: type.value! as ProductIdentifier['type'],
    value: value.value!,
    source: source.value!,
    verification: v.verification as ProductIdentifier['verification'],
    confidence: confidence.value!,
    observedAt: v.observedAt as string,
    ...(v.expiresAt !== undefined ? { expiresAt: v.expiresAt as string } : {}),
    ...(v.evidenceRef !== undefined ? { evidenceRef: v.evidenceRef as string } : {}),
    ...(v.notes !== undefined ? { notes: v.notes as string } : {}),
  });
}

/**
 * Validate a full Product record.
 * Returns the typed Product on success, or a list of errors.
 */
export function validateProduct(v: unknown): ValidationOutcome<Product> {
  if (!isObject(v)) return err('expected object');
  const errors: string[] = [];

  const tenant = validateTenantScoped(v);
  if (!tenant.valid) errors.push(...tenant.errors);

  if (!isString(v.id) || v.id.length === 0) errors.push('product.id must be non-empty string');
  if (!isString(v.schemaVersion) || v.schemaVersion.length === 0) errors.push('product.schemaVersion required');
  if (!isString(v.kind)) errors.push('product.kind required');
  if (!isString(v.title) || v.title.length === 0) errors.push('product.title required');
  if (!isString(v.createdAt) || !isISO8601(v.createdAt)) errors.push('product.createdAt must be ISO 8601');
  if (!isString(v.updatedAt) || !isISO8601(v.updatedAt)) errors.push('product.updatedAt must be ISO 8601');
  if (!Array.isArray(v.identifiers)) errors.push('product.identifiers must be array');
  if (!Array.isArray(v.variants)) errors.push('product.variants must be array');
  if (!Array.isArray(v.images)) errors.push('product.images must be array');
  if (!Array.isArray(v.documents)) errors.push('product.documents must be array');
  if (!Array.isArray(v.attributes)) errors.push('product.attributes must be array');
  if (!isObject(v.source)) errors.push('product.source must be object');
  if (!isObject(v.provenance)) errors.push('product.provenance must be object');
  if (!isObject(v.ownership)) errors.push('product.ownership must be object');
  if (!isObject(v.evidence)) errors.push('product.evidence must be object');
  if (!isObject(v.confidence)) errors.push('product.confidence must be object');
  if (!isNumber(v.version) || v.version < 0) errors.push('product.version must be non-negative number');

  if (errors.length > 0) return err(...errors);

  // Trust the input shape after structural checks.
  return ok(v as unknown as Product);
}

// ---------------------------------------------------------------------------
// JSON Schema definitions (for tooling that consumes JSON Schema).
// ---------------------------------------------------------------------------

import { SCHEMA_VERSION } from '@primeopp/contracts';

export const moneyJsonSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Money',
  type: 'object',
  required: ['amount', 'currency', 'precise', 'status'],
  properties: {
    amount: { type: 'number', minimum: 0 },
    currency: { type: 'string', pattern: '^[A-Z]{3}$' },
    precise: { type: 'boolean' },
    status: { type: 'string', enum: ['ACTUAL', 'AUTHORITATIVE', 'ESTIMATED', 'USER_ENTERED', 'UNKNOWN'] },
  },
} as const;

export const tenantScopedJsonSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'TenantScoped',
  type: 'object',
  required: ['tenantId'],
  properties: {
    tenantId: { type: 'string', minLength: 1, maxLength: 256 },
    organizationId: { type: 'string', minLength: 1, maxLength: 256 },
  },
} as const;

export const productIdentifierJsonSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'ProductIdentifier',
  type: 'object',
  required: ['type', 'value', 'source', 'verification', 'confidence', 'observedAt'],
  properties: {
    type: { type: 'string', minLength: 1 },
    value: { type: 'string', minLength: 1, maxLength: 4096 },
    source: { type: 'string', minLength: 1 },
    verification: {
      type: 'string',
      enum: ['UNVERIFIED', 'CHECK_DIGIT_VALID', 'PROVIDER_VERIFIED', 'HUMAN_CONFIRMED', 'CONFLICTED', 'INVALID'],
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    observedAt: { type: 'string', format: 'date-time' },
    expiresAt: { type: 'string', format: 'date-time' },
    evidenceRef: { type: 'string' },
    notes: { type: 'string' },
  },
} as const;

export const canonicalConditionJsonSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'CanonicalCondition',
  type: 'string',
  enum: [
    'NEW', 'NEW_WITH_TAGS', 'NEW_WITHOUT_TAGS', 'NEW_OPEN_BOX', 'LIKE_NEW', 'EXCELLENT', 'VERY_GOOD',
    'GOOD', 'FAIR', 'POOR', 'FOR_PARTS', 'REFURBISHED', 'SELLER_REFURBISHED',
    'MANUFACTURER_REFURBISHED', 'DAMAGED', 'CUSTOM',
  ],
} as const;

export const productJsonSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Product',
  type: 'object',
  required: [
    'id', 'schemaVersion', 'kind', 'title', 'attributes', 'identifiers', 'variants', 'images',
    'documents', 'source', 'provenance', 'ownership', 'listingState', 'fulfillmentMode',
    'channelState', 'evidence', 'confidence', 'version', 'createdAt', 'updatedAt', 'tenantId',
  ],
  properties: {
    id: { type: 'string', minLength: 1 },
    schemaVersion: { type: 'string', minLength: 1 },
    kind: { type: 'string' },
    title: { type: 'string', minLength: 1 },
    tenantId: { type: 'string', minLength: 1 },
    organizationId: { type: 'string' },
    version: { type: 'integer', minimum: 0 },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    identifiers: { type: 'array', items: productIdentifierJsonSchema },
    archived: { type: 'boolean' },
  },
} as const;

export const allJsonSchemas = {
  Money: moneyJsonSchema,
  TenantScoped: tenantScopedJsonSchema,
  ProductIdentifier: productIdentifierJsonSchema,
  CanonicalCondition: canonicalConditionJsonSchema,
  Product: productJsonSchema,
} as const;

export const SCHEMA_REGISTRY_VERSION = SCHEMA_VERSION;

/**
 * Validate that an OperationResult has a terminal state.
 */
export function validateOperationResult<T>(v: unknown): ValidationOutcome<OperationResult<T>> {
  if (!isObject(v)) return err('expected object');
  const state = validateTerminalState(v.state);
  if (!state.valid) return err(...state.errors);
  if (v.value === undefined && v.error === undefined && state.value !== 'CANCELLED') {
    return err('OperationResult must have value or error unless CANCELLED');
  }
  if (v.error !== undefined && (!isObject(v.error) || !isString(v.error.code) || !isString(v.error.message))) {
    return err('OperationResult.error must have code and message');
  }
  if (!Array.isArray(v.warnings)) return err('OperationResult.warnings must be array');
  if (!Array.isArray(v.evidence)) return err('OperationResult.evidence must be array');
  if (!isString(v.correlationId)) return err('OperationResult.correlationId must be string');
  return ok(v as unknown as OperationResult<T>);
}
