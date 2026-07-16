/**
 * @primeopp-deal-intelligence/historical-pricing
 *
 * Local historical pricing engine. Does NOT claim complete market history
 * from sparse observations.
 *
 * Storage adapters: in-memory, SQLite-interface, PostgreSQL-interface,
 * time-series-extension-interface. Only InMemoryHistoricalPriceStore is
 * implemented here; the others are contracts.
 */
import type {
  PriceObservation, PriceHistoryStats, Money, ProductId, RetailerId, ISO8601, Evidence
} from '@primeopp-deal-intelligence/contracts';
import { money, compare } from '@primeopp-deal-intelligence/contracts';

export interface HistoricalPriceStore {
  record(obs: PriceObservation): Promise<void>;
  stats(productId: string, retailerId?: string): Promise<PriceHistoryStats>;
  observations(productId: string, retailerId?: string): Promise<PriceObservation[]>;
}

export class InMemoryHistoricalPriceStore implements HistoricalPriceStore {
  private obs: PriceObservation[] = [];
  async record(obs: PriceObservation): Promise<void> {
    this.obs.push(obs);
  }
  async observations(productId: string, retailerId?: string): Promise<PriceObservation[]> {
    return this.obs.filter(o =>
      o.productId === productId &&
      (!retailerId || o.retailerId === retailerId)
    ).sort((a, b) => a.observedAt < b.observedAt ? -1 : 1);
  }
  async stats(productId: string, retailerId?: string): Promise<PriceHistoryStats> {
    const list = await this.observations(productId, retailerId);
    if (list.length === 0) {
      return { observationCount: 0, freshness: new Date().toISOString() };
    }
    const first = list[0]!;
    const last = list[list.length - 1]!;
    const prices = list.map(o => o.effectivePrice ?? o.retailerPrice ?? o.observedSalePrice).filter((m): m is Money => !!m);
    if (prices.length === 0) {
      return {
        observationCount: list.length,
        freshness: last.observedAt,
        firstObservedAt: first.observedAt,
        lastObservedAt: last.observedAt
      };
    }
    const sorted = prices.slice().sort((a, b) => compare(a, b));
    const lowest = sorted[0]!;
    const median = sorted[Math.floor(sorted.length / 2)] ?? sorted[0]!;
    const sum = sorted.reduce((acc, m) => acc + m.amountMinor, 0);
    const recentSlice = sorted.slice(-Math.min(5, sorted.length));
    const recentAvg = money(
      Math.round(recentSlice.reduce((a, m) => a + m.amountMinor, 0) / Math.max(1, recentSlice.length)),
      lowest.currency
    );
    const mean = sum / sorted.length;
    const variance = sorted.reduce((acc, m) => acc + Math.pow(m.amountMinor - mean, 2), 0) / sorted.length;
    const volatility = mean > 0 ? Math.sqrt(variance) / mean : 0;
    return {
      observationCount: list.length,
      firstObservedAt: first.observedAt,
      lastObservedAt: last.observedAt,
      lowestObserved: lowest,
      medianObserved: median,
      recentAverage: recentAvg,
      priceFrequency: list.length,
      priceVolatility: volatility,
      freshness: last.observedAt
    };
  }
}

export interface SqliteHistoricalPriceStoreOptions {
  /** SQLite file path. Implementation is deferred; this contract documents the seam. */
  dbPath: string;
}
export interface SqliteHistoricalPriceStore extends HistoricalPriceStore {
  _sqliteOptions: SqliteHistoricalPriceStoreOptions;
}

export interface PostgresHistoricalPriceStoreOptions {
  /** Connection string reference (Prime Vault), not the credential itself. */
  connectionStringRef: string;
}
export interface PostgresHistoricalPriceStore extends HistoricalPriceStore {
  _postgresOptions: PostgresHistoricalPriceStoreOptions;
}

export interface TimeSeriesExtensionStore extends HistoricalPriceStore {
  /** Hypertable or time-series extension name (e.g. timescaledb). */
  extensionName: string;
}

/** Discount percentile: 0 = current price is the lowest, 100 = highest ever. */
export function discountPercentile(currentPrice: Money, history: PriceObservation[]): number {
  const prices = history.map(o => o.effectivePrice ?? o.retailerPrice ?? o.observedSalePrice).filter((m): m is Money => !!m);
  if (prices.length === 0) return 50;
  const sorted = prices.map(p => p.amountMinor).sort((a, b) => a - b);
  const below = sorted.filter(v => v < currentPrice.amountMinor).length;
  return Math.round((below / sorted.length) * 100);
}

export function isHistoricalLow(currentPrice: Money, stats: PriceHistoryStats): boolean {
  if (!stats.lowestObserved) return false;
  return compare(currentPrice, stats.lowestObserved) <= 0;
}

export function isNearHistoricalLow(currentPrice: Money, stats: PriceHistoryStats, thresholdPct = 0.05): boolean {
  if (!stats.lowestObserved) return false;
  const low = stats.lowestObserved.amountMinor;
  const cur = currentPrice.amountMinor;
  return cur <= low * (1 + thresholdPct);
}
