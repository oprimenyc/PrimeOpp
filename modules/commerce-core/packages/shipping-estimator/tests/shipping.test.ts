import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPackageSpec, dimensionalWeight, billableWeight, recommendPackageKind, estimateShipping, convertWeight, convertDimension, packagingCostEstimate, labelCostEstimate } from '../src/index.ts';

test('convertWeight converts LB to KG', () => {
  assert.ok(Math.abs(convertWeight(1, 'LB', 'KG') - 0.4536) < 0.001);
});

test('convertDimension converts IN to CM', () => {
  assert.ok(Math.abs(convertDimension(1, 'IN', 'CM') - 2.54) < 0.001);
});

test('dimensionalWeight computes volumetric weight', () => {
  const spec = buildPackageSpec({ weight: 1, weightUnit: 'LB', length: 12, width: 12, height: 12, dimensionUnit: 'IN' });
  // 12*12*12 = 1728 in^3 / 139 = ~12.43 lb
  const dw = dimensionalWeight(spec, 'LB');
  assert.ok(Math.abs(dw - 12.43) < 0.1);
});

test('billableWeight returns max of actual and dimensional', () => {
  const spec1 = buildPackageSpec({ weight: 1, weightUnit: 'LB', length: 12, width: 12, height: 12, dimensionUnit: 'IN' });
  const b1 = billableWeight(spec1);
  assert.ok(b1.weight > 1); // dim > actual
  const spec2 = buildPackageSpec({ weight: 20, weightUnit: 'LB', length: 4, width: 4, height: 4, dimensionUnit: 'IN' });
  const b2 = billableWeight(spec2);
  assert.ok(b2.weight >= 20); // actual > dim
});

test('recommendPackageKind returns FREIGHT for heavy items', () => {
  const spec = buildPackageSpec({ weight: 100, weightUnit: 'LB', length: 12, width: 12, height: 12, dimensionUnit: 'IN' });
  assert.equal(recommendPackageKind(spec), 'FREIGHT');
});

test('recommendPackageKind returns SMALL for small items', () => {
  const spec = buildPackageSpec({ weight: 1, weightUnit: 'LB', length: 6, width: 6, height: 6, dimensionUnit: 'IN' });
  assert.equal(recommendPackageKind(spec), 'SMALL');
});

test('estimateShipping produces range', () => {
  const spec = buildPackageSpec({ weight: 2, weightUnit: 'LB', length: 10, width: 8, height: 6, dimensionUnit: 'IN' });
  const est = estimateShipping({ packageSpec: spec, scope: { tenantId: 't1' } });
  assert.ok(est.estimatedRange.low.amount <= est.estimatedRange.midpoint.amount);
  assert.ok(est.estimatedRange.high.amount >= est.estimatedRange.midpoint.amount);
  assert.ok(est.confidence > 0);
});

test('estimateShipping warns when zones are missing', () => {
  const spec = buildPackageSpec({ weight: 2, weightUnit: 'LB', length: 10, width: 8, height: 6, dimensionUnit: 'IN' });
  const est = estimateShipping({ packageSpec: spec, scope: { tenantId: 't1' } });
  assert.ok(est.missingDataWarnings.some((w) => w.includes('originZone')));
  assert.ok(est.missingDataWarnings.some((w) => w.includes('destinationZone')));
});

test('packagingCostEstimate varies by package kind', () => {
  assert.equal(packagingCostEstimate('SMALL').amount, 0.5);
  assert.equal(packagingCostEstimate('FREIGHT').amount, 15.0);
});

test('labelCostEstimate varies by carrier class', () => {
  assert.equal(labelCostEstimate('ECONOMY').amount, 0.25);
  assert.equal(labelCostEstimate('EXPEDITED').amount, 0.65);
});

test('estimateShipping increases with hazardous flag', () => {
  const spec = buildPackageSpec({ weight: 2, weightUnit: 'LB', length: 10, width: 8, height: 6, dimensionUnit: 'IN' });
  const normal = estimateShipping({ packageSpec: spec, scope: { tenantId: 't1' } });
  const haz = estimateShipping({ packageSpec: spec, hazardous: true, scope: { tenantId: 't1' } });
  assert.ok(haz.estimatedRange.midpoint.amount > normal.estimatedRange.midpoint.amount);
});
