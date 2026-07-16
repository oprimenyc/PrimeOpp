import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InventoryEngine, InMemoryInventoryStorage, createInventoryRecord } from '../src/index.ts';

function setup() {
  const storage = new InMemoryInventoryStorage();
  const engine = new InventoryEngine({ storage });
  return { storage, engine };
}

test('CREATE creates an available record', async () => {
  const { engine } = setup();
  const r = await engine.execute({
    kind: 'CREATE',
    productId: 'p1',
    locationId: 'l1',
    quantity: 10,
    idempotencyKey: 'k1',
    scope: { tenantId: 't1' },
  });
  assert.equal(r.success, true);
  assert.equal(r.record?.quantities.available, 10);
  assert.equal(r.record?.state, 'AVAILABLE');
  assert.equal(r.idempotentReplay, false);
});

test('CREATE with same idempotency key is a replay', async () => {
  const { engine } = setup();
  const op = { kind: 'CREATE' as const, productId: 'p1', locationId: 'l1', quantity: 10, idempotencyKey: 'k1', scope: { tenantId: 't1' } };
  const r1 = await engine.execute(op);
  const r2 = await engine.execute(op);
  assert.equal(r1.success, true);
  assert.equal(r2.success, true);
  assert.equal(r2.idempotentReplay, true);
  assert.equal(r2.record?.id, r1.record?.id);
});

test('RESERVE moves quantity from available to reserved', async () => {
  const { engine } = setup();
  await engine.execute({ kind: 'CREATE', productId: 'p1', locationId: 'l1', quantity: 10, idempotencyKey: 'k1', scope: { tenantId: 't1' } });
  const r = await engine.execute({ kind: 'RESERVE', productId: 'p1', locationId: 'l1', quantity: 4, idempotencyKey: 'k2', scope: { tenantId: 't1' } });
  assert.equal(r.success, true);
  assert.equal(r.record?.quantities.available, 6);
  assert.equal(r.record?.quantities.reserved, 4);
});

test('RESERVE prevents oversell', async () => {
  const { engine } = setup();
  await engine.execute({ kind: 'CREATE', productId: 'p1', locationId: 'l1', quantity: 10, idempotencyKey: 'k1', scope: { tenantId: 't1' } });
  const r = await engine.execute({ kind: 'RESERVE', productId: 'p1', locationId: 'l1', quantity: 11, idempotencyKey: 'k2', scope: { tenantId: 't1' } });
  assert.equal(r.success, false);
  assert.equal(r.error?.code, 'OPERATION_FAILED');
  assert.match(r.error?.message ?? '', /OVERSELL_PREVENTED/);
});

test('RELEASE moves quantity back from reserved to available', async () => {
  const { engine } = setup();
  await engine.execute({ kind: 'CREATE', productId: 'p1', locationId: 'l1', quantity: 10, idempotencyKey: 'k1', scope: { tenantId: 't1' } });
  await engine.execute({ kind: 'RESERVE', productId: 'p1', locationId: 'l1', quantity: 4, idempotencyKey: 'k2', scope: { tenantId: 't1' } });
  const r = await engine.execute({ kind: 'RELEASE', productId: 'p1', locationId: 'l1', quantity: 2, idempotencyKey: 'k3', scope: { tenantId: 't1' } });
  assert.equal(r.success, true);
  assert.equal(r.record?.quantities.reserved, 2);
  assert.equal(r.record?.quantities.available, 8);
});

test('SALE_ALLOCATE consumes reserved first then available', async () => {
  const { engine } = setup();
  await engine.execute({ kind: 'CREATE', productId: 'p1', locationId: 'l1', quantity: 10, idempotencyKey: 'k1', scope: { tenantId: 't1' } });
  await engine.execute({ kind: 'RESERVE', productId: 'p1', locationId: 'l1', quantity: 4, idempotencyKey: 'k2', scope: { tenantId: 't1' } });
  const r = await engine.execute({ kind: 'SALE_ALLOCATE', productId: 'p1', locationId: 'l1', quantity: 6, idempotencyKey: 'k3', scope: { tenantId: 't1' } });
  assert.equal(r.success, true);
  assert.equal(r.record?.quantities.reserved, 0);
  assert.equal(r.record?.quantities.available, 4);
  assert.equal(r.record?.quantities.committed, 6);
  assert.equal(r.record?.quantities.sold, 6);
});

test('SALE_ALLOCATE prevents oversell when reserved+available insufficient', async () => {
  const { engine } = setup();
  await engine.execute({ kind: 'CREATE', productId: 'p1', locationId: 'l1', quantity: 10, idempotencyKey: 'k1', scope: { tenantId: 't1' } });
  await engine.execute({ kind: 'RESERVE', productId: 'p1', locationId: 'l1', quantity: 4, idempotencyKey: 'k2', scope: { tenantId: 't1' } });
  const r = await engine.execute({ kind: 'SALE_ALLOCATE', productId: 'p1', locationId: 'l1', quantity: 11, idempotencyKey: 'k3', scope: { tenantId: 't1' } });
  assert.equal(r.success, false);
  assert.match(r.error?.message ?? '', /OVERSELL_PREVENTED/);
});

test('TRANSFER reduces available at source', async () => {
  const { engine } = setup();
  await engine.execute({ kind: 'CREATE', productId: 'p1', locationId: 'l1', quantity: 10, idempotencyKey: 'k1', scope: { tenantId: 't1' } });
  const r = await engine.execute({ kind: 'TRANSFER', productId: 'p1', locationId: 'l1', toLocationId: 'l2', quantity: 4, idempotencyKey: 'k2', scope: { tenantId: 't1' } });
  assert.equal(r.success, true);
  assert.equal(r.record?.quantities.available, 6);
});

test('ADJUST with negative delta is allowed but not below zero', async () => {
  const { engine } = setup();
  await engine.execute({ kind: 'CREATE', productId: 'p1', locationId: 'l1', quantity: 10, idempotencyKey: 'k1', scope: { tenantId: 't1' } });
  const r = await engine.execute({ kind: 'ADJUST', productId: 'p1', locationId: 'l1', quantity: -3, idempotencyKey: 'k2', scope: { tenantId: 't1' } });
  assert.equal(r.success, true);
  assert.equal(r.record?.quantities.available, 7);
  const r2 = await engine.execute({ kind: 'ADJUST', productId: 'p1', locationId: 'l1', quantity: -100, idempotencyKey: 'k3', scope: { tenantId: 't1' } });
  assert.equal(r2.success, false);
});

test('RETURN moves sold back to available', async () => {
  const { engine } = setup();
  await engine.execute({ kind: 'CREATE', productId: 'p1', locationId: 'l1', quantity: 10, idempotencyKey: 'k1', scope: { tenantId: 't1' } });
  await engine.execute({ kind: 'SALE_ALLOCATE', productId: 'p1', locationId: 'l1', quantity: 4, idempotencyKey: 'k2', scope: { tenantId: 't1' } });
  const r = await engine.execute({ kind: 'RETURN', productId: 'p1', locationId: 'l1', quantity: 2, idempotencyKey: 'k3', scope: { tenantId: 't1' } });
  assert.equal(r.success, true);
  assert.equal(r.record?.quantities.sold, 2);
  assert.equal(r.record?.quantities.returned, 2);
  assert.equal(r.record?.quantities.available, 8);
});

test('RECONCILE forces available to given quantity', async () => {
  const { engine } = setup();
  await engine.execute({ kind: 'CREATE', productId: 'p1', locationId: 'l1', quantity: 10, idempotencyKey: 'k1', scope: { tenantId: 't1' } });
  await engine.execute({ kind: 'RESERVE', productId: 'p1', locationId: 'l1', quantity: 4, idempotencyKey: 'k2', scope: { tenantId: 't1' } });
  const r = await engine.execute({ kind: 'RECONCILE', productId: 'p1', locationId: 'l1', quantity: 12, idempotencyKey: 'k3', scope: { tenantId: 't1' } });
  assert.equal(r.success, true);
  assert.equal(r.record?.quantities.available, 12);
});

test('concurrent RESERVE does not oversell (idempotency-keyed)', async () => {
  const { engine } = setup();
  await engine.execute({ kind: 'CREATE', productId: 'p1', locationId: 'l1', quantity: 5, idempotencyKey: 'k1', scope: { tenantId: 't1' } });
  // Issue 5 reservations of qty=2 simultaneously. Each has a unique idempotency key.
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(engine.execute({ kind: 'RESERVE', productId: 'p1', locationId: 'l1', quantity: 2, idempotencyKey: `k-r${i}`, scope: { tenantId: 't1' } }));
  }
  const results = await Promise.all(promises);
  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success);
  // Only 2 reservations of qty=2 can succeed (total 4 ≤ 5). The 3rd would push to 6 > 5.
  assert.equal(successes.length, 2);
  assert.equal(failures.length, 3);
  const final = await engine.execute({ kind: 'RECONCILE', productId: 'p1', locationId: 'l1', quantity: 0, idempotencyKey: 'k-final', scope: { tenantId: 't1' } });
  // Wait — RECONCILE overrides; let's just check the available in the last successful reserve.
  const lastSuccess = successes[successes.length - 1];
  assert.equal(lastSuccess.record?.quantities.available, 1);
  assert.equal(lastSuccess.record?.quantities.reserved, 4);
});

test('cross-tenant access is denied by storage filter', async () => {
  const { storage } = setup();
  await storage.upsert(createInventoryRecord({ productId: 'p1', locationId: 'l1', quantity: 5, scope: { tenantId: 't1' } }));
  // Tenant t2 cannot see t1's inventory.
  const r = await storage.get('t2', 'p1', undefined, 'l1');
  assert.equal(r, undefined);
});
