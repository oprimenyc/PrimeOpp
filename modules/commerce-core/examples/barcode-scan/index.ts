// Example A — Barcode Scan workflow.
// Run with: node examples/barcode-scan/index.ts

import { validateBarcode, toBarcodePayload, createScanEvent, createScanSession, appendScanEvent, createTestBarcodeAdapter } from '@primeopp/barcode';

async function main() {
  console.log('=== Workflow A: Barcode Scan ===');

  // 1. Scan a barcode
  const raw = '036000291452';
  const session = createScanSession('demo-tenant');
  const event = createScanEvent({
    tenantId: 'demo-tenant',
    sessionId: session.id,
    source: 'USB_SCANNER',
    rawValue: raw,
    confidence: 0.95,
  });
  const session2 = appendScanEvent(session, event);
  console.log(`Scanned: ${raw}`);
  console.log(`Payload: format=${event.payload?.format} valid=${event.payload?.checkDigitValid}`);

  // 2. Validate
  const validation = validateBarcode(raw);
  console.log(`Validation: valid=${validation.valid} format=${validation.format}`);

  // 3. Resolve via local adapter
  const adapter = createTestBarcodeAdapter([
    { payload: toBarcodePayload(raw), productId: 'p1', confidence: 0.99, source: 'fixture' },
  ]);
  const lookup = await adapter.lookup(toBarcodePayload(raw), { tenantId: 'demo-tenant' });
  console.log(`Lookup: matched=${lookup.matched} candidates=${lookup.candidates.length} collision=${lookup.collision}`);

  // 4. Produce evidence
  console.log(`Evidence: scanEventId=${event.id} sessionId=${session2.id} observedAt=${event.observedAt}`);
}

main().catch(console.error);
