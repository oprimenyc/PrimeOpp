// @primeopp-marketplace/schemas
// JSON Schema (draft-07) definitions for canonical entities.
// Used by the validate command and JSON Schema validation runtime proof.

import sellerSchema from './seller.schema.json' with { type: 'json' };
import buyerSchema from './buyer.schema.json' with { type: 'json' };
import listingSchema from './listing.schema.json' with { type: 'json' };
import channelSchema from './channel.schema.json' with { type: 'json' };
import orderSchema from './order.schema.json' with { type: 'json' };
import offerSchema from './offer.schema.json' with { type: 'json' };
import returnSchema from './return.schema.json' with { type: 'json' };
import disputeSchema from './dispute.schema.json' with { type: 'json' };
import commissionSchema from './commission.schema.json' with { type: 'json' };
import settlementSchema from './settlement.schema.json' with { type: 'json' };
import prohibitedProductsSchema from './prohibited-products.schema.json' with { type: 'json' };
import externalOrderEventSchema from './external-order-event.schema.json' with { type: 'json' };

export interface SchemaDescriptor {
  readonly id: string;
  readonly name: string;
  readonly schema: unknown;
}

export const SCHEMAS: readonly SchemaDescriptor[] = [
  { id: 'seller', name: 'Seller', schema: sellerSchema },
  { id: 'buyer', name: 'Buyer', schema: buyerSchema },
  { id: 'listing', name: 'CanonicalListing', schema: listingSchema },
  { id: 'channel', name: 'ChannelManifest', schema: channelSchema },
  { id: 'order', name: 'Order', schema: orderSchema },
  { id: 'offer', name: 'Offer', schema: offerSchema },
  { id: 'return', name: 'ReturnRequest', schema: returnSchema },
  { id: 'dispute', name: 'DisputeRecord', schema: disputeSchema },
  { id: 'commission', name: 'CommissionCalculation', schema: commissionSchema },
  { id: 'settlement', name: 'SettlementRecord', schema: settlementSchema },
  { id: 'prohibited_products', name: 'ProhibitedProductPolicy', schema: prohibitedProductsSchema },
  { id: 'external_order_event', name: 'ExternalOrderEvent', schema: externalOrderEventSchema }
];

export function getSchema(id: string): unknown | undefined {
  return SCHEMAS.find(s => s.id === id)?.schema;
}

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

// Minimal JSON-Schema draft-07 validator sufficient for our schemas.
// Only supports: type, required, properties, enum, additionalProperties, items, oneOf, minimum, maximum.
export function validate(value: unknown, schema: unknown): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  _validate(value, schema, '$', issues);
  return issues;
}

function _validate(value: unknown, schema: any, path: string, issues: ValidationIssue[]): void {
  if (schema === null || typeof schema !== 'object') return;
  if (schema.type !== undefined) {
    if (!matchesType(value, schema.type)) {
      issues.push({ path, message: `expected type ${schema.type}, got ${Array.isArray(value) ? 'array' : typeof value}` });
      return;
    }
  }
  if (schema.enum !== undefined) {
    if (!schema.enum.includes(value)) {
      issues.push({ path, message: `expected one of ${JSON.stringify(schema.enum)}, got ${JSON.stringify(value)}` });
    }
  }
  if (schema.required !== undefined && typeof value === 'object' && value !== null && !Array.isArray(value)) {
    for (const req of schema.required) {
      if (!(req in (value as Record<string, unknown>))) {
        issues.push({ path, message: `missing required property: ${req}` });
      }
    }
  }
  if (schema.properties !== undefined && typeof value === 'object' && value !== null && !Array.isArray(value)) {
    for (const [key, sub] of Object.entries(schema.properties as Record<string, any>)) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) _validate(v, sub, `${path}.${key}`, issues);
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties as Record<string, unknown>));
      for (const key of Object.keys(value as Record<string, unknown>)) {
        if (!allowed.has(key)) {
          issues.push({ path: `${path}.${key}`, message: 'additional property not allowed' });
        }
      }
    }
  }
  if (schema.items !== undefined && Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      _validate(value[i], schema.items, `${path}[${i}]`, issues);
    }
  }
  if (schema.minimum !== undefined && typeof value === 'number' && value < schema.minimum) {
    issues.push({ path, message: `expected >= ${schema.minimum}, got ${value}` });
  }
  if (schema.maximum !== undefined && typeof value === 'number' && value > schema.maximum) {
    issues.push({ path, message: `expected <= ${schema.maximum}, got ${value}` });
  }
  if (schema.oneOf !== undefined) {
    let matchCount = 0;
    for (const sub of schema.oneOf as any[]) {
      const subIssues: ValidationIssue[] = [];
      _validate(value, sub, path, subIssues);
      if (subIssues.length === 0) matchCount++;
    }
    if (matchCount !== 1) {
      issues.push({ path, message: `expected exactly one matching oneOf branch, matched ${matchCount}` });
    }
  }
}

function matchesType(value: unknown, type: string | string[]): boolean {
  if (Array.isArray(type)) return type.some(t => matchesType(value, t));
  switch (type) {
    case 'string': return typeof value === 'string';
    case 'number': return typeof value === 'number';
    case 'integer': return typeof value === 'number' && Number.isInteger(value);
    case 'boolean': return typeof value === 'boolean';
    case 'object': return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array': return Array.isArray(value);
    case 'null': return value === null;
    default: return true;
  }
}

export function validateById(id: string, value: unknown): readonly ValidationIssue[] {
  const schema = getSchema(id);
  if (!schema) return [{ path: '$', message: `unknown schema id: ${id}` }];
  return validate(value, schema);
}
