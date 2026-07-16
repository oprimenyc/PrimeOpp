import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessCondition, deriveCondition, mapMarketplaceCondition, toMarketplaceCondition, DEFAULT_GRADING_PROFILES, areConditionsComparable, createNewConditionAssessment } from '../src/index.ts';

test('deriveCondition returns default when no defects', () => {
  const c = deriveCondition([], DEFAULT_GRADING_PROFILES.ELECTRONICS);
  assert.equal(c, 'NEW_OPEN_BOX');
});

test('deriveCondition returns DAMAGED for CRITICAL defect', () => {
  const c = deriveCondition(['screen_crack'], DEFAULT_GRADING_PROFILES.ELECTRONICS);
  assert.equal(c, 'DAMAGED');
});

test('deriveCondition returns FAIR for HIGH defect', () => {
  const c = deriveCondition(['missing_charger'], DEFAULT_GRADING_PROFILES.ELECTRONICS); // LOW
  assert.equal(c, 'VERY_GOOD');
  const c2 = deriveCondition(['scratched_screen'], DEFAULT_GRADING_PROFILES.ELECTRONICS); // MEDIUM
  assert.equal(c2, 'GOOD');
});

test('mapMarketplaceCondition maps common aliases', () => {
  assert.equal(mapMarketplaceCondition('Brand New'), 'NEW');
  assert.equal(mapMarketplaceCondition('NWT'), 'NEW_WITH_TAGS');
  assert.equal(mapMarketplaceCondition('Mint'), 'LIKE_NEW');
  assert.equal(mapMarketplaceCondition('Used'), 'GOOD');
});

test('toMarketplaceCondition returns marketplace-specific label', () => {
  assert.equal(toMarketplaceCondition('NEW', 'ebay'), 'New');
  assert.equal(toMarketplaceCondition('NEW', 'amazon'), 'New');
  assert.equal(toMarketplaceCondition('NEW', 'goat'), 'New');
});

test('assessCondition never returns NEW from appearance alone', () => {
  const r = assessCondition({
    category: 'ELECTRONICS',
    observedDefects: [],
    missingAccessories: [],
    functionalStatus: 'UNTESTED',
    cosmeticStatus: 'PRISTINE',
    photoRefs: ['img1'],
    evidenceRefs: [],
    scope: { tenantId: 't1' },
  });
  assert.notEqual(r.assessment.condition, 'NEW');
  assert.ok(r.warnings.some((w) => w.includes('"NEW" requires explicit')));
});

test('assessCondition flags missing required dimensions', () => {
  const r = assessCondition({
    category: 'ELECTRONICS',
    observedDefects: [],
    missingAccessories: [],
    photoRefs: [],
    evidenceRefs: [],
    scope: { tenantId: 't1' },
  });
  assert.ok(r.missingDimensions.length > 0);
});

test('assessCondition flags missing authenticity for sneakers', () => {
  const r = assessCondition({
    category: 'SNEAKERS',
    observedDefects: [],
    missingAccessories: [],
    cosmeticStatus: 'PRISTINE',
    packagingCondition: 'ORIGINAL',
    photoRefs: ['img1'],
    evidenceRefs: [],
    scope: { tenantId: 't1' },
  });
  assert.equal(r.authenticityMissing, true);
});

test('assessCondition respects overrideCondition', () => {
  const r = assessCondition({
    category: 'ELECTRONICS',
    observedDefects: ['scratched_screen'],
    missingAccessories: [],
    functionalStatus: 'WORKING',
    cosmeticStatus: 'GOOD',
    packagingCondition: 'ORIGINAL',
    photoRefs: ['img1'],
    evidenceRefs: [],
    overrideCondition: 'LIKE_NEW',
    scope: { tenantId: 't1' },
  });
  assert.equal(r.assessment.condition, 'LIKE_NEW');
});

test('areConditionsComparable allows adjacent conditions', () => {
  assert.equal(areConditionsComparable('NEW', 'NEW_OPEN_BOX'), true);
  assert.equal(areConditionsComparable('NEW', 'DAMAGED'), false);
});

test('createNewConditionAssessment requires seal evidence', () => {
  const a = createNewConditionAssessment({
    packagingCondition: 'ORIGINAL_SEALED',
    sealEvidenceRef: 'evidence/seal/123',
    photoRefs: ['img1'],
    scope: { tenantId: 't1' },
  });
  assert.equal(a.condition, 'NEW');
  assert.equal(a.evidenceRefs[0], 'evidence/seal/123');
});

test('sneakers profile requires authenticity', () => {
  assert.equal(DEFAULT_GRADING_PROFILES.SNEAKERS.authenticityRequired, true);
});
