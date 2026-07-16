import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectFormat,
  validateBarcode,
  toBarcodePayload,
  computeUpcACheckDigit,
  computeEanCheckDigit,
  computeIsbn10CheckDigit,
  computeIsbn13CheckDigit,
  createScanEvent,
  createScanSession,
  appendScanEvent,
  endScanSession,
  createOfflineScanQueue,
  enqueueOfflineScan,
  flushOfflineScanQueue,
  createTestBarcodeAdapter,
  expandUpcE,
} from '../src/index.ts';

test('detectFormat identifies EAN_13', () => {
  assert.equal(detectFormat('4006381333931'), 'EAN_13');
});

test('detectFormat identifies UPC_A', () => {
  assert.equal(detectFormat('036000291452'), 'UPC_A');
});

test('detectFormat identifies ISBN_13', () => {
  assert.equal(detectFormat('9783161484100'), 'ISBN_13');
});

test('computeUpcACheckDigit for 03600029145', () => {
  // Known: UPC-A 036000291452 has check digit 2.
  assert.equal(computeUpcACheckDigit('03600029145'), 2);
});

test('validateBarcode accepts valid UPC-A', () => {
  const r = validateBarcode('036000291452');
  assert.equal(r.valid, true);
  assert.equal(r.checkDigitValid, true);
  assert.equal(r.format, 'UPC_A');
});

test('validateBarcode rejects invalid check digit', () => {
  const r = validateBarcode('036000291453'); // last digit wrong
  assert.equal(r.checkDigitValid, false);
  assert.equal(r.valid, false);
});

test('validateBarcode accepts valid EAN-13', () => {
  const r = validateBarcode('4006381333931');
  assert.equal(r.valid, true);
});

test('validateBarcode accepts valid ISBN-10', () => {
  // ISBN-10: 0-306-40615-2
  const r = validateBarcode('0306406152', 'ISBN_10');
  assert.equal(r.valid, true);
  assert.equal(r.checkDigitValid, true);
});

test('computeIsbn10CheckDigit for 030640615', () => {
  assert.equal(computeIsbn10CheckDigit('030640615'), '2');
});

test('validateBarcode accepts valid ISBN-13', () => {
  const r = validateBarcode('9783161484100', 'ISBN_13');
  assert.equal(r.valid, true);
});

test('computeIsbn13CheckDigit for 978316148410', () => {
  assert.equal(computeIsbn13CheckDigit('978316148410'), 0);
});

test('validateBarcode rejects too-short UPC-A', () => {
  const r = validateBarcode('12345', 'UPC_A');
  assert.equal(r.valid, false);
});

test('validateBarcode accepts CODE_128 with any ASCII', () => {
  const r = validateBarcode('ABC123XYZ', 'CODE_128');
  assert.equal(r.valid, true);
});

test('validateBarcode CUSTOM rejects over-long value', () => {
  const long = 'x'.repeat(300);
  const r = validateBarcode(long, 'CUSTOM');
  assert.equal(r.valid, false);
});

test('toBarcodePayload builds payload', () => {
  const p = toBarcodePayload('036000291452');
  assert.equal(p.format, 'UPC_A');
  assert.equal(p.normalizedValue, '036000291452');
  assert.equal(p.checkDigitValid, true);
});

test('createScanEvent records CHECK_DIGIT_INVALID error', () => {
  const e = createScanEvent({
    tenantId: 't1',
    sessionId: 's1',
    source: 'IMAGE_UPLOAD',
    rawValue: '036000291453', // invalid check digit
    confidence: 0.9,
  });
  if (!e.payload) throw new Error('payload missing');
  assert.equal(e.payload.checkDigitValid, false);
  assert.equal(e.error?.code, 'CHECK_DIGIT_INVALID');
});

test('createScanEvent captures manual correction', () => {
  const e = createScanEvent({
    tenantId: 't1',
    sessionId: 's1',
    source: 'MANUAL_ENTRY',
    rawValue: '036000291452',
    confidence: 0.9,
    manuallyCorrected: true,
    originalRawValue: '036000291453',
  });
  assert.equal(e.manuallyCorrected, true);
  assert.equal(e.originalRawValue, '036000291453');
});

test('scan session lifecycle', () => {
  const s = createScanSession('t1');
  const e = createScanEvent({
    tenantId: 't1',
    sessionId: s.id,
    source: 'USB_SCANNER',
    rawValue: '036000291452',
    confidence: 0.95,
  });
  const s2 = appendScanEvent(s, e);
  assert.equal(s2.events.length, 1);
  const s3 = endScanSession(s2);
  assert.ok(s3.endedAt);
});

test('scan session rejects cross-tenant event', () => {
  const s = createScanSession('t1');
  const e = createScanEvent({
    tenantId: 't2',
    sessionId: s.id,
    source: 'USB_SCANNER',
    rawValue: '036000291452',
    confidence: 0.95,
  });
  assert.throws(() => appendScanEvent(s, e), /TENANT_MISMATCH/);
});

test('offline scan queue accepts and flushes', () => {
  const q = createOfflineScanQueue('t1', 3);
  const e1 = createScanEvent({ tenantId: 't1', sessionId: 's', source: 'USB_SCANNER', rawValue: '036000291452', confidence: 0.9 });
  const e2 = createScanEvent({ tenantId: 't1', sessionId: 's', source: 'USB_SCANNER', rawValue: '036000291452', confidence: 0.9 });
  const q2 = enqueueOfflineScan(q, e1);
  const q3 = enqueueOfflineScan(q2, e2);
  assert.equal(q3.pending.length, 2);
  const { flushed, remaining } = flushOfflineScanQueue(q3);
  assert.equal(flushed.length, 2);
  assert.equal(remaining.pending.length, 0);
});

test('offline scan queue drops oldest on overflow', () => {
  const q = createOfflineScanQueue('t1', 2);
  const e1 = createScanEvent({ tenantId: 't1', sessionId: 's', source: 'USB_SCANNER', rawValue: '036000291452', confidence: 0.9 });
  const e2 = createScanEvent({ tenantId: 't1', sessionId: 's', source: 'USB_SCANNER', rawValue: '036000291452', confidence: 0.9 });
  const e3 = createScanEvent({ tenantId: 't1', sessionId: 's', source: 'USB_SCANNER', rawValue: '036000291452', confidence: 0.9 });
  let qq = enqueueOfflineScan(q, e1);
  qq = enqueueOfflineScan(qq, e2);
  qq = enqueueOfflineScan(qq, e3);
  assert.equal(qq.pending.length, 2);
  // e1 should have been dropped.
  assert.equal(qq.pending[0].id, e2.id);
  assert.equal(qq.pending[1].id, e3.id);
});

test('local barcode lookup adapter returns match', async () => {
  const adapter = createTestBarcodeAdapter([
    {
      payload: toBarcodePayload('036000291452'),
      productId: 'p1',
      confidence: 0.99,
      source: 'test-fixture',
    },
  ]);
  const r = await adapter.lookup(toBarcodePayload('036000291452'), { tenantId: 't1' });
  assert.equal(r.matched, true);
  assert.equal(r.collision, false);
  assert.equal(r.candidates[0].productId, 'p1');
});

test('local barcode lookup adapter detects collision', async () => {
  const adapter = createTestBarcodeAdapter([
    { payload: toBarcodePayload('036000291452'), productId: 'p1', confidence: 0.5, source: 'a' },
    { payload: toBarcodePayload('036000291452'), productId: 'p2', confidence: 0.5, source: 'b' },
  ]);
  const r = await adapter.lookup(toBarcodePayload('036000291452'), { tenantId: 't1' });
  assert.equal(r.matched, true);
  assert.equal(r.collision, true);
  assert.equal(r.candidates.length, 2);
});

test('expandUpcE returns null for invalid input', () => {
  assert.equal(expandUpcE('notvalid'), null);
  assert.equal(expandUpcE('123456'), null); // 6-digit not supported without check digit
});
