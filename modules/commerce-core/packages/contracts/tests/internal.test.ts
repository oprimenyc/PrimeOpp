import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMA_VERSION, uuid, hashString, ok, fail, clamp01, roundTo, stableStringify } from '../src/index.ts';

test('SCHEMA_VERSION is set', () => {
  assert.equal(SCHEMA_VERSION, '1.0.0');
});

test('uuid returns UUID-like string', () => {
  const id = uuid();
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('hashString is deterministic', () => {
  const a = hashString('hello');
  const b = hashString('hello');
  assert.equal(a, b);
  assert.notEqual(a, hashString('world'));
  assert.equal(a.length, 16);
});

test('clamp01 clamps to [0,1]', () => {
  assert.equal(clamp01(-1), 0);
  assert.equal(clamp01(0.5), 0.5);
  assert.equal(clamp01(2), 1);
  assert.equal(clamp01(NaN), 0);
});

test('roundTo rounds to decimals', () => {
  assert.equal(roundTo(3.14159, 2), 3.14);
  assert.equal(roundTo(3.14159, 4), 3.1416);
});

test('stableStringify sorts keys', () => {
  const out = stableStringify({ b: 1, a: { z: 1, y: 2 } });
  assert.equal(out, '{"a":{"y":2,"z":1},"b":1}');
});

test('ok wraps success', () => {
  const r = ok({ x: 1 });
  assert.equal(r.state, 'SUCCEEDED');
  assert.deepEqual(r.value, { x: 1 });
  assert.equal(r.warnings.length, 0);
  assert.ok(r.correlationId);
});

test('fail wraps failure', () => {
  const r = fail('ERR', 'bad', { details: { foo: 'bar' } });
  assert.equal(r.state, 'FAILED');
  assert.equal(r.error?.code, 'ERR');
  assert.equal(r.error?.message, 'bad');
  assert.deepEqual(r.error?.details, { foo: 'bar' });
});
