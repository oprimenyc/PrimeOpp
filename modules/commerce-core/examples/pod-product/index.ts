// Example G — POD Product workflow.
import { createSdk } from '@primeopp/sdk';
import type { Product } from '@primeopp/contracts';
import { nowUtc, uuid } from '@primeopp/contracts';

async function main() {
  console.log('=== Workflow G: POD Product ===');
  const sdk = createSdk({ tenantId: 'demo' });

  // Create a POD product
  const product: Product = {
    id: uuid(),
    schemaVersion: '1.0.0',
    kind: 'POD',
    title: 'Custom T-Shirt',
    attributes: [
      { axis: 'COLOR', value: 'Black', source: 'spec', confidence: 1.0 },
      { axis: 'SIZE', value: 'M', source: 'spec', confidence: 1.0 },
    ],
    identifiers: [{ type: 'SKU', value: 'POD-TSHIRT-BLK-M', source: 'manual', verification: 'HUMAN_CONFIRMED', confidence: 1.0, observedAt: nowUtc() }],
    variants: [],
    images: [],
    documents: [],
    source: { kind: 'MANUAL', ref: 'demo', observedAt: nowUtc(), confidence: 1.0 },
    provenance: { originSource: { kind: 'MANUAL', ref: 'demo', observedAt: nowUtc(), confidence: 1.0 }, observations: [], lineage: [] },
    ownership: { tenantId: 'demo', private: true },
    listingState: 'UNLISTED',
    fulfillmentMode: 'POD_FULFILLED',
    channelState: {},
    evidence: { evidenceRefs: [], confidence: 1.0 },
    confidence: { overall: 1.0, identity: 1.0, variant: 1.0, condition: 1.0, pricing: 0.8 },
    costBasis: {
      acquisitionMethod: 'MANUFACTURED_POD',
      purchasePrice: { label: 'production cost', amount: 8, currency: 'USD', status: 'ESTIMATED' },
      perUnitCostBasis: 8,
      currency: 'USD',
      evidenceRefs: [],
      hasEstimated: true,
    },
    locations: [{ id: 'loc-pod-printify', kind: 'VIRTUAL', label: 'Printify', virtualRef: 'printify', tenantId: 'demo' }],
    version: 0,
    tenantId: 'demo',
    createdAt: nowUtc(),
    updatedAt: nowUtc(),
  };
  await sdk.createProduct(product, 'demo-user');
  console.log(`Created POD product: ${product.id}`);

  // Create virtual inventory
  await sdk.inventoryOp({
    kind: 'CREATE',
    productId: product.id,
    locationId: 'loc-pod-printify',
    quantity: 1000,
    idempotencyKey: 'pod-create-1',
    scope: sdk.scope,
  });
  console.log('Created 1000 units of virtual POD inventory');

  // Price with MAX_MARGIN strategy
  const priced = sdk.priceProduct({
    productId: product.id,
    condition: 'NEW',
    activeComps: [],
    soldComps: [],
    strategy: 'MAX_MARGIN',
    customListingPrice: { amount: 25, currency: 'USD', precise: true, status: 'USER_ENTERED' },
    scope: sdk.scope,
  });
  console.log(`Recommended list: ${priced.recommendedListPrice.amount} USD (user-set)`);

  // Profit
  const profit = sdk.calculateProfit({
    productId: product.id,
    listingPrice: { amount: 25, currency: 'USD', precise: true, status: 'USER_ENTERED' },
    costBasis: { amount: 8, currency: 'USD', precise: false, status: 'ESTIMATED' },
    inboundCost: { amount: 0, currency: 'USD', precise: true, status: 'ACTUAL' },
    taxTreatment: 'EXCLUDED',
    scope: sdk.scope,
  });
  console.log(`Net profit: ${profit.netProfit.amount} USD; ROI: ${(profit.roi * 100).toFixed(1)}%`);
}

main().catch(console.error);
