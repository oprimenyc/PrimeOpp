// Canonical Inventory model.
import type { Identifier, ISO8601, TenantId, Money } from './common.js';

export type InventoryKind =
  | 'physical'
  | 'serialized'
  | 'lot'
  | 'bundle'
  | 'virtual_pod'
  | 'dropship'
  | 'consignment';

export type InventoryAllocationState =
  | 'available'
  | 'reserved'
  | 'allocated'
  | 'sold'
  | 'returned'
  | 'damaged'
  | 'lost'
  | 'in_transit'
  | 'quarantined';

export interface InventoryLocation {
  readonly locationId: Identifier;
  readonly warehouseId?: Identifier;
  readonly name: string;
  readonly region: string;
}

export interface InventoryRecord {
  readonly inventoryId: Identifier;
  readonly tenantId: TenantId;
  readonly organizationId: Identifier;
  readonly productId: Identifier;
  readonly sku: string;
  readonly kind: InventoryKind;
  readonly quantityTotal: number;
  readonly quantityAvailable: number;
  readonly quantityReserved: number;
  readonly quantityAllocated: number;
  readonly quantitySold: number;
  readonly quantityDamaged: number;
  readonly location: InventoryLocation;
  readonly serialNumbers?: readonly string[];
  readonly lotId?: Identifier;
  readonly bundleComponents?: ReadonlyArray<{ readonly productId: Identifier; readonly quantity: number }>;
  readonly supplierRef?: Identifier; // for POD / dropship
  readonly consignmentAgreementId?: Identifier;
  readonly unitCost?: Money;
  readonly createdAt: ISO8601;
  readonly updatedAt: ISO8601;
}

export interface InventoryReservation {
  readonly reservationId: Identifier;
  readonly inventoryId: Identifier;
  readonly tenantId: TenantId;
  readonly quantity: number;
  readonly reservedFor: 'offer' | 'order' | 'preview' | 'hold';
  readonly referenceId: Identifier; // offerId or orderId
  readonly reservedAt: ISO8601;
  readonly expiresAt: ISO8601;
  readonly releasedAt?: ISO8601;
}

export interface InventoryAllocation {
  readonly allocationId: Identifier;
  readonly inventoryId: Identifier;
  readonly orderId: Identifier;
  readonly tenantId: TenantId;
  readonly quantity: number;
  readonly allocatedAt: ISO8601;
  readonly serialNumbers?: readonly string[];
}

export interface InventoryLock {
  readonly lockId: Identifier;
  readonly inventoryId: Identifier;
  readonly tenantId: TenantId;
  readonly holder: string;
  readonly acquiredAt: ISO8601;
  readonly expiresAt: ISO8601;
  readonly releasedAt?: ISO8601;
}

export interface InventoryChannelSync {
  readonly syncId: Identifier;
  readonly inventoryId: Identifier;
  readonly channelId: string;
  readonly channelListingId: string;
  readonly channelQuantity: number;
  readonly lastSyncedAt: ISO8601;
  readonly syncState: 'in_sync' | 'pending' | 'conflict' | 'error';
}

export interface OversellPreventionEvidence {
  readonly evidenceId: Identifier;
  readonly inventoryId: Identifier;
  readonly competingOrders: ReadonlyArray<{ readonly orderId: Identifier; readonly channelId: string }>;
  readonly winnerOrderId: Identifier;
  readonly loserOrderIds: readonly Identifier[];
  readonly reason: string;
  readonly timestamp: ISO8601;
}
