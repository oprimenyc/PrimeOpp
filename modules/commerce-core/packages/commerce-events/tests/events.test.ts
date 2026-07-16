import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryEventSink, buildEvent, filterEventsByTenant, redactEventForSharing, ReplayDetector } from '../src/index.ts';

test('buildEvent populates required fields', () => {
  const e = buildEvent({ type: 'product.created', tenantId: 't1', payload: { id: 'p1' }, source: 'test', subject: 'p1' });
  assert.ok(e.eventId);
  assert.equal(e.type, 'product.created');
  assert.equal(e.tenantId, 't1');
  assert.equal(e.schemaVersion, '1.0.0');
});

test('in-memory sink stores events', async () => {
  const sink = createInMemoryEventSink();
  await sink.emit(buildEvent({ type: 'product.created', tenantId: 't1', payload: {}, source: 's', subject: 'p' }));
  assert.equal(sink.events.length, 1);
});

test('in-memory sink supports subscribe', async () => {
  const sink = createInMemoryEventSink();
  const received: string[] = [];
  sink.subscribe((e) => received.push(e.eventId));
  const e = buildEvent({ type: 'product.created', tenantId: 't1', payload: {}, source: 's', subject: 'p' });
  await sink.emit(e);
  assert.equal(received.length, 1);
  assert.equal(received[0], e.eventId);
});

test('filterEventsByTenant enforces tenant isolation', () => {
  const e1 = buildEvent({ type: 'product.created', tenantId: 't1', payload: {}, source: 's', subject: 'p' });
  const e2 = buildEvent({ type: 'product.created', tenantId: 't2', payload: {}, source: 's', subject: 'p' });
  const filtered = filterEventsByTenant([e1, e2], 't1');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].tenantId, 't1');
});

test('redactEventForSharing drops COST_BASIS events', () => {
  const e = buildEvent({ type: 'profit.calculated', tenantId: 't1', payload: { profit: 100 }, source: 's', subject: 'p', sensitivity: 'COST_BASIS' });
  assert.equal(redactEventForSharing(e), null);
});

test('redactEventForSharing drops SELLER_PRIVATE events', () => {
  const e = buildEvent({ type: 'product.created', tenantId: 't1', payload: {}, source: 's', subject: 'p', sensitivity: 'SELLER_PRIVATE' });
  assert.equal(redactEventForSharing(e), null);
});

test('redactEventForSharing passes through PUBLIC events', () => {
  const e = buildEvent({ type: 'product.created', tenantId: 't1', payload: {}, source: 's', subject: 'p', sensitivity: 'PUBLIC' });
  const r = redactEventForSharing(e);
  assert.ok(r);
});

test('ReplayDetector rejects duplicate eventIds', () => {
  const d = new ReplayDetector(100);
  assert.equal(d.check('e1'), true);
  assert.equal(d.check('e1'), false);
  assert.equal(d.check('e2'), true);
});

test('ReplayDetector evicts oldest entries past max', () => {
  const d = new ReplayDetector(2);
  d.check('e1');
  d.check('e2');
  d.check('e3');
  // e1 should have been evicted; re-checking it should return true.
  assert.equal(d.check('e1'), true);
});
