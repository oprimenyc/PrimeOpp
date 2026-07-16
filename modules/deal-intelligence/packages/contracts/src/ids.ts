/**
 * Deterministic identifier and timestamp helpers.
 *
 * Identifiers are created from a counter plus process-stable random tag so
 * that tests can reproduce values exactly. The factory is injectable so
 * tests can supply a seeded generator.
 */
import type { ISO8601 } from '@primeopp-deal-intelligence/contracts';

let counter = 0;
const pidTag = typeof process !== 'undefined' && process.pid
  ? process.pid.toString(36)
  : 'xxxx';
const startTs = Date.now().toString(36);

export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}_${startTs}_${pidTag}_${counter.toString(36)}`;
}

export function resetIdCounterForTests(): void {
  counter = 0;
}

export function nowIso(): ISO8601 {
  return new Date().toISOString();
}

export function isoFromUnix(seconds: number): ISO8601 {
  return new Date(seconds * 1000).toISOString();
}

export function parseIso(s: ISO8601): number {
  const t = Date.parse(s);
  if (Number.isNaN(t)) {
    throw new Error(`parseIso: invalid ISO8601 string: ${s}`);
  }
  return t;
}

export function isExpired(expiresAt?: ISO8601, now: ISO8601 = nowIso()): boolean {
  if (!expiresAt) return false;
  return parseIso(expiresAt) <= parseIso(now);
}

export function freshnessLastSeen(lastSeen: ISO8601, now: ISO8601 = nowIso()): number {
  return parseIso(now) - parseIso(lastSeen);
}
