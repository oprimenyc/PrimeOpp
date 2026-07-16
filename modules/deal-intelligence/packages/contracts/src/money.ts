/**
 * Money utilities. All Money is stored as integer minor units to avoid
 * floating-point representation drift.
 */
import type { Money } from '@primeopp-deal-intelligence/contracts';

export function money(amountMinor: number, currency = 'USD'): Money {
  if (!Number.isInteger(amountMinor)) {
    throw new Error(`money: amountMinor must be an integer, got ${amountMinor}`);
  }
  return { amountMinor, currency };
}

export function moneyFromDecimal(amt: number, currency = 'USD'): Money {
  if (!Number.isFinite(amt)) {
    throw new Error(`moneyFromDecimal: not finite: ${amt}`);
  }
  // Round half-to-even to nearest minor unit (cents).
  const rounded = Math.round(amt * 100);
  return money(rounded, currency);
}

export function toDecimal(m: Money): number {
  return m.amountMinor / 100;
}

export function add(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`money.add: currency mismatch ${a.currency} vs ${b.currency}`);
  }
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`money.subtract: currency mismatch ${a.currency} vs ${b.currency}`);
  }
  return money(a.amountMinor - b.amountMinor, a.currency);
}

export function multiply(a: Money, factor: number): Money {
  return money(Math.round(a.amountMinor * factor), a.currency);
}

export function max(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`money.max: currency mismatch ${a.currency} vs ${b.currency}`);
  }
  return a.amountMinor >= b.amountMinor ? a : b;
}

export function min(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`money.min: currency mismatch ${a.currency} vs ${b.currency}`);
  }
  return a.amountMinor <= b.amountMinor ? a : b;
}

export function isZero(m: Money): boolean {
  return m.amountMinor === 0;
}

export function compare(a: Money, b: Money): number {
  if (a.currency !== b.currency) {
    throw new Error(`money.compare: currency mismatch ${a.currency} vs ${b.currency}`);
  }
  return a.amountMinor - b.amountMinor;
}

export function formatMoney(m: Money): string {
  const sign = m.amountMinor < 0 ? '-' : '';
  const abs = Math.abs(m.amountMinor);
  const major = Math.floor(abs / 100);
  const minor = abs % 100;
  return `${sign}${major}.${minor.toString().padStart(2, '0')} ${m.currency}`;
}
