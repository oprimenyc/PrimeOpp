import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVariantValue, buildVariant, detectVariantConflicts, areVariantsMergeable, groupVariantsByHash } from '../src/index.ts';

test('normalizeVariantValue uppercases and trims', () => {
  assert.equal(normalizeVariantValue('COLOR', '  Red  '), 'RED');
});

test('normalizeVariantValue maps BLK to BLACK', () => {
  assert.equal(normalizeVariantValue('COLOR', 'BLK'), 'BLACK');
});

test('normalizeVariantValue normalizes GB suffix', () => {
  assert.equal(normalizeVariantValue('STORAGE', '128 Gigabytes'), '128GB');
});

test('buildVariant produces stable attributeHash', () => {
  const a = buildVariant('p1', [
    { axis: 'COLOR', value: 'Red', source: 'scan', confidence: 0.9 },
    { axis: 'SIZE', value: 'M', source: 'scan', confidence: 0.9 },
  ]);
  const b = buildVariant('p1', [
    { axis: 'SIZE', value: 'M', source: 'scan', confidence: 0.9 },
    { axis: 'COLOR', value: 'red', source: 'scan', confidence: 0.9 },
  ]);
  assert.equal(a.attributeHash, b.attributeHash);
});

test('detectVariantConflicts flags size mismatch', () => {
  const a = buildVariant('p1', [{ axis: 'SHOE_SIZE', value: '10', source: 's', confidence: 0.9 }]);
  const b = buildVariant('p1', [{ axis: 'SHOE_SIZE', value: '11', source: 's', confidence: 0.9 }]);
  const c = detectVariantConflicts(a, b);
  assert.ok(c.some((x) => x.kind === 'SIZE_MISMATCH'));
});

test('detectVariantConflicts flags storage mismatch', () => {
  const a = buildVariant('p1', [{ axis: 'STORAGE', value: '128GB', source: 's', confidence: 0.9 }]);
  const b = buildVariant('p1', [{ axis: 'STORAGE', value: '256GB', source: 's', confidence: 0.9 }]);
  const c = detectVariantConflicts(a, b);
  assert.ok(c.some((x) => x.kind === 'STORAGE_MISMATCH'));
});

test('detectVariantConflicts flags color mismatch', () => {
  const a = buildVariant('p1', [{ axis: 'COLOR', value: 'Red', source: 's', confidence: 0.9 }]);
  const b = buildVariant('p1', [{ axis: 'COLOR', value: 'Blue', source: 's', confidence: 0.9 }]);
  const c = detectVariantConflicts(a, b);
  assert.ok(c.some((x) => x.kind === 'COLOR_MISMATCH'));
});

test('detectVariantConflicts flags edition mismatch', () => {
  const a = buildVariant('p1', [{ axis: 'EDITION', value: 'First', source: 's', confidence: 0.9 }]);
  const b = buildVariant('p1', [{ axis: 'EDITION', value: 'Second', source: 's', confidence: 0.9 }]);
  const c = detectVariantConflicts(a, b);
  assert.ok(c.some((x) => x.kind === 'EDITION_MISMATCH'));
});

test('detectVariantConflicts flags multipack mismatch', () => {
  const a = buildVariant('p1', [{ axis: 'BUNDLE_QTY', value: '1', source: 's', confidence: 0.9 }]);
  const b = buildVariant('p1', [{ axis: 'BUNDLE_QTY', value: '4', source: 's', confidence: 0.9 }]);
  const c = detectVariantConflicts(a, b);
  assert.ok(c.some((x) => x.kind === 'MULTIPACK_MISMATCH'));
});

test('detectVariantConflicts flags refurbished vs used mismatch', () => {
  const a = buildVariant('p1', [{ axis: 'CONDITION', value: 'REFURBISHED', source: 's', confidence: 0.9 }]);
  const b = buildVariant('p1', [{ axis: 'CONDITION', value: 'USED', source: 's', confidence: 0.9 }]);
  const c = detectVariantConflicts(a, b);
  assert.ok(c.some((x) => x.kind === 'CONDITION_MISMATCH'));
});

test('detectVariantConflicts returns empty for matching variants', () => {
  const a = buildVariant('p1', [{ axis: 'COLOR', value: 'Red', source: 's', confidence: 0.9 }]);
  const b = buildVariant('p1', [{ axis: 'COLOR', value: 'Red', source: 's', confidence: 0.9 }]);
  const c = detectVariantConflicts(a, b);
  assert.equal(c.length, 0);
});

test('areVariantsMergeable true for same hash', () => {
  const a = buildVariant('p1', [{ axis: 'COLOR', value: 'Red', source: 's', confidence: 0.9 }]);
  const b = buildVariant('p1', [{ axis: 'COLOR', value: 'Red', source: 's', confidence: 0.9 }]);
  assert.equal(areVariantsMergeable(a, b), true);
});

test('areVariantsMergeable false for different hash', () => {
  const a = buildVariant('p1', [{ axis: 'COLOR', value: 'Red', source: 's', confidence: 0.9 }]);
  const b = buildVariant('p1', [{ axis: 'COLOR', value: 'Blue', source: 's', confidence: 0.9 }]);
  assert.equal(areVariantsMergeable(a, b), false);
});

test('groupVariantsByHash clusters by attributeHash', () => {
  const a = buildVariant('p1', [{ axis: 'COLOR', value: 'Red', source: 's', confidence: 0.9 }]);
  const b = buildVariant('p1', [{ axis: 'COLOR', value: 'Red', source: 's', confidence: 0.9 }]);
  const c = buildVariant('p1', [{ axis: 'COLOR', value: 'Blue', source: 's', confidence: 0.9 }]);
  const groups = groupVariantsByHash([a, b, c]);
  assert.equal(groups.size, 2);
});

test('detectVariantConflicts flags missing distinguishing axis', () => {
  const a = buildVariant('p1', [{ axis: 'COLOR', value: 'Red', source: 's', confidence: 0.9 }, { axis: 'SIZE', value: 'M', source: 's', confidence: 0.9 }]);
  const b = buildVariant('p1', [{ axis: 'COLOR', value: 'Red', source: 's', confidence: 0.9 }]);
  const c = detectVariantConflicts(a, b);
  assert.ok(c.some((x) => x.kind === 'MISSING_DISTINGUISHING_AXIS'));
});
