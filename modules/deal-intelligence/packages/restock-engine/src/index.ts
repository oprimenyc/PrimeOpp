/**
 * @primeopp-deal-intelligence/restock-engine
 *
 * Detects first restock, repeated restock, limited releases, seasonal
 * returns, discontinued-product reappearance, regional inventory and
 * back-in-stock events. Never fabricates scarcity.
 */
import type { AvailabilityState, OfferAvailability, ISO8601 } from '@primeopp-deal-intelligence/contracts';

export interface RestockEvent {
  productId: string;
  retailerId: string;
  kind: 'first-restock' | 'repeated-restock' | 'limited-release' | 'seasonal-return'
      | 'discontinued-reappearance' | 'regional-inventory' | 'online-inventory'
      | 'store-inventory' | 'back-in-stock' | 'preorder-opening' | 'waitlist-opening';
  observedAt: ISO8601;
  priorState: AvailabilityState;
  newState: AvailabilityState;
  confidence: number;
  evidence?: string[];
}

export function isRestockTransition(prior: AvailabilityState, current: AvailabilityState): boolean {
  const outOfStockLike: AvailabilityState[] = ['OUT_OF_STOCK','DISCONTINUED','UNKNOWN'];
  const inStockLike: AvailabilityState[] = ['IN_STOCK','LOW_STOCK','LIMITED','PREORDER','BACKORDER','RESTOCK_EXPECTED','STORE_ONLY','ONLINE_ONLY','PICKUP_ONLY','DELIVERY_ONLY'];
  return outOfStockLike.includes(prior) && inStockLike.includes(current);
}

export function classifyRestock(prior: AvailabilityState, current: AvailabilityState, ctx: {
  priorOccurrences?: number; discontinuedBefore?: boolean; seasonalProduct?: boolean;
  region?: string; store?: string;
}): RestockEvent['kind'] | null {
  if (!isRestockTransition(prior, current)) return null;
  if (ctx.discontinuedBefore) return 'discontinued-reappearance';
  if (ctx.seasonalProduct) return 'seasonal-return';
  if ((ctx.priorOccurrences ?? 0) === 0) return 'first-restock';
  if ((ctx.priorOccurrences ?? 0) >= 1) return 'repeated-restock';
  if (ctx.store) return 'store-inventory';
  if (ctx.region) return 'regional-inventory';
  return 'back-in-stock';
}

export function restockConfidence(prior: AvailabilityState, current: AvailabilityState, source: string): number {
  if (!isRestockTransition(prior, current)) return 0;
  let base = 0.7;
  if (source === 'official-api') base = 0.95;
  else if (source === 'retailer-feed') base = 0.9;
  else if (source === 'browser-operator') base = 0.7;
  else if (source === 'community-submission') base = 0.4;
  else if (source === 'manual-entry') base = 0.3;
  return base;
}

/** Urgency: never fabricated. Derived from observed stock duration and release cadence. */
export function restockUrgency(history: { observedAt: ISO8601; state: AvailabilityState }[]): 'high' | 'medium' | 'low' {
  if (history.length < 2) return 'low';
  const inStockDurations: number[] = [];
  let curStart: number | null = null;
  for (let i = 0; i < history.length; i++) {
    const t = Date.parse(history[i]!.observedAt);
    const inStock = ['IN_STOCK','LOW_STOCK','LIMITED'].includes(history[i]!.state);
    if (inStock && curStart === null) curStart = t;
    if (!inStock && curStart !== null) {
      inStockDurations.push(t - curStart);
      curStart = null;
    }
  }
  if (curStart !== null) {
    inStockDurations.push(Date.parse(history[history.length - 1]!.observedAt) - curStart);
  }
  if (inStockDurations.length === 0) return 'low';
  const avgMs = inStockDurations.reduce((a, b) => a + b, 0) / inStockDurations.length;
  // <1 hour => high urgency, <24 hours => medium, else low.
  if (avgMs < 3600 * 1000) return 'high';
  if (avgMs < 24 * 3600 * 1000) return 'medium';
  return 'low';
}
