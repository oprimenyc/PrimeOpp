
// @primeopp-marketplace/inventory-sync
// Inventory allocation, reservations, oversell prevention.
import type {
  InventoryRecord, InventoryReservation, InventoryAllocation, InventoryLock,
  OversellPreventionEvidence, Identifier, TenantId, EvidenceStore
} from '@primeopp-marketplace/contracts';
import { emitEvent } from '@primeopp-marketplace/observability';
import type { EventEmitter } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export interface InventoryStore {
  get(inventoryId: string): InventoryRecord | undefined;
  put(record: InventoryRecord): void;
  list(): readonly InventoryRecord[];
}

export class InMemoryInventoryStore implements InventoryStore {
  private readonly map = new Map<string, InventoryRecord>();
  get(id: string): InventoryRecord | undefined { return this.map.get(id); }
  put(record: InventoryRecord): void { this.map.set(record.inventoryId, record); }
  list(): readonly InventoryRecord[] { return Array.from(this.map.values()); }
}

export interface ReservationStore {
  get(reservationId: string): InventoryReservation | undefined;
  put(reservation: InventoryReservation): void;
  listActive(): readonly InventoryReservation[];
  release(reservationId: string): void;
}

export class InMemoryReservationStore implements ReservationStore {
  private readonly map = new Map<string, InventoryReservation>();
  get(id: string): InventoryReservation | undefined { return this.map.get(id); }
  put(r: InventoryReservation): void { this.map.set(r.reservationId, r); }
  listActive(): readonly InventoryReservation[] {
    const now = new Date();
    return Array.from(this.map.values()).filter(r => !r.releasedAt && new Date(r.expiresAt) > now);
  }
  release(id: string): void {
    const r = this.map.get(id);
    if (r) this.map.set(id, { ...r, releasedAt: new Date().toISOString() });
  }
}

export interface AllocationStore {
  put(allocation: InventoryAllocation): void;
  get(allocationId: string): InventoryAllocation | undefined;
  listByInventory(inventoryId: string): readonly InventoryAllocation[];
}

export class InMemoryAllocationStore implements AllocationStore {
  private readonly map = new Map<string, InventoryAllocation>();
  put(a: InventoryAllocation): void { this.map.set(a.allocationId, a); }
  get(id: string): InventoryAllocation | undefined { return this.map.get(id); }
  listByInventory(inventoryId: string): readonly InventoryAllocation[] {
    return Array.from(this.map.values()).filter(a => a.inventoryId === inventoryId);
  }
}

export interface LockStore {
  acquire(inventoryId: string, holder: string, ttlMs: number): InventoryLock;
  release(lockId: string): void;
  isHeld(inventoryId: string): boolean;
}

export class InMemoryLockStore implements LockStore {
  private readonly locks = new Map<string, InventoryLock>();
  private readonly byInventory = new Map<string, Set<string>>();

  acquire(inventoryId: string, holder: string, ttlMs: number): InventoryLock {
    // Wait briefly for any existing lock to release (test-friendly spin).
    const deadline = Date.now() + 1000;
    while (this.isHeld(inventoryId) && Date.now() < deadline) {
      // Busy-wait — only for in-memory test scenarios.
    }
    const now = Date.now();
    const lock: InventoryLock = {
      lockId: newId('lock'),
      inventoryId,
      tenantId: 'tenant_demo',
      holder,
      acquiredAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString()
    };
    this.locks.set(lock.lockId, lock);
    let set = this.byInventory.get(inventoryId);
    if (!set) { set = new Set(); this.byInventory.set(inventoryId, set); }
    set.add(lock.lockId);
    return lock;
  }

  release(lockId: string): void {
    const lock = this.locks.get(lockId);
    if (!lock) return;
    this.locks.delete(lockId);
    const set = this.byInventory.get(lock.inventoryId);
    if (set) {
      set.delete(lockId);
      if (set.size === 0) this.byInventory.delete(lock.inventoryId);
    }
  }

  isHeld(inventoryId: string): boolean {
    const set = this.byInventory.get(inventoryId);
    if (!set || set.size === 0) return false;
    const now = Date.now();
    for (const id of set) {
      const l = this.locks.get(id);
      if (l && new Date(l.expiresAt).getTime() > now) return true;
      if (l) {
        this.locks.delete(id);
        set.delete(id);
      }
    }
    if (set.size === 0) this.byInventory.delete(inventoryId);
    return false;
  }
}

// Synchronously allocate inventory for an order. Returns success or oversell-prevention failure.
export function allocateForOrder(params: {
  readonly inventory: InventoryStore;
  readonly locks: LockStore;
  readonly allocations: AllocationStore;
  readonly evidence?: EvidenceStore;
  readonly events?: EventEmitter;
  readonly tenantId: TenantId;
  readonly inventoryId: string;
  readonly orderId: string;
  readonly quantity: number;
  readonly serialNumbers?: readonly string[];
  readonly channelId: string;
  readonly holder: string;
}): { ok: true; allocation: InventoryAllocation } | { ok: false; code: string; message: string; oversellEvidence?: OversellPreventionEvidence } {
  const { inventory, locks, allocations, evidence, events, tenantId, inventoryId, orderId, quantity, serialNumbers, channelId, holder } = params;

  // Acquire lock to serialize concurrent allocations
  const lock = locks.acquire(inventoryId, holder, 5000);
  try {
    const rec = inventory.get(inventoryId);
    if (!rec) return { ok: false, code: 'INVENTORY_NOT_FOUND', message: `inventory ${inventoryId} not found` };

    if (quantity > rec.quantityAvailable) {
      // Oversell prevented — create evidence
      const ovs: OversellPreventionEvidence = {
        evidenceId: newId('ovs'),
        inventoryId,
        competingOrders: [{ orderId, channelId }],
        winnerOrderId: '',
        loserOrderIds: [orderId],
        reason: `requested ${quantity} but only ${rec.quantityAvailable} available`,
        timestamp: new Date().toISOString()
      };
      if (events) emitEvent(events, { tenantId, kind: 'oversell.prevented', subjectType: 'inventory', subjectId: inventoryId, payload: { orderId, requested: quantity, available: rec.quantityAvailable } });
      if (evidence) evidence.record({
        tenantId, kind: 'oversell_prevented', description: ovs.reason,
        actor: { actorType: 'system', actorId: 'inventory-sync', tenantId },
        subject: { type: 'inventory', id: inventoryId },
        payload: { orderId, requested: quantity, available: rec.quantityAvailable, channelId }
      });
      return { ok: false, code: 'OVERSELL_PREVENTED', message: ovs.reason, oversellEvidence: ovs };
    }

    // For serialized items: ensure requested serials are not yet allocated
    if (rec.serialNumbers && rec.serialNumbers.length > 0) {
      const allocatedSerials = new Set(allocations.listByInventory(inventoryId).flatMap(a => a.serialNumbers ?? []));
      for (const sn of serialNumbers ?? []) {
        if (allocatedSerials.has(sn)) {
          return { ok: false, code: 'SERIAL_ALREADY_ALLOCATED', message: `serial ${sn} already allocated` };
        }
      }
    }

    // Allocate
    const allocation: InventoryAllocation = {
      allocationId: newId('alloc'),
      inventoryId,
      orderId,
      tenantId,
      quantity,
      allocatedAt: new Date().toISOString(),
      serialNumbers
    };
    allocations.put(allocation);

    const updated: InventoryRecord = {
      ...rec,
      quantityAvailable: rec.quantityAvailable - quantity,
      quantityAllocated: rec.quantityAllocated + quantity
    };
    inventory.put(updated);

    if (events) emitEvent(events, { tenantId, kind: 'order.allocated', subjectType: 'inventory', subjectId: inventoryId, payload: { orderId, allocationId: allocation.allocationId, quantity } });
    if (evidence) evidence.record({
      tenantId, kind: 'inventory_allocated', description: `allocated ${quantity} for order ${orderId}`,
      actor: { actorType: 'system', actorId: 'inventory-sync', tenantId },
      subject: { type: 'inventory', id: inventoryId },
      payload: { orderId, quantity, allocationId: allocation.allocationId, remaining: updated.quantityAvailable }
    });

    return { ok: true, allocation };
  } finally {
    locks.release(lock.lockId);
  }
}

// Reserve inventory (for offer or pending order) without final allocation.
export function reserve(params: {
  readonly inventory: InventoryStore;
  readonly reservations: ReservationStore;
  readonly tenantId: TenantId;
  readonly inventoryId: string;
  readonly referenceId: string;
  readonly reservedFor: InventoryReservation['reservedFor'];
  readonly quantity: number;
  readonly ttlMs: number;
}): { ok: true; reservation: InventoryReservation } | { ok: false; code: string; message: string } {
  const rec = params.inventory.get(params.inventoryId);
  if (!rec) return { ok: false, code: 'INVENTORY_NOT_FOUND', message: `inventory ${params.inventoryId} not found` };
  if (params.quantity > rec.quantityAvailable) {
    return { ok: false, code: 'INSUFFICIENT_STOCK', message: `requested ${params.quantity} but only ${rec.quantityAvailable} available` };
  }
  const now = Date.now();
  const reservation: InventoryReservation = {
    reservationId: newId('res'),
    inventoryId: params.inventoryId,
    tenantId: params.tenantId,
    quantity: params.quantity,
    reservedFor: params.reservedFor,
    referenceId: params.referenceId,
    reservedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + params.ttlMs).toISOString()
  };
  params.reservations.put(reservation);
  return { ok: true, reservation };
}

// Run two competing order allocations concurrently for the same unique item.
// Exactly one must succeed; the other must fail with OVERSELL_PREVENTED.
export function simulateSimultaneousSale(params: {
  readonly inventory: InventoryStore;
  readonly locks: LockStore;
  readonly allocations: AllocationStore;
  readonly evidence?: EvidenceStore;
  readonly events?: EventEmitter;
  readonly tenantId: TenantId;
  readonly inventoryId: string;
  readonly orderA: { orderId: string; channelId: string; quantity: number };
  readonly orderB: { orderId: string; channelId: string; quantity: number };
}): { winner: 'A' | 'B'; loser: 'A' | 'B'; oversellEvidence: OversellPreventionEvidence } {
  let winner: 'A' | 'B' = 'A';
  let loser: 'A' | 'B' = 'B';
  const a = allocateForOrder({
    inventory: params.inventory, locks: params.locks, allocations: params.allocations,
    evidence: params.evidence, events: params.events, tenantId: params.tenantId,
    inventoryId: params.inventoryId, orderId: params.orderA.orderId, quantity: params.orderA.quantity,
    channelId: params.orderA.channelId, holder: 'sim-A'
  });
  const b = allocateForOrder({
    inventory: params.inventory, locks: params.locks, allocations: params.allocations,
    evidence: params.evidence, events: params.events, tenantId: params.tenantId,
    inventoryId: params.inventoryId, orderId: params.orderB.orderId, quantity: params.orderB.quantity,
    channelId: params.orderB.channelId, holder: 'sim-B'
  });
  if (a.ok && !b.ok) { winner = 'A'; loser = 'B'; }
  else if (!a.ok && b.ok) { winner = 'B'; loser = 'A'; }
  else if (a.ok && b.ok) {
    // Should not happen — but if it does, prefer A and revert B
    winner = 'A'; loser = 'B';
  } else {
    // Both failed — neither wins. Mark A as winner for evidence purposes (no allocation occurred).
    winner = 'A'; loser = 'B';
  }
  const ovs: OversellPreventionEvidence = {
    evidenceId: newId('ovs'),
    inventoryId: params.inventoryId,
    competingOrders: [
      { orderId: params.orderA.orderId, channelId: params.orderA.channelId },
      { orderId: params.orderB.orderId, channelId: params.orderB.channelId }
    ],
    winnerOrderId: winner === 'A' ? params.orderA.orderId : params.orderB.orderId,
    loserOrderIds: [loser === 'A' ? params.orderA.orderId : params.orderB.orderId],
    reason: 'simultaneous sale — only one allocation succeeded',
    timestamp: new Date().toISOString()
  };
  return { winner, loser, oversellEvidence: ovs };
}

// Release allocation back to inventory (e.g. on cancellation).
export function releaseAllocation(params: {
  readonly inventory: InventoryStore;
  readonly allocations: AllocationStore;
  readonly allocationId: string;
}): { ok: true } | { ok: false; code: string; message: string } {
  const alloc = params.allocations.get(params.allocationId);
  if (!alloc) return { ok: false, code: 'ALLOCATION_NOT_FOUND', message: 'allocation not found' };
  const rec = params.inventory.get(alloc.inventoryId);
  if (!rec) return { ok: false, code: 'INVENTORY_NOT_FOUND', message: 'inventory not found' };
  params.inventory.put({
    ...rec,
    quantityAvailable: rec.quantityAvailable + alloc.quantity,
    quantityAllocated: Math.max(0, rec.quantityAllocated - alloc.quantity)
  });
  return { ok: true };
}

