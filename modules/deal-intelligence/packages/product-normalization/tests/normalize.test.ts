import { describe, it, expect } from 'vitest';
import { normalize, detectIdentifiers, detectVariants, cleanTitle, areCompatibleVariants, rejectIncompatibleMatch } from '../src/index.js';

describe('product-normalization', () => {
  it('detects ASIN, UPC, MPN from title', () => {
    const ids = detectIdentifiers('Product B0CDEFGHI5 model ABC-123 012345678901');
    const types = ids.map(i => i.type);
    expect(types).toContain('ASIN');
    expect(types).toContain('UPC');
    expect(types).toContain('MPN');
  });
  it('detects variants: size, color, storage, pack, bundle', () => {
    const v = detectVariants('Widget size: L color: Red 128 GB 2-pack bundle');
    expect(v.size).toBe('L');
    expect(v.color).toBe('Red');
    expect(v.storageCapacity).toBe('128GB');
    expect(v.packQuantity).toBe(2);
    expect(v.bundle).toBe(true);
  });
  it('cleanTitle strips zero-width chars and collapses whitespace', () => {
    expect(cleanTitle('Hello\u200B   World')).toBe('Hello World');
  });
  it('normalize produces a ProductCandidate', () => {
    const r = normalize({ sourceTitle: 'Echo Dot (5th gen) B0XYZ12345', brand: 'amazon', category: 'smart-speaker' });
    expect(r.candidate.canonicalTitle).toContain('Echo Dot');
    expect(r.candidate.brand).toBe('Amazon');
    expect(r.candidate.identifiers.length).toBeGreaterThan(0);
  });
  it('areCompatibleVariants rejects different sizes', () => {
    expect(areCompatibleVariants({ size: 'L' }, { size: 'M' })).toBe(false);
    expect(areCompatibleVariants({ size: 'L' }, { size: 'L' })).toBe(true);
    expect(areCompatibleVariants({ color: 'Red' }, { color: 'Blue' })).toBe(false);
    expect(areCompatibleVariants({ storageCapacity: '128GB' }, { storageCapacity: '256GB' })).toBe(false);
    expect(areCompatibleVariants({ bundle: true }, {})).toBe(false);
  });
  it('rejectIncompatibleMatch flags condition mismatch', () => {
    const a = { id: 'p1', canonicalTitle: 'X', sourceTitle: 'X', identifiers: [], variants: [{}], condition: 'new', confidence: 1, evidence: [], createdAt: '2024-01-01T00:00:00Z' };
    const b = { ...a, condition: 'used' };
    expect(rejectIncompatibleMatch(a, b)).toBe(true);
  });
});
