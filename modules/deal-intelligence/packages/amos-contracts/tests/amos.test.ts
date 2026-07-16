import { describe, it, expect } from 'vitest';
import { createAmosJob, computeProhibitedClaims, ALL_AMOS_JOB_KINDS } from '../src/index.js';

describe('amos-contracts', () => {
  it('createAmosJob requires verifiedFacts', () => {
    expect(() => createAmosJob({
      kind: 'daily-top-deals', title: 'X', hook: 'H', verifiedFacts: [],
      sourceReferences: [], affiliateLinks: [], disclosures: [], thumbnailConcepts: [],
      shortFormScript: '', longFormOutline: [], blogOutline: [], socialCaptions: [],
      evidenceConfidence: 0.5
    })).toThrow();
  });
  it('createAmosJob adds default disclosure if none provided', () => {
    const j = createAmosJob({
      kind: 'daily-top-deals', title: 'X', hook: 'H', verifiedFacts: ['fact 1'],
      sourceReferences: [], affiliateLinks: [], disclosures: [], thumbnailConcepts: [],
      shortFormScript: '', longFormOutline: [], blogOutline: [], socialCaptions: [],
      evidenceConfidence: 0.5
    });
    expect(j.disclosures.length).toBeGreaterThan(0);
    expect(j.disclosures[0]).toMatch(/affiliate/i);
  });
  it('prohibits unverified "lowest ever" claims', () => {
    const prohibited = computeProhibitedClaims(['lowest price ever!']);
    expect(prohibited.some(p => p.includes('Specifically do not assert'))).toBe(true);
  });
  it('correctionRequirements always populated', () => {
    const j = createAmosJob({
      kind: 'restock-alert', title: 'X', hook: 'H', verifiedFacts: ['f'],
      sourceReferences: [], affiliateLinks: [], disclosures: [], thumbnailConcepts: [],
      shortFormScript: '', longFormOutline: [], blogOutline: [], socialCaptions: [],
      evidenceConfidence: 0.5
    });
    expect(j.correctionRequirements.length).toBeGreaterThanOrEqual(3);
  });
  it('ALL_AMOS_JOB_KINDS has 12 kinds', () => {
    expect(ALL_AMOS_JOB_KINDS).toHaveLength(12);
  });
});
