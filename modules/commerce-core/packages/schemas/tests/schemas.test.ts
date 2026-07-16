import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateString,
  validateNumber,
  validateConfidence,
  validateMoney,
  validateBarcodeFormat,
  validateCanonicalCondition,
  validateTenantScoped,
  validateProductIdentifier,
  validateTerminalState,
  validateOperationResult,
  allJsonSchemas,
} from '../src/index.ts';

test('validateString accepts valid', () => {
  const r = validateString('hello', { minLen: 1, maxLen: 10 });
  assert.equal(r.valid, true);
  assert.equal(r.value, 'hello');
});

test('validateString rejects empty when minLen=1', () => {
  const r = validateString('', { minLen: 1 });
  assert.equal(r.valid, false);
});

test('validateNumber rejects NaN', () => {
  const r = validateNumber(NaN);
  assert.equal(r.valid, false);
});

test('validateConfidence enforces [0,1]', () => {
  assert.equal(validateConfidence(-0.1).valid, false);
  assert.equal(validateConfidence(0.5).valid, true);
  assert.equal(validateConfidence(1.5).valid, false);
});

test('validateMoney accepts valid', () => {
  const r = validateMoney({ amount: 10.5, currency: 'USD', precise: true, status: 'ACTUAL' });
  assert.equal(r.valid, true);
  assert.equal(r.value?.amount, 10.5);
});

test('validateMoney rejects invalid currency', () => {
  const r = validateMoney({ amount: 10.5, currency: 'usd', precise: true, status: 'ACTUAL' });
  assert.equal(r.valid, false);
});

test('validateBarcodeFormat accepts EAN_13', () => {
  assert.equal(validateBarcodeFormat('EAN_13').valid, true);
});

test('validateBarcodeFormat rejects bogus', () => {
  assert.equal(validateBarcodeFormat('BOGUS').valid, false);
});

test('validateCanonicalCondition accepts NEW', () => {
  assert.equal(validateCanonicalCondition('NEW').valid, true);
});

test('validateCanonicalCondition rejects unknown', () => {
  assert.equal(validateCanonicalCondition('MINT').valid, false);
});

test('validateTenantScoped requires tenantId', () => {
  assert.equal(validateTenantScoped({}).valid, false);
  assert.equal(validateTenantScoped({ tenantId: 't1' }).valid, true);
  assert.equal(validateTenantScoped({ tenantId: 't1', organizationId: 'o1' }).valid, true);
});

test('validateProductIdentifier enforces required fields', () => {
  const r = validateProductIdentifier({
    type: 'UPC',
    value: '036000291452',
    source: 'scan',
    verification: 'CHECK_DIGIT_VALID',
    confidence: 0.95,
    observedAt: '2026-01-01T00:00:00Z',
  });
  assert.equal(r.valid, true);
});

test('validateProductIdentifier rejects missing observedAt', () => {
  const r = validateProductIdentifier({
    type: 'UPC',
    value: '036000291452',
    source: 'scan',
    verification: 'CHECK_DIGIT_VALID',
    confidence: 0.95,
  });
  assert.equal(r.valid, false);
});

test('validateTerminalState accepts SUCCEEDED', () => {
  assert.equal(validateTerminalState('SUCCEEDED').valid, true);
  assert.equal(validateTerminalState('UNKNOWN').valid, false);
});

test('validateOperationResult requires value or error', () => {
  const r1 = validateOperationResult({ state: 'SUCCEEDED', warnings: [], evidence: [], correlationId: 'c1' });
  assert.equal(r1.valid, false);
  const r2 = validateOperationResult({
    state: 'SUCCEEDED',
    value: { a: 1 },
    warnings: [],
    evidence: [],
    correlationId: 'c1',
  });
  assert.equal(r2.valid, true);
});

test('allJsonSchemas exposes Money, ProductIdentifier, etc.', () => {
  assert.ok(allJsonSchemas.Money);
  assert.ok(allJsonSchemas.ProductIdentifier);
  assert.ok(allJsonSchemas.CanonicalCondition);
  assert.ok(allJsonSchemas.Product);
  assert.ok(allJsonSchemas.TenantScoped);
});
