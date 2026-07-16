// Print-on-Demand and Dropshipping contracts.
import type { Identifier, TenantId, ISO8601, Money, EvidenceRecord } from './common.js';

export interface PODProduct {
  readonly podProductId: Identifier;
  readonly tenantId: TenantId;
  readonly organizationId: Identifier;
  readonly baseProductId: Identifier;
  readonly supplierRef: Identifier;
  readonly productionCost: Money;
  readonly sellerMargin: Money;
  readonly artworkRef?: Identifier;
  readonly variantMapping: Readonly<Record<string, string>>;
  readonly fulfillmentEstimateDays: number;
  readonly productionStatus: 'pending' | 'in_production' | 'produced' | 'shipped' | 'failed';
  readonly returnConstraints: 'no_returns' | 'defect_only' | 'standard';
  readonly evidence: readonly EvidenceRecord[];
  readonly createdAt: ISO8601;
}

export interface DropshipProduct {
  readonly dropshipProductId: Identifier;
  readonly tenantId: TenantId;
  readonly organizationId: Identifier;
  readonly supplierRef: Identifier;
  readonly supplierProductId: string;
  readonly supplierStock: number | 'unknown';
  readonly supplierCost: Money;
  readonly shippingEstimateDays: number;
  readonly staleStockRiskScore: number; // 0..1
  readonly supplierOrderRef?: Identifier;
  readonly fulfillmentStatus: 'pending' | 'ordered_from_supplier' | 'shipped_by_supplier' | 'delivered' | 'cancelled' | 'failed';
  readonly cancellationRisk: number; // 0..1
  readonly evidence: readonly EvidenceRecord[];
  readonly lastSyncedAt: ISO8601;
  readonly createdAt: ISO8601;
}

export interface SupplierStockAssertion {
  readonly assertionId: Identifier;
  readonly supplierRef: Identifier;
  readonly supplierProductId: string;
  readonly claimedStock: number | 'unknown';
  readonly assertedAt: ISO8601;
  readonly confidence: number; // 0..1
  readonly source: 'api' | 'feed' | 'browser_scrape' | 'manual';
  readonly evidence: readonly EvidenceRecord[];
}
