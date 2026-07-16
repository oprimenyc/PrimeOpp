/**
 * @primeopp-deal-intelligence/schemas
 *
 * JSON Schema definitions for runtime validation of observations and
 * entities. Schemas are plain JSON objects (draft 2020-12) suitable for
 * any compliant validator (ajv, @hyperjump/json-schema, etc.).
 *
 * The package does NOT bundle a validator; consumers may choose their own.
 */
export const moneySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['amountMinor', 'currency'],
  properties: {
    amountMinor: { type: 'integer' },
    currency: { type: 'string', minLength: 3, maxLength: 3 }
  }
} as const;

export const evidenceSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'kind', 'capturedAt', 'payloadRef'],
  properties: {
    id: { type: 'string' },
    kind: { type: 'string', enum: ['screenshot','dom-snapshot','structured-json','http-response','api-payload','manual-observation','community-submission','receipt','photo','computed'] },
    capturedAt: { type: 'string', format: 'date-time' },
    payloadRef: { type: 'string' },
    payloadHash: { type: 'string' },
    redacted: { type: 'boolean' },
    notes: { type: 'string' }
  }
} as const;

export const productIdentifierSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'value', 'source'],
  properties: {
    type: { type: 'string', enum: ['UPC','EAN','GTIN','ISBN','ASIN','SKU','MPN','RETAILER_PRODUCT_ID','MODEL_NUMBER','STYLE_CODE','COLOR_CODE','SIZE','PACK_QTY','URL','CUSTOM'] },
    value: { type: 'string', minLength: 1 },
    source: { type: 'string' }
  }
} as const;

export const retailerSchema = {
  type: 'object',
  required: ['id','name','type','regions','domains','sourceMethods','accessRestrictions','affiliateProgram','termsReference','permittedAutomationModes','browserRequired','loginRequired','membershipRequired','evidenceFreshness','health','promotionMethod','availabilityMethod','fulfillmentMethods','evidence'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    type: { type: 'string', enum: ['national-chain','regional-chain','local-store','online-only','wholesaler','membership-club','outlet','liquidation','manufacturer-store','marketplace'] },
    regions: { type: 'array', items: { type: 'string' } },
    domains: { type: 'array', items: moneySchema }, // placeholder, replaced below
    sourceMethods: { type: 'array', items: { type: 'string' } },
    accessRestrictions: { type: 'array', items: { type: 'string' } },
    affiliateProgram: { type: 'object' },
    termsReference: { type: 'object' },
    permittedAutomationModes: { type: 'array', items: { type: 'string' } },
    browserRequired: { type: 'boolean' },
    loginRequired: { type: 'boolean' },
    membershipRequired: { type: 'boolean' },
    evidenceFreshness: { type: 'string', format: 'date-time' },
    health: { type: 'object' },
    promotionMethod: { type: 'object' },
    availabilityMethod: { type: 'object' },
    fulfillmentMethods: { type: 'array', items: { type: 'object' } },
    evidence: { type: 'array', items: { type: 'object' } }
  }
} as const;

export const offerSchema = {
  type: 'object',
  required: ['id','retailerId','productId','prices','availability','promotions','coupons','rebates','fulfillment','restrictions','expiration','confidence','source','evidence','observedAt'],
  properties: {
    id: { type: 'string' },
    retailerId: { type: 'string' },
    productId: { type: 'string' },
    prices: { type: 'object' },
    availability: { type: 'object' },
    promotions: { type: 'array', items: { type: 'object' } },
    coupons: { type: 'array', items: { type: 'object' } },
    rebates: { type: 'array', items: { type: 'object' } },
    fulfillment: { type: 'object' },
    restrictions: { type: 'object' },
    expiration: { type: 'object' },
    confidence: { type: 'object' },
    source: { type: 'object' },
    evidence: { type: 'array', items: { type: 'object' } },
    observedAt: { type: 'string', format: 'date-time' }
  }
} as const;

export const dealScoreSetSchema = {
  type: 'object',
  required: ['consumerValue','resellerOpportunity','affiliateOpportunity','scarcity','confidence','urgency','contentPotential','overall'],
  properties: {
    consumerValue: { type: 'object' },
    resellerOpportunity: { type: 'object' },
    affiliateOpportunity: { type: 'object' },
    scarcity: { type: 'object' },
    confidence: { type: 'object' },
    urgency: { type: 'object' },
    contentPotential: { type: 'object' },
    overall: { type: 'object' }
  }
} as const;

/** Tiny runtime validator: checks required keys are present and types match.
 * This is NOT a full JSON Schema validator; it provides deterministic
 * structural validation for the most common malformed-input cases.
 */
export type ValidationIssue = { path: string; message: string };

export function validateRequired<T extends Record<string, unknown>>(
  obj: unknown,
  required: string[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (typeof obj !== 'object' || obj === null) {
    return [{ path: '$', message: 'expected an object' }];
  }
  const o = obj as Record<string, unknown>;
  for (const k of required) {
    if (!(k in o)) {
      issues.push({ path: '$.' + k, message: 'missing required field' });
    }
  }
  return issues;
}

export function validateMoney(m: unknown): ValidationIssue[] {
  const issues = validateRequired(m, ['amountMinor', 'currency']);
  if (issues.length) return issues;
  const mo = m as { amountMinor: unknown; currency: unknown };
  if (!Number.isInteger(mo.amountMinor)) {
    issues.push({ path: '$.amountMinor', message: 'must be integer' });
  }
  if (typeof mo.currency !== 'string' || mo.currency.length !== 3) {
    issues.push({ path: '$.currency', message: 'must be 3-letter ISO 4217' });
  }
  return issues;
}

export const allSchemas = {
  money: moneySchema,
  evidence: evidenceSchema,
  productIdentifier: productIdentifierSchema,
  retailer: retailerSchema,
  offer: offerSchema,
  dealScoreSet: dealScoreSetSchema
};
