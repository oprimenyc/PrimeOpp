import { describe, it, expect } from 'vitest';
import { validateRequired, validateMoney, moneySchema, allSchemas } from '../src/index.js';

describe('schemas', () => {
  it('validateRequired detects missing fields', () => {
    const issues = validateRequired({ a: 1 }, ['a','b']);
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe('$.b');
  });
  it('validateRequired rejects non-object', () => {
    expect(validateRequired(null, ['a'])).toHaveLength(1);
  });
  it('validateMoney accepts valid money', () => {
    expect(validateMoney({ amountMinor: 100, currency: 'USD' })).toHaveLength(0);
  });
  it('validateMoney rejects non-integer amount', () => {
    const issues = validateMoney({ amountMinor: 1.5, currency: 'USD' });
    expect(issues.length).toBeGreaterThan(0);
  });
  it('exports all named schemas', () => {
    expect(moneySchema).toBeDefined();
    expect(Object.keys(allSchemas).length).toBeGreaterThanOrEqual(5);
  });
});
