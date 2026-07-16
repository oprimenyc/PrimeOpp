// Example H — Dropship Product workflow.
import { createSdk } from '@primeopp/sdk';
import type { Product } from '@primeopp/contracts';
import { nowUtc, uuid } from '@primeopp/contracts';

async function main() {
  console.log('=== Workflow H: Dropship Product ===');
  const sdk = createSdk({ tenantId: 'demo' });

  const product: Product = {
    id: uuid(),
    schemaVersion: '1.0.0',
    kind: 'DROPSHIP',
    title: 'Dropship Widget',
    attributes: [],
    identifiers: [{ type: 'SKU', value: 'DROP-WIDGET-1', source: 'supplier', verification: 'PROVIDER_VERIFIED', confidence: 0.9, observedAt: nowUtc() }],
    variants: [],
    images: [],
    documents: [],
    source: { kind: 'IMPORT', ref: 'supplier-feed', observedAt: nowUtc(), confidence: 0.9 },
    provenance: { originSource: { kind: 'IMPORT', ref: 'supplier-feed', observedAt: nowUtc(), confidence: 0.9 }, observations: [], lineage: [] },
    ownership: { tenantId: 'demo', private: true },
    listingState: 'UNLISTED',
    fulfillmentMode: 'SUPPLIER_FULFILLED',
    channelState: {},
    evidence: { evidenceRefs: [], confidence: 0.9 },
    confidence: { overall: 0.9, identity: 0.9, variant: 0.9, condition: 1.0, pricing: 0.7 },
    locations: [{ id: 'loc-supplier', kind: 'VIRTUAL', label: 'Supplier Warehouse', virtualRef: 'supplier-123', tenantId: 'demo' }],
    version: 0,
    tenantId: 'demo',
    createdAt: nowUtc(),
    updatedAt: nowUtc(),
  };
  await sdk.createProduct(product, 'demo-user');
  console.log(`Created dropship product: ${product.id}`);

  // Virtual inventory at supplier
  const inv = await sdk.inventoryOp({
    kind: 'CREATE',
    productId: product.id,
    locationId: 'loc-supplier',
    quantity: 50,
    idempotencyKey: 'drop-1',
    scope: sdk.scope,
  });
  console.log(`Created ${inv.record?.quantities.available} units of dropship virtual inventory`);

  // Stale-data warning: simulate by setting updatedAt to old date
  // (In production, the catalog's detectStaleProducts would flag this.)

  // Order risk classification
  const fees = sdk.assessFees({ marketplaceRef: 'primeopp-marketplace', basis: { amount: 100, currency: 'USD', precise: false, status: 'AUTHORITATIVE' } });
  const profit = sdk.calculateProfit({
    productId: product.id,
    listingPrice: { amount: 100, currency: 'USD', precise: true, status: 'ACTUAL' },
    costBasis: { amount: 60, currency: 'USD', precise: false, status: 'ESTIMATED' },
    inboundCost: { amount: 0, currency: 'USD', precise: true, status: 'ACTUAL' },
    feeAssessment: fees,
    taxTreatment: 'EXCLUDED',
    scope: sdk.scope,
  });
  console.log(`Net profit: ${profit.netProfit.amount} USD; warnings: ${profit.warnings.join('; ')}`);
}

main().catch(console.error);
