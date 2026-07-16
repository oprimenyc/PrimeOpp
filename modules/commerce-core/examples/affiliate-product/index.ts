// Example I — Affiliate Product workflow.
import { createSdk } from '@primeopp/sdk';
import type { Product } from '@primeopp/contracts';
import { nowUtc, uuid } from '@primeopp/contracts';

async function main() {
  console.log('=== Workflow I: Affiliate Product ===');
  const sdk = createSdk({ tenantId: 'demo' });

  const product: Product = {
    id: uuid(),
    schemaVersion: '1.0.0',
    kind: 'AFFILIATE',
    title: 'Affiliate Offered Widget',
    attributes: [],
    identifiers: [{ type: 'CUSTOM_SELLER_ID', value: 'AFF-001', source: 'affiliate-network', verification: 'PROVIDER_VERIFIED', confidence: 0.95, observedAt: nowUtc() }],
    variants: [],
    images: [],
    documents: [],
    source: { kind: 'IMPORT', ref: 'affiliate-feed', observedAt: nowUtc(), confidence: 0.9 },
    provenance: { originSource: { kind: 'IMPORT', ref: 'affiliate-feed', observedAt: nowUtc(), confidence: 0.9 }, observations: [], lineage: [] },
    ownership: { tenantId: 'demo', private: true },
    listingState: 'UNLISTED',
    fulfillmentMode: 'NO_FULFILLMENT',
    channelState: {},
    evidence: { evidenceRefs: [], confidence: 0.9 },
    confidence: { overall: 0.9, identity: 0.95, variant: 0.9, condition: 1.0, pricing: 0.8 },
    version: 0,
    tenantId: 'demo',
    createdAt: nowUtc(),
    updatedAt: nowUtc(),
  };
  await sdk.createProduct(product, 'demo-user');
  console.log(`Created affiliate product: ${product.id}`);

  // Affiliate inventory: zero owned, just an offer ref
  await sdk.inventoryOp({
    kind: 'CREATE',
    productId: product.id,
    locationId: 'loc-affiliate',
    quantity: 0,
    idempotencyKey: 'aff-1',
    scope: sdk.scope,
  });
  console.log('Created 0-unit affiliate inventory (no ownership)');

  // Commission estimate (treat as profit)
  const commission = 10; // 10% commission on $100 = $10
  console.log(`Estimated commission on $100 sale: $${commission}`);
}

main().catch(console.error);
