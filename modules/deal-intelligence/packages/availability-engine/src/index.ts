/**
 * @primeopp-deal-intelligence/availability-engine
 *
 * Normalizes availability states. Never claims quantity where retailer
 * only exposes a vague stock state.
 */
import type { AvailabilityState, OfferAvailability, ISO8601, Confidence } from '@primeopp-deal-intelligence/contracts';
import { nowIso } from '@primeopp-deal-intelligence/contracts';

export const AVAILABILITY_STATES: AvailabilityState[] = [
  'IN_STOCK','LOW_STOCK','LIMITED','STORE_ONLY','ONLINE_ONLY','PICKUP_ONLY','DELIVERY_ONLY',
  'PREORDER','BACKORDER','RESTOCK_EXPECTED','OUT_OF_STOCK','DISCONTINUED',
  'UNKNOWN','REQUIRES_LOGIN','REQUIRES_MEMBERSHIP'
];

const AVAILABLE_STATES: Set<AvailabilityState> = new Set([
  'IN_STOCK','LOW_STOCK','LIMITED','STORE_ONLY','ONLINE_ONLY','PICKUP_ONLY','DELIVERY_ONLY',
  'PREORDER','BACKORDER','RESTOCK_EXPECTED'
]);

const UNAVAILABLE_STATES: Set<AvailabilityState> = new Set([
  'OUT_OF_STOCK','DISCONTINUED'
]);

const GATED_STATES: Set<AvailabilityState> = new Set([
  'REQUIRES_LOGIN','REQUIRES_MEMBERSHIP'
]);

export function isAvailableState(s: AvailabilityState): boolean {
  return AVAILABLE_STATES.has(s);
}
export function isUnavailableState(s: AvailabilityState): boolean {
  return UNAVAILABLE_STATES.has(s);
}
export function isGatedState(s: AvailabilityState): boolean {
  return GATED_STATES.has(s);
}

export function fromRetailerString(s: string | undefined | null): AvailabilityState {
  if (!s) return 'UNKNOWN';
  const t = s.trim().toLowerCase();
  if (/(in stock|available|ready to ship)/.test(t)) return 'IN_STOCK';
  if (/(low stock|only \d+ left|limited stock)/.test(t)) return 'LOW_STOCK';
  if (/(limited)/.test(t)) return 'LIMITED';
  if (/(store only|in store only)/.test(t)) return 'STORE_ONLY';
  if (/(online only|ship only)/.test(t)) return 'ONLINE_ONLY';
  if (/(pickup only|free pickup)/.test(t)) return 'PICKUP_ONLY';
  if (/(delivery only)/.test(t)) return 'DELIVERY_ONLY';
  if (/(preorder|pre-order|pre order)/.test(t)) return 'PREORDER';
  if (/(backorder|back order)/.test(t)) return 'BACKORDER';
  if (/(restock expected|coming soon)/.test(t)) return 'RESTOCK_EXPECTED';
  if (/(out of stock|sold out|unavailable)/.test(t)) return 'OUT_OF_STOCK';
  if (/(discontinued|no longer available)/.test(t)) return 'DISCONTINUED';
  if (/(login required|sign in)/.test(t)) return 'REQUIRES_LOGIN';
  if (/(membership required|members only)/.test(t)) return 'REQUIRES_MEMBERSHIP';
  return 'UNKNOWN';
}

/** NEVER infer a precise quantity from a vague state. */
export function safeQuantityEstimate(state: AvailabilityState, raw?: { min?: number; max?: number }):
  { min: number; max: number } | undefined {
  if (state === 'IN_STOCK' && raw && typeof raw.min === 'number' && typeof raw.max === 'number') {
    return { min: raw.min, max: raw.max };
  }
  if (state === 'LOW_STOCK' && raw && typeof raw.min === 'number' && typeof raw.max === 'number') {
    return { min: raw.min, max: raw.max };
  }
  // For all other states, do not fabricate a quantity.
  return undefined;
}

export function freshnessOf(av: Pick<OfferAvailability, 'lastCheckedAt' | 'staleAfter'>, now: ISO8601 = nowIso()): {
  stale: boolean; ageMs: number;
} {
  const nowMs = Date.parse(now);
  const lastMs = Date.parse(av.lastCheckedAt);
  const ageMs = nowMs - lastMs;
  if (av.staleAfter) {
    return { stale: nowMs > Date.parse(av.staleAfter), ageMs };
  }
  return { stale: ageMs > 24 * 3600 * 1000, ageMs };
}

export function confidenceFor(state: AvailabilityState, source: string): Confidence {
  if (state === 'UNKNOWN') return 0.1;
  if (source === 'official-api') return 0.95;
  if (source === 'retailer-feed') return 0.9;
  if (source === 'fixture' || source === 'community-submission') return 0.5;
  if (source === 'manual-entry') return 0.4;
  return 0.5;
}

export function mergeAvailability(a: OfferAvailability, b: OfferAvailability): OfferAvailability {
  // Pick the higher-confidence observation; never blend states.
  const pick = a.confidence >= b.confidence ? a : b;
  return {
    ...pick,
    lastCheckedAt: a.lastCheckedAt > b.lastCheckedAt ? a.lastCheckedAt : b.lastCheckedAt
  };
}
