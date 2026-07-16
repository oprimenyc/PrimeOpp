// Shared primitives for PrimeOpp Commerce Core.
// Centralizes common types and utilities used across packages.

export const SCHEMA_VERSION = '1.0.0';

/**
 * Every operation in the system terminates as one of these explicit states.
 * No silent "no result" state is permitted.
 */
export type TerminalState =
  | 'SUCCEEDED'
  | 'PARTIALLY_SUCCEEDED'
  | 'REQUIRES_REVIEW'
  | 'FAILED'
  | 'CANCELLED';

/**
 * Confidence is always a number in [0, 1] inclusive.
 */
export type Confidence = number;

/**
 * ISO 8601 UTC timestamp string.
 */
export type ISO8601 = string;

/**
 * A tenant identifier. Always non-empty string.
 */
export type TenantId = string;

/**
 * Organization identifier. Always non-empty string.
 */
export type OrganizationId = string;

/**
 * Result wrapper that requires an explicit terminal state.
 * Use this for every public engine operation.
 */
export interface OperationResult<T> {
  state: TerminalState;
  value?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  warnings: Warning[];
  evidence: string[];
  correlationId: string;
}

export interface Warning {
  code: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * Every value that derives from observation or external data
 * must be tagged with its epistemic status.
 */
export type EpistemicStatus =
  | 'ACTUAL'
  | 'AUTHORITATIVE'
  | 'ESTIMATED'
  | 'USER_ENTERED'
  | 'UNKNOWN';

export interface Money {
  amount: number;
  currency: string; // ISO 4217
  /**
   * True if the amount is precise (e.g. a scanned price tag).
   * False if the amount is a midpoint of a range.
   */
  precise: boolean;
  status: EpistemicStatus;
}

export interface MoneyRange {
  low: Money;
  high: Money;
  midpoint: Money;
  status: EpistemicStatus;
}

export interface Identified {
  id: string;
}

export interface Timestamped {
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

export interface TenantScoped {
  tenantId: TenantId;
  organizationId?: OrganizationId;
}

/**
 * Compute a deterministic non-cryptographic hash (FNV-1a 64-bit style).
 * Used for evidence integrity and idempotency keys.
 * NOT for security — only for content-addressed evidence and dedup keys.
 */
export function hashString(input: string): string {
  let h1 = 0x811c9dc5 >>> 0;
  let h2 = 0x1000193 >>> 0;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x85ebca77) >>> 0;
  }
  return ('00000000' + h1.toString(16)).slice(-8) + ('00000000' + h2.toString(16)).slice(-8);
}

/**
 * Generate a UUID using Node's crypto.randomUUID when available.
 */
export function uuid(): string {
  try {
    const g = globalThis;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const crypto = (g as any).crypto;
    if (crypto && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* ignore */
  }
  const s = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${s(8)}-${s(4)}-4${s(3)}-a${s(3)}-${s(12)}`;
}

export function nowUtc(): string {
  return new Date().toISOString();
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function assertTenantScoped<T extends TenantScoped>(obj: T, ctx: string): void {
  if (!obj.tenantId || typeof obj.tenantId !== 'string') {
    throw new Error(`TENANT_SCOPE_MISSING: ${ctx} requires tenantId`);
  }
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) out[k] = sortKeys(obj[k]);
    return out;
  }
  return value;
}

export function roundTo(n: number, decimals = 2): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

/**
 * Wraps a successful result.
 */
export function ok<T>(value: T, opts: { warnings?: Warning[]; evidence?: string[]; correlationId?: string } = {}): OperationResult<T> {
  return {
    state: 'SUCCEEDED',
    value,
    warnings: opts.warnings ?? [],
    evidence: opts.evidence ?? [],
    correlationId: opts.correlationId ?? uuid(),
  };
}

/**
 * Wraps a failure result.
 */
export function fail<T>(code: string, message: string, opts: { details?: Record<string, unknown>; warnings?: Warning[]; correlationId?: string } = {}): OperationResult<T> {
  return {
    state: 'FAILED',
    error: { code, message, details: opts.details },
    warnings: opts.warnings ?? [],
    evidence: [],
    correlationId: opts.correlationId ?? uuid(),
  };
}
