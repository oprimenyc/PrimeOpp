import { describe, it, expect } from 'vitest';
import {
  money, moneyFromDecimal, add, subtract, multiply, max, min,
  isZero, compare, formatMoney, toDecimal
} from '../src/money.js';
import { nextId, nowIso, isExpired, parseIso, resetIdCounterForTests } from '../src/ids.js';

describe('money', () => {
  it('stores integer minor units', () => {
    const m = money(1234, 'USD');
    expect(m.amountMinor).toBe(1234);
    expect(m.currency).toBe('USD');
  });
  it('rejects non-integer minor units', () => {
    expect(() => money(12.5, 'USD')).toThrow();
  });
  it('converts from decimal with half-to-even rounding', () => {
    expect(moneyFromDecimal(12.34).amountMinor).toBe(1234);
    expect(moneyFromDecimal(12.345).amountMinor).toBe(1235);
    expect(moneyFromDecimal(0.01).amountMinor).toBe(1);
  });
  it('adds same-currency money', () => {
    expect(add(money(100), money(200)).amountMinor).toBe(300);
  });
  it('rejects cross-currency add', () => {
    expect(() => add(money(100, 'USD'), money(100, 'EUR'))).toThrow();
  });
  it('subtracts', () => {
    expect(subtract(money(300), money(100)).amountMinor).toBe(200);
  });
  it('multiplies with rounding', () => {
    expect(multiply(money(99), 1.5).amountMinor).toBe(149);
  });
  it('max and min', () => {
    expect(max(money(50), money(100)).amountMinor).toBe(100);
    expect(min(money(50), money(100)).amountMinor).toBe(50);
  });
  it('isZero', () => {
    expect(isZero(money(0))).toBe(true);
    expect(isZero(money(1))).toBe(false);
  });
  it('compare', () => {
    expect(compare(money(50), money(100))).toBeLessThan(0);
    expect(compare(money(100), money(100))).toBe(0);
    expect(compare(money(200), money(100))).toBeGreaterThan(0);
  });
  it('formats', () => {
    expect(formatMoney(money(1234))).toBe('12.34 USD');
    expect(formatMoney(money(-50))).toBe('-0.50 USD');
  });
  it('toDecimal', () => {
    expect(toDecimal(money(1234))).toBeCloseTo(12.34);
  });
});

describe('ids', () => {
  it('nextId is monotonically unique', () => {
    resetIdCounterForTests();
    const a = nextId('r');
    const b = nextId('r');
    expect(a).not.toBe(b);
    expect(a.startsWith('r_')).toBe(true);
  });
  it('nowIso parses', () => {
    const s = nowIso();
    expect(Number.isFinite(parseIso(s))).toBe(true);
  });
  it('isExpired', () => {
    expect(isExpired(undefined)).toBe(false);
    expect(isExpired('2000-01-01T00:00:00Z', '2001-01-01T00:00:00Z')).toBe(true);
    expect(isExpired('3000-01-01T00:00:00Z', '2001-01-01T00:00:00Z')).toBe(false);
  });
});
