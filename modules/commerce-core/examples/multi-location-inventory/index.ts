// Example J — Enterprise Multi-Location Inventory workflow.
import { createSdk } from '@primeopp/sdk';

async function main() {
  console.log('=== Workflow J: Multi-Location Inventory ===');
  const sdk = createSdk({ tenantId: 'enterprise-demo', organizationId: 'org-1' });

  // Create inventory at warehouse A
  await sdk.inventoryOp({ kind: 'CREATE', productId: 'p1', locationId: 'warehouse-a', quantity: 100, idempotencyKey: 'j-1', scope: sdk.scope });
  // Create inventory at warehouse B
  await sdk.inventoryOp({ kind: 'CREATE', productId: 'p1', locationId: 'warehouse-b', quantity: 50, idempotencyKey: 'j-2', scope: sdk.scope });

  const a = await sdk.inventoryStorage.get('enterprise-demo', 'p1', undefined, 'warehouse-a');
  const b = await sdk.inventoryStorage.get('enterprise-demo', 'p1', undefined, 'warehouse-b');
  console.log(`Warehouse A: ${a?.quantities.available} units`);
  console.log(`Warehouse B: ${b?.quantities.available} units`);

  // Transfer 20 units from A to B
  await sdk.inventoryOp({ kind: 'TRANSFER', productId: 'p1', locationId: 'warehouse-a', toLocationId: 'warehouse-b', quantity: 20, idempotencyKey: 'j-3', scope: sdk.scope });
  await sdk.inventoryOp({ kind: 'ADJUST', productId: 'p1', locationId: 'warehouse-b', quantity: 20, idempotencyKey: 'j-4', scope: sdk.scope });

  const a2 = await sdk.inventoryStorage.get('enterprise-demo', 'p1', undefined, 'warehouse-a');
  const b2 = await sdk.inventoryStorage.get('enterprise-demo', 'p1', undefined, 'warehouse-b');
  console.log(`After transfer — Warehouse A: ${a2?.quantities.available}, Warehouse B: ${b2?.quantities.available}`);
}

main().catch(console.error);
