import { describe, it, expect } from 'vitest';
import { isRestockTransition, classifyRestock, restockConfidence, restockUrgency } from '../src/index.js';

describe('restock-engine', () => {
  it('detects restock transition', () => {
    expect(isRestockTransition('OUT_OF_STOCK', 'IN_STOCK')).toBe(true);
    expect(isRestockTransition('IN_STOCK', 'OUT_OF_STOCK')).toBe(false);
    expect(isRestockTransition('DISCONTINUED', 'PREORDER')).toBe(true);
  });
  it('classifies restock kind', () => {
    expect(classifyRestock('OUT_OF_STOCK', 'IN_STOCK', { priorOccurrences: 0 })).toBe('first-restock');
    expect(classifyRestock('OUT_OF_STOCK', 'IN_STOCK', { priorOccurrences: 2 })).toBe('repeated-restock');
    expect(classifyRestock('DISCONTINUED', 'IN_STOCK', { discontinuedBefore: true })).toBe('discontinued-reappearance');
    expect(classifyRestock('OUT_OF_STOCK', 'IN_STOCK', { seasonalProduct: true })).toBe('seasonal-return');
    expect(classifyRestock('IN_STOCK', 'OUT_OF_STOCK', {})).toBeNull();
  });
  it('restockConfidence varies by source', () => {
    expect(restockConfidence('OUT_OF_STOCK', 'IN_STOCK', 'official-api')).toBe(0.95);
    expect(restockConfidence('OUT_OF_STOCK', 'IN_STOCK', 'community-submission')).toBe(0.4);
    expect(restockConfidence('IN_STOCK', 'OUT_OF_STOCK', 'official-api')).toBe(0);
  });
  it('restockUrgency high when stock duration <1h', () => {
    const h = [
      { observedAt: '2024-01-01T00:00:00Z', state: 'IN_STOCK' as const },
      { observedAt: '2024-01-01T00:30:00Z', state: 'OUT_OF_STOCK' as const }
    ];
    expect(restockUrgency(h)).toBe('high');
  });
  it('restockUrgency low with no transitions', () => {
    expect(restockUrgency([{ observedAt: '2024-01-01T00:00:00Z', state: 'IN_STOCK' as const }])).toBe('low');
  });
});
