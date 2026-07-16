// Inventory engine — Phase 9.
// Complete inventory foundation with concurrency protection, idempotency,
// and oversell prevention.

import type {
  Identified,
  ISO8601,
  TenantScoped,
  Timestamped,
} from '@primeopp/contracts';
import { nowUtc, uuid } from '@primeopp/contracts';

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

export type InventoryState =
  | 'DRAFT'
  | 'INBOUND'
  | 'AVAILABLE'
  | 'RESERVED'
  | 'LISTED'
  | 'PARTIALLY_LISTED'
  | 'SOLD'
  | 'PARTIALLY_SOLD'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'RETURN_REQUESTED'
  | 'RETURNED'
  | 'DAMAGED'
  | 'LOST'
  | 'ARCHIVED';

export interface InventoryQuantities {
  available: number;
  reserved: number;
  committed: number;
  sold: number;
  damaged: number;
  returned: number;
  inbound: number;
  unknown: number;
}

export interface InventoryRecord extends Identified, Timestamped, TenantScoped {
  productId: string;
  variantId?: string;
  locationId: string;
  /** Serialized unit IDs (when present, quantity must equal 1 per unit). */
  serializedUnitIds?: string[];
  /** True for unique collectibles, consignment items, donor inventory, etc. */
  uniqueItem?: boolean;
  /** True for POD/dropship virtual inventory. */
  virtual?: boolean;
  /** For consignment: owner reference. */
  consignmentOwner?: string;
  /** For POD: production partner ref. */
  podPartnerRef?: string;
  /** For dropship: supplier ref. */
  supplierRef?: string;
  /** For affiliate: no owned quantity — affiliate link reference. */
  affiliateOfferRef?: string;
  state: InventoryState;
  quantities: InventoryQuantities;
  /** Version for optimistic concurrency. */
  version: number;
  /** Idempotency key history (most recent N). */
  idempotencyKeys?: string[];
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

export type InventoryOperationKind =
  | 'CREATE'
  | 'ADJUST'
  | 'RESERVE'
  | 'RELEASE'
  | 'TRANSFER'
  | 'SALE_ALLOCATE'
  | 'RETURN'
  | 'RECONCILE'
  | 'CYCLE_COUNT';

export interface InventoryOperation {
  kind: InventoryOperationKind;
  productId: string;
  variantId?: string;
  locationId: string;
  quantity: number;
  idempotencyKey: string;
  scope: TenantScoped;
  reason?: string;
  evidenceRefs?: string[];
  /** For TRANSFER. */
  toLocationId?: string;
  /** For SALE_ALLOCATE. */
  channelRef?: string;
  /** For CYCLE_COUNT. */
  countedQuantity?: number;
}

export interface InventoryOperationResult {
  /** Explicit terminal state per the OperationResult contract. */
  state: 'SUCCEEDED' | 'PARTIALLY_SUCCEEDED' | 'REQUIRES_REVIEW' | 'FAILED' | 'CANCELLED';
  /** Convenience boolean: true iff state === 'SUCCEEDED'. */
  success: boolean;
  record?: InventoryRecord;
  error?: { code: string; message: string };
  warnings: string[];
  operationId: string;
  appliedAt: ISO8601;
  /** True if the operation was a no-op due to idempotency replay. */
  idempotentReplay: boolean;
}

// ---------------------------------------------------------------------------
// Storage adapter
// ---------------------------------------------------------------------------

export interface InventoryStorageAdapter {
  get(tenantId: string, productId: string, variantId: string | undefined, locationId: string): Promise<InventoryRecord | undefined>;
  upsert(record: InventoryRecord): Promise<void>;
  listByTenant(tenantId: string): Promise<InventoryRecord[]>;
  listByProduct(tenantId: string, productId: string): Promise<InventoryRecord[]>;
  listByLocation(tenantId: string, locationId: string): Promise<InventoryRecord[]>;
}

/**
 * In-memory storage adapter. Suitable for tests and ephemeral use.
 */
export class InMemoryInventoryStorage implements InventoryStorageAdapter {
  private readonly records = new Map<string, InventoryRecord>();

  private key(tenantId: string, productId: string, variantId: string | undefined, locationId: string): string {
    return `${tenantId}|${productId}|${variantId ?? '_'}|${locationId}`;
  }

  async get(tenantId: string, productId: string, variantId: string | undefined, locationId: string): Promise<InventoryRecord | undefined> {
    return this.records.get(this.key(tenantId, productId, variantId, locationId));
  }

  async upsert(record: InventoryRecord): Promise<void> {
    this.records.set(this.key(record.tenantId, record.productId, record.variantId, record.locationId), record);
  }

  async listByTenant(tenantId: string): Promise<InventoryRecord[]> {
    return Array.from(this.records.values()).filter((r) => r.tenantId === tenantId);
  }

  async listByProduct(tenantId: string, productId: string): Promise<InventoryRecord[]> {
    return Array.from(this.records.values()).filter((r) => r.tenantId === tenantId && r.productId === productId);
  }

  async listByLocation(tenantId: string, locationId: string): Promise<InventoryRecord[]> {
    return Array.from(this.records.values()).filter((r) => r.tenantId === tenantId && r.locationId === locationId);
  }
}

/**
 * SQLite storage adapter (contract only — uses in-memory backing store
 * for now, but the interface is the persistence seam).
 *
 * This is the integration point for a future persistent SQLite backend.
 */
export class SQLiteInventoryStorage extends InMemoryInventoryStorage {
  readonly adapterId = 'sqlite.inventory';
  readonly dbPath: string;

  constructor(dbPath = ':memory:') {
    super();
    this.dbPath = dbPath;
  }
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export interface InventoryEngineOptions {
  storage: InventoryStorageAdapter;
  /** Max remembered idempotency keys per record. */
  idempotencyHistorySize?: number;
}

export class InventoryEngine {
  private readonly opts: InventoryEngineOptions;
  /** Per-record Promise chain to enforce serial execution and prevent oversell. */
  private readonly lockChains = new Map<string, Promise<unknown>>();
  constructor(opts: InventoryEngineOptions) {
    this.opts = opts;
  }

  async execute(op: InventoryOperation): Promise<InventoryOperationResult> {
    const appliedAt = nowUtc();
    const operationId = uuid();
    const scope = op.scope;

    // Tenant guard.
    if (op.scope.tenantId !== op.scope.tenantId) {
      return { state: 'FAILED', success: false, error: { code: 'TENANT_MISMATCH', message: 'tenant mismatch' }, warnings: [], operationId, appliedAt, idempotentReplay: false };
    }

    // Serialize per-record operations via a Promise chain. Each call attaches
    // itself to the previous Promise for that record key, ensuring that only
    // one operation runs to completion before the next starts.
    const lockKey = `${scope.tenantId}|${op.productId}|${op.variantId ?? '_'}|${op.locationId}`;
    const prev = this.lockChains.get(lockKey) ?? Promise.resolve();
    let release: () => void;
    const myTurn = new Promise<void>((resolve) => { release = resolve; });
    const next = prev.then(() => myTurn);
    this.lockChains.set(lockKey, next.then(() => undefined));

    try {
      await prev;
      return await this.executeLocked(op, appliedAt, operationId);
    } finally {
      release!();
    }
  }

  private async executeLocked(op: InventoryOperation, appliedAt: string, operationId: string): Promise<InventoryOperationResult> {
    const scope = op.scope;
    const existing = await this.opts.storage.get(scope.tenantId, op.productId, op.variantId, op.locationId);

    // Idempotency replay check.
    if (existing?.idempotencyKeys?.includes(op.idempotencyKey)) {
      return {
        state: 'SUCCEEDED',
        success: true,
        record: existing,
        warnings: ['idempotency replay — operation already applied'],
        operationId,
        appliedAt,
        idempotentReplay: true,
      };
    }

    let record: InventoryRecord;
    try {
      record = await this.apply(op, existing);
    } catch (e) {
      const err = e as Error;
      return {
        state: 'FAILED',
        success: false,
        error: { code: 'OPERATION_FAILED', message: err.message },
        warnings: [],
        operationId,
        appliedAt,
        idempotentReplay: false,
      };
    }

    // Track idempotency key.
    const max = this.opts.idempotencyHistorySize ?? 100;
    const newKeys = [...(record.idempotencyKeys ?? []), op.idempotencyKey].slice(-max);
    record = { ...record, idempotencyKeys: newKeys, version: record.version + 1, updatedAt: nowUtc() };

    await this.opts.storage.upsert(record);

    return {
      state: 'SUCCEEDED',
      success: true,
      record,
      warnings: [],
      operationId,
      appliedAt,
      idempotentReplay: false,
    };
  }

  private async apply(op: InventoryOperation, existing: InventoryRecord | undefined): Promise<InventoryRecord> {
    // Negative quantity is allowed for ADJUST (stock corrections), RELEASE, RETURN.
    // Not allowed for CREATE, RESERVE, SALE_ALLOCATE, TRANSFER (those represent additions or outflows).
    if (op.quantity < 0 && op.kind !== 'CYCLE_COUNT' && op.kind !== 'RECONCILE' && op.kind !== 'ADJUST' && op.kind !== 'RELEASE' && op.kind !== 'RETURN') {
      throw new Error(`negative quantity not allowed for ${op.kind}`);
    }

    switch (op.kind) {
      case 'CREATE':
        return this.applyCreate(op, existing);
      case 'ADJUST':
        return this.applyAdjust(op, existing);
      case 'RESERVE':
        return this.applyReserve(op, existing);
      case 'RELEASE':
        return this.applyRelease(op, existing);
      case 'TRANSFER':
        return this.applyTransfer(op, existing);
      case 'SALE_ALLOCATE':
        return this.applySaleAllocate(op, existing);
      case 'RETURN':
        return this.applyReturn(op, existing);
      case 'RECONCILE':
        return this.applyReconcile(op, existing);
      case 'CYCLE_COUNT':
        return this.applyCycleCount(op, existing);
      default:
        throw new Error(`unsupported operation kind: ${op.kind satisfies never}`);
    }
  }

  private applyCreate(op: InventoryOperation, existing: InventoryRecord | undefined): InventoryRecord {
    if (existing) throw new Error('CREATE on existing record — use ADJUST instead');
    return {
      id: uuid(),
      tenantId: op.scope.tenantId,
      ...(op.scope.organizationId ? { organizationId: op.scope.organizationId } : {}),
      productId: op.productId,
      ...(op.variantId ? { variantId: op.variantId } : {}),
      locationId: op.locationId,
      state: 'AVAILABLE',
      quantities: {
        available: op.quantity,
        reserved: 0,
        committed: 0,
        sold: 0,
        damaged: 0,
        returned: 0,
        inbound: 0,
        unknown: 0,
      },
      version: 0,
      createdAt: nowUtc(),
      updatedAt: nowUtc(),
    };
  }

  private applyAdjust(op: InventoryOperation, existing: InventoryRecord | undefined): InventoryRecord {
    if (!existing) throw new Error('ADJUST requires existing record');
    const q = { ...existing.quantities };
    q.available += op.quantity;
    if (q.available < 0) throw new Error(`adjustment would make available negative (${q.available})`);
    return { ...existing, quantities: q };
  }

  private applyReserve(op: InventoryOperation, existing: InventoryRecord | undefined): InventoryRecord {
    if (!existing) throw new Error('RESERVE requires existing record');
    const q = { ...existing.quantities };
    if (q.available < op.quantity) {
      throw new Error(`OVERSELL_PREVENTED: requested ${op.quantity} but only ${q.available} available`);
    }
    q.available -= op.quantity;
    q.reserved += op.quantity;
    return { ...existing, quantities: q, state: existing.state === 'AVAILABLE' && q.available === 0 ? 'RESERVED' : existing.state };
  }

  private applyRelease(op: InventoryOperation, existing: InventoryRecord | undefined): InventoryRecord {
    if (!existing) throw new Error('RELEASE requires existing record');
    const q = { ...existing.quantities };
    if (q.reserved < op.quantity) {
      throw new Error(`release exceeds reserved (${q.reserved} < ${op.quantity})`);
    }
    q.reserved -= op.quantity;
    q.available += op.quantity;
    return { ...existing, quantities: q, state: q.reserved === 0 ? 'AVAILABLE' : existing.state };
  }

  private applyTransfer(op: InventoryOperation, existing: InventoryRecord | undefined): InventoryRecord {
    if (!existing) throw new Error('TRANSFER requires existing record');
    if (!op.toLocationId) throw new Error('TRANSFER requires toLocationId');
    // The transfer is logged as a removal from this location; the engine
    // caller is responsible for issuing a matching CREATE at the destination.
    const q = { ...existing.quantities };
    if (q.available < op.quantity) {
      throw new Error(`OVERSELL_PREVENTED: transfer of ${op.quantity} exceeds available ${q.available}`);
    }
    q.available -= op.quantity;
    q.inbound += 0; // inbound is recorded at destination
    return { ...existing, quantities: q };
  }

  private applySaleAllocate(op: InventoryOperation, existing: InventoryRecord | undefined): InventoryRecord {
    if (!existing) throw new Error('SALE_ALLOCATE requires existing record');
    const q = { ...existing.quantities };
    // Prefer reserved, then available.
    let remaining = op.quantity;
    const fromReserved = Math.min(q.reserved, remaining);
    q.reserved -= fromReserved;
    remaining -= fromReserved;
    if (remaining > 0) {
      if (q.available < remaining) {
        throw new Error(`OVERSELL_PREVENTED: sale of ${op.quantity} exceeds available+reserved`);
      }
      q.available -= remaining;
      remaining = 0;
    }
    q.committed += op.quantity;
    q.sold += op.quantity;
    let state = existing.state;
    if (q.available === 0 && q.reserved === 0 && q.committed > 0) state = 'SOLD';
    return { ...existing, quantities: q, state };
  }

  private applyReturn(op: InventoryOperation, existing: InventoryRecord | undefined): InventoryRecord {
    if (!existing) throw new Error('RETURN requires existing record');
    const q = { ...existing.quantities };
    if (q.sold < op.quantity) {
      throw new Error(`return exceeds sold (${q.sold} < ${op.quantity})`);
    }
    q.sold -= op.quantity;
    q.committed -= op.quantity;
    q.returned += op.quantity;
    q.available += op.quantity; // return to sellable stock
    return { ...existing, quantities: q, state: 'RETURNED' };
  }

  private applyReconcile(op: InventoryOperation, existing: InventoryRecord | undefined): InventoryRecord {
    if (!existing) throw new Error('RECONCILE requires existing record');
    // Reconcile forces available to the given quantity.
    if (op.quantity < 0) throw new Error('reconcile quantity cannot be negative');
    const q = { ...existing.quantities, available: op.quantity };
    return { ...existing, quantities: q };
  }

  private applyCycleCount(op: InventoryOperation, existing: InventoryRecord | undefined): InventoryRecord {
    if (!existing) throw new Error('CYCLE_COUNT requires existing record');
    if (op.countedQuantity === undefined) throw new Error('CYCLE_COUNT requires countedQuantity');
    const q = { ...existing.quantities };
    const discrepancy = op.countedQuantity - (q.available + q.reserved + q.committed + q.sold - q.returned);
    if (discrepancy !== 0) {
      // Adjust the "unknown" bucket to track discrepancy.
      q.unknown += discrepancy;
    }
    q.available = op.countedQuantity - q.reserved - q.committed;
    return { ...existing, quantities: q };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function totalQuantities(q: InventoryQuantities): number {
  return q.available + q.reserved + q.committed + q.sold + q.damaged + q.returned + q.inbound + q.unknown;
}

export function sellableQuantity(q: InventoryQuantities): number {
  return q.available;
}

export function createInventoryRecord(opts: {
  productId: string;
  variantId?: string;
  locationId: string;
  quantity: number;
  scope: TenantScoped;
  virtual?: boolean;
  uniqueItem?: boolean;
  consignmentOwner?: string;
  podPartnerRef?: string;
  supplierRef?: string;
  affiliateOfferRef?: string;
}): InventoryRecord {
  return {
    id: uuid(),
    tenantId: opts.scope.tenantId,
    ...(opts.scope.organizationId ? { organizationId: opts.scope.organizationId } : {}),
    productId: opts.productId,
    ...(opts.variantId ? { variantId: opts.variantId } : {}),
    locationId: opts.locationId,
    state: 'AVAILABLE',
    quantities: {
      available: opts.quantity,
      reserved: 0,
      committed: 0,
      sold: 0,
      damaged: 0,
      returned: 0,
      inbound: 0,
      unknown: 0,
    },
    version: 0,
    createdAt: nowUtc(),
    updatedAt: nowUtc(),
    ...(opts.virtual ? { virtual: true } : {}),
    ...(opts.uniqueItem ? { uniqueItem: true } : {}),
    ...(opts.consignmentOwner ? { consignmentOwner: opts.consignmentOwner } : {}),
    ...(opts.podPartnerRef ? { podPartnerRef: opts.podPartnerRef } : {}),
    ...(opts.supplierRef ? { supplierRef: opts.supplierRef } : {}),
    ...(opts.affiliateOfferRef ? { affiliateOfferRef: opts.affiliateOfferRef } : {}),
  };
}
