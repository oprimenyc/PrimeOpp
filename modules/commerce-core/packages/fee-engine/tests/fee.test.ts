import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFeeSchedule, findApplicableEntry, assessFees, isEntryStale, defaultPrimeOppMarketplaceFeeSchedule, computeFeeLineItem } from '../src/index.ts';

test('buildFeeSchedule marks stale when any entry is past effectiveTo', () => {
  const s = buildFeeSchedule({
    marketplaceRef: 'mp1',
    version: '1.0.0',
    entries: [
      { type: 'MARKETPLACE_COMMISSION', model: 'PERCENTAGE', rate: 0.1, currency: 'USD', effectiveFrom: '2020-01-01T00:00:00Z', effectiveTo: '2021-01-01T00:00:00Z', sourceRef: 'test' },
    ],
  });
  assert.equal(s.stale, true);
});

test('findApplicableEntry respects effective dates', () => {
  const s = buildFeeSchedule({
    marketplaceRef: 'mp1',
    version: '1.0.0',
    entries: [
      { type: 'MARKETPLACE_COMMISSION', model: 'PERCENTAGE', rate: 0.1, currency: 'USD', effectiveFrom: '2020-01-01T00:00:00Z', sourceRef: 'test' },
    ],
  });
  const entry = findApplicableEntry(s, 'MARKETPLACE_COMMISSION', { at: new Date('2025-01-01T00:00:00Z') });
  assert.ok(entry);
  assert.equal(entry?.rate, 0.1);
});

test('findApplicableEntry skips not-yet-effective entries', () => {
  const s = buildFeeSchedule({
    marketplaceRef: 'mp1',
    version: '1.0.0',
    entries: [
      { type: 'MARKETPLACE_COMMISSION', model: 'PERCENTAGE', rate: 0.1, currency: 'USD', effectiveFrom: '2030-01-01T00:00:00Z', sourceRef: 'test' },
    ],
  });
  const entry = findApplicableEntry(s, 'MARKETPLACE_COMMISSION', { at: new Date('2025-01-01T00:00:00Z') });
  assert.equal(entry, undefined);
});

test('computeFeeLineItem computes percentage', () => {
  const li = computeFeeLineItem(
    { type: 'MARKETPLACE_COMMISSION', model: 'PERCENTAGE', rate: 0.08, currency: 'USD', effectiveFrom: '2025-01-01T00:00:00Z', sourceRef: 't' },
    { amount: 100, currency: 'USD', precise: false, status: 'ESTIMATED' },
  );
  assert.equal(li.amount.amount, 8);
});

test('computeFeeLineItem computes fixed', () => {
  const li = computeFeeLineItem(
    { type: 'PAYMENT_PROCESSING', model: 'FIXED', rate: 0.30, currency: 'USD', effectiveFrom: '2025-01-01T00:00:00Z', sourceRef: 't' },
    { amount: 100, currency: 'USD', precise: false, status: 'ESTIMATED' },
  );
  assert.equal(li.amount.amount, 0.30);
});

test('computeFeeLineItem computes capped', () => {
  const li = computeFeeLineItem(
    { type: 'MARKETPLACE_COMMISSION', model: 'CAPPED', rate: 0.10, cap: 5, currency: 'USD', effectiveFrom: '2025-01-01T00:00:00Z', sourceRef: 't' },
    { amount: 100, currency: 'USD', precise: false, status: 'ESTIMATED' },
  );
  assert.equal(li.amount.amount, 5);
});

test('computeFeeLineItem computes minimum', () => {
  const li = computeFeeLineItem(
    { type: 'MARKETPLACE_COMMISSION', model: 'MINIMUM', rate: 0.01, minimum: 2, currency: 'USD', effectiveFrom: '2025-01-01T00:00:00Z', sourceRef: 't' },
    { amount: 100, currency: 'USD', precise: false, status: 'ESTIMATED' },
  );
  assert.equal(li.amount.amount, 2);
});

test('computeFeeLineItem marks stale entries as ESTIMATED', () => {
  const li = computeFeeLineItem(
    { type: 'MARKETPLACE_COMMISSION', model: 'PERCENTAGE', rate: 0.08, currency: 'USD', effectiveFrom: '2020-01-01T00:00:00Z', effectiveTo: '2021-01-01T00:00:00Z', sourceRef: 't' },
    { amount: 100, currency: 'USD', precise: false, status: 'ESTIMATED' },
  );
  assert.equal(li.stale, true);
  assert.equal(li.amount.status, 'ESTIMATED');
});

test('assessFees sums all applicable line items', () => {
  const s = defaultPrimeOppMarketplaceFeeSchedule();
  const a = assessFees({
    schedule: s,
    basis: { amount: 100, currency: 'USD', precise: false, status: 'AUTHORITATIVE' },
    scope: { tenantId: 't1' },
  });
  // 8% commission + 2.9% + 0.30 fixed = 8 + 2.90 + 0.30 = 11.20
  assert.equal(a.total.amount, 11.2);
});

test('isEntryStale returns true past effectiveTo', () => {
  const stale = isEntryStale({ type: 'MARKETPLACE_COMMISSION', model: 'PERCENTAGE', rate: 0.1, currency: 'USD', effectiveFrom: '2020-01-01T00:00:00Z', effectiveTo: '2021-01-01T00:00:00Z', sourceRef: 't' }, new Date('2025-01-01'));
  assert.equal(stale, true);
  const notStale = isEntryStale({ type: 'MARKETPLACE_COMMISSION', model: 'PERCENTAGE', rate: 0.1, currency: 'USD', effectiveFrom: '2020-01-01T00:00:00Z', sourceRef: 't' }, new Date('2025-01-01'));
  assert.equal(notStale, false);
});
