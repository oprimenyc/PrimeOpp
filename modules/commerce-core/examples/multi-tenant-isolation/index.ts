// Example K — Cross-Tenant Attack workflow.
import { createSdk } from '@primeopp/sdk';
import { buildEvidenceRecord, assertEvidenceTenantAccess } from '@primeopp/evidence';

async function main() {
  console.log('=== Workflow K: Cross-Tenant Attack ===');
  const sdkA = createSdk({ tenantId: 'tenant-a' });
  const sdkB = createSdk({ tenantId: 'tenant-b' });

  // Tenant A creates inventory
  await sdkA.inventoryOp({ kind: 'CREATE', productId: 'p1', locationId: 'l1', quantity: 10, idempotencyKey: 'k-1', scope: sdkA.scope });

  // Tenant B tries to read A's inventory — should be denied
  const cross = await sdkB.inventoryStorage.get('tenant-a', 'p1', undefined, 'l1');
  console.log(`Tenant B reads Tenant A's inventory: ${cross === undefined ? 'DENIED (isolated)' : 'LEAKED!'}`);

  // Tenant B tries to access A's evidence — should throw
  const evidence = buildEvidenceRecord({ tenantId: 'tenant-a', kind: 'SCAN', content: 'secret' });
  try {
    assertEvidenceTenantAccess(evidence, { tenantId: 'tenant-b' });
    console.log('Evidence access: ALLOWED (BUG!)');
  } catch (e) {
    console.log(`Evidence access: DENIED (${(e as Error).message})`);
  }
}

main().catch(console.error);
