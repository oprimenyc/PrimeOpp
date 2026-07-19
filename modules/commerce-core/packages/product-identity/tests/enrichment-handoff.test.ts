import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildResolutionInputFromEnrichedProfile,
  isResolutionEligible,
} from '../src/index.ts';
import type { EnrichmentHandoffProfile } from '../src/index.ts';

function fixtureProfile(overrides: Partial<EnrichmentHandoffProfile> = {}): EnrichmentHandoffProfile {
  return {
    enrichmentId: 'enrich-001',
    intakeId: 'intake-001',
    identifiers: {},
    identity: {},
    classification: {},
    confidence: { overall: 0.9 },
    status: 'ENRICHED',
    ...overrides,
  };
}

test('isResolutionEligible accepts ENRICHED, PARTIAL, AMBIGUOUS', () => {
  assert.equal(isResolutionEligible(fixtureProfile({ status: 'ENRICHED' })), true);
  assert.equal(isResolutionEligible(fixtureProfile({ status: 'PARTIAL' })), true);
  assert.equal(isResolutionEligible(fixtureProfile({ status: 'AMBIGUOUS' })), true);
});

test('isResolutionEligible rejects NOT_FOUND, FAILED', () => {
  assert.equal(isResolutionEligible(fixtureProfile({ status: 'NOT_FOUND' })), false);
  assert.equal(isResolutionEligible(fixtureProfile({ status: 'FAILED' })), false);
});

test('throws RESOLUTION_INELIGIBLE for NOT_FOUND profiles instead of silently resolving', () => {
  const profile = fixtureProfile({ status: 'NOT_FOUND', identity: { canonicalTitle: 'x' } });
  assert.throws(() => buildResolutionInputFromEnrichedProfile(profile), /RESOLUTION_INELIGIBLE/);
});

test('throws RESOLUTION_NO_SIGNAL when nothing usable is present', () => {
  const profile = fixtureProfile({ status: 'PARTIAL' });
  assert.throws(() => buildResolutionInputFromEnrichedProfile(profile), /RESOLUTION_NO_SIGNAL/);
});

test('builds a real BarcodePayload with a deterministically computed checkDigitValid for a valid UPC', () => {
  const profile = fixtureProfile({ identifiers: { upc: ['036000291452'] } });
  const result = buildResolutionInputFromEnrichedProfile(profile);
  assert.ok(result.input.barcode);
  assert.equal(result.input.barcode?.normalizedValue, '036000291452');
  assert.equal(result.input.barcode?.checkDigitValid, true);
});

test('reports checkDigitValid=false for a UPC with a corrupted check digit (never invents validity)', () => {
  const profile = fixtureProfile({ identifiers: { upc: ['036000291459'] } });
  const result = buildResolutionInputFromEnrichedProfile(profile);
  assert.equal(result.input.barcode?.checkDigitValid, false);
});

test('falls back to text with a warning when a GTIN bucket value is not GS1/ISBN format', () => {
  const profile = fixtureProfile({ identifiers: { gtin: ['12345'] } });
  const result = buildResolutionInputFromEnrichedProfile(profile);
  assert.equal(result.input.barcode, undefined);
  assert.equal(result.input.text, '12345');
  assert.ok(result.warnings.some((w) => w.includes('detected as CODE_128')));
  assert.ok(result.warnings.some((w) => w.includes('instead of emitting a barcode claim')));
});

test('prefers GTIN over UPC/EAN/ISBN and selects exactly one barcode identifier', () => {
  const profile = fixtureProfile({
    identifiers: {
      gtin: ['00360002914527'],
      upc: ['036000291452'],
      ean: ['4006381333931'],
    },
  });
  const result = buildResolutionInputFromEnrichedProfile(profile);
  assert.equal(result.input.barcode?.rawValue, '00360002914527');
});

test('falls back to SKU/MPN as free text when no barcode-family identifier is present, with a warning', () => {
  const profile = fixtureProfile({ identifiers: { sku: ['SKU-42'] } });
  const result = buildResolutionInputFromEnrichedProfile(profile);
  assert.equal(result.input.text, 'SKU-42');
  assert.equal(result.input.barcode, undefined);
  assert.ok(result.warnings.some((w) => w.includes('falling back to SKU/MPN')));
});

test('never coerces SKU/MPN values into a BarcodePayload', () => {
  const profile = fixtureProfile({ identifiers: { mpn: ['NOT-A-BARCODE'] } });
  const result = buildResolutionInputFromEnrichedProfile(profile);
  assert.equal(result.input.barcode, undefined);
  assert.equal(result.input.text, 'NOT-A-BARCODE');
});

test('carries identity and classification fields through unmodified', () => {
  const profile = fixtureProfile({
    identity: { canonicalTitle: 'Sony WH-1000XM4', brand: 'Sony', model: 'WH-1000XM4' },
    classification: { category: 'Electronics' },
  });
  const result = buildResolutionInputFromEnrichedProfile(profile);
  assert.equal(result.input.title, 'Sony WH-1000XM4');
  assert.equal(result.input.brand, 'Sony');
  assert.equal(result.input.model, 'WH-1000XM4');
  assert.equal(result.input.category, 'Electronics');
});

test('adds a caution warning for AMBIGUOUS profiles without blocking resolution', () => {
  const profile = fixtureProfile({ status: 'AMBIGUOUS', identity: { canonicalTitle: 'Widget' } });
  const result = buildResolutionInputFromEnrichedProfile(profile);
  assert.ok(result.warnings.some((w) => w.includes('AMBIGUOUS')));
});

test('passes enrichmentId and intakeId through for host-side tracing', () => {
  const profile = fixtureProfile({ enrichmentId: 'enrich-777', intakeId: 'intake-777', identity: { canonicalTitle: 'x' } });
  const result = buildResolutionInputFromEnrichedProfile(profile);
  assert.equal(result.enrichmentId, 'enrich-777');
  assert.equal(result.intakeId, 'intake-777');
});

test('is deterministic: identical input produces identical output', () => {
  const profile = fixtureProfile({
    identifiers: { upc: ['036000291452'] },
    identity: { canonicalTitle: 'Widget', brand: 'Acme' },
  });
  const a = buildResolutionInputFromEnrichedProfile(profile);
  const b = buildResolutionInputFromEnrichedProfile(profile);
  assert.deepEqual(a, b);
});
