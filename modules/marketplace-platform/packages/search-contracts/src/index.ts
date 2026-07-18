
// @primeopp-marketplace/search-contracts
import type { CanonicalListing, Failure, Identifier, Money, Result, TenantId } from '@primeopp-marketplace/contracts';

export interface SearchQuery {
  readonly tenantId: TenantId;
  readonly text?: string;
  readonly category?: string;
  readonly brand?: string;
  readonly priceMin?: number;
  readonly priceMax?: number;
  readonly condition?: string;
  readonly localPickupOnly?: boolean;
  readonly freeShippingOnly?: boolean;
  readonly sellerId?: Identifier;
  readonly sortBy?: 'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'popularity';
  readonly limit?: number;
  readonly offset?: number;
}

export interface SearchResult {
  readonly listingId: Identifier;
  readonly channelId: string;
  readonly title: string;
  readonly price: { amount: string; currency: string };
  readonly condition: string;
  readonly thumbnailUrl?: string;
  readonly sellerId: Identifier;
  readonly relevanceScore: number;
  readonly opportunityScore?: number;
  readonly dealScore?: number;
}

export interface SearchResponse {
  readonly results: readonly SearchResult[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface SearchIndex {
  index(listing: CanonicalListing): void;
  remove(listingId: Identifier): void;
  search(query: SearchQuery): SearchResponse;
}

export type ComparableCondition =
  | 'NEW'
  | 'LIKE_NEW'
  | 'EXCELLENT'
  | 'GOOD'
  | 'FAIR'
  | 'POOR'
  | 'USED'
  | 'UNKNOWN';

export type ComparableListingStatus = 'ACTIVE_LISTING' | 'SOLD_COMPARABLE';

export type ComparableWarningSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ComparableNormalizationWarning {
  readonly code: string;
  readonly message: string;
  readonly severity: ComparableWarningSeverity;
}

export interface RawMarketplaceComparable {
  readonly marketplaceId: string;
  readonly listingId: string;
  readonly title: string;
  readonly condition?: string | null;
  readonly currency?: string | null;
  readonly askingPrice?: number | null;
  readonly soldPrice?: number | null;
  readonly shippingCost?: number | null;
  readonly marketplaceFees?: number | null;
  readonly soldDate?: Date | string | null;
  readonly sellerRating?: number | null;
  readonly productIdentifiers?: readonly string[];
  readonly url?: string;
  readonly evidenceTimestamp?: Date | string;
}

export interface MarketplaceComparable {
  readonly marketplaceId: string;
  readonly listingId: string;
  readonly rawTitle: string;
  readonly condition: ComparableCondition;
  readonly currency: string | null;
  readonly askingPrice: Money | null;
  readonly soldPrice: Money | null;
  readonly shippingCost: Money | null;
  readonly marketplaceFees: Money | null;
  readonly buyerTotal: Money | null;
  readonly listingStatus: ComparableListingStatus;
  readonly soldDate: string | null;
  readonly sellerRating: number | null;
  readonly productIdentifiers: readonly string[];
  readonly url?: string;
  readonly evidenceTimestamp?: string;
  readonly warnings: readonly ComparableNormalizationWarning[];
}

export interface MarketplaceComparableSet {
  readonly activeListings: readonly MarketplaceComparable[];
  readonly soldComparables: readonly MarketplaceComparable[];
  readonly rejected: readonly Failure[];
  readonly warnings: readonly ComparableNormalizationWarning[];
}

export interface MarketplaceComparableSummary {
  readonly soldComparablesCount: number;
  readonly minSoldPrice: Money | null;
  readonly maxSoldPrice: Money | null;
  readonly medianSoldPrice: Money | null;
  readonly meanSoldPrice: Money | null;
  readonly interquartileRange: Money | null;
  readonly newestSoldDate: string | null;
  readonly oldestSoldDate: string | null;
  readonly activeListingsCount: number;
  readonly minAskingPrice: Money | null;
  readonly maxAskingPrice: Money | null;
  readonly medianAskingPrice: Money | null;
}

const CONDITION_MAP: Readonly<Record<string, ComparableCondition>> = {
  new: 'NEW',
  'like new': 'LIKE_NEW',
  excellent: 'EXCELLENT',
  good: 'GOOD',
  fair: 'FAIR',
  poor: 'POOR',
  used: 'USED'
};

const VALID_CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'HKD',
  'NZD', 'SEK', 'KRW', 'SGD', 'NOK', 'MXN', 'INR', 'BRL', 'ZAR'
]);

function roundComparableAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

function moneyFromNumber(amount: number, currency: string): Money {
  return { amount: roundComparableAmount(amount).toFixed(2), currency };
}

function normalizeComparableCondition(rawCondition?: string | null): ComparableCondition {
  if (!rawCondition) return 'UNKNOWN';
  return CONDITION_MAP[rawCondition.trim().toLowerCase()] ?? 'UNKNOWN';
}

function normalizeComparableDate(value?: Date | string | null): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeComparableAmount(
  value: number | null | undefined,
  currency: string | null,
  field: string,
  warnings: ComparableNormalizationWarning[]
): Money | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0) {
    warnings.push({
      code: 'INVALID_COMPARABLE_AMOUNT',
      message: `${field} must be a finite non-negative number.`,
      severity: 'HIGH'
    });
    return null;
  }
  if (currency === null) {
    warnings.push({
      code: 'MISSING_COMPARABLE_CURRENCY',
      message: `${field} was present but no valid currency was provided.`,
      severity: 'HIGH'
    });
    return null;
  }
  return moneyFromNumber(value, currency);
}

function comparableFailure(code: string, message: string, details?: Readonly<Record<string, unknown>>): Failure {
  return { code, message, details, recoverable: true };
}

export function normalizeMarketplaceComparable(raw: RawMarketplaceComparable): Result<MarketplaceComparable> {
  const marketplaceId = raw.marketplaceId?.trim();
  const listingId = raw.listingId?.trim();

  if (!marketplaceId || !listingId) {
    return {
      ok: false,
      error: comparableFailure('INVALID_COMPARABLE_ID', 'Comparable must include non-empty marketplaceId and listingId.')
    };
  }

  const warnings: ComparableNormalizationWarning[] = [];
  const normalizedCurrency = raw.currency?.trim().toUpperCase() ?? null;
  const currency = normalizedCurrency !== null && VALID_CURRENCIES.has(normalizedCurrency) ? normalizedCurrency : null;
  if (normalizedCurrency !== null && currency === null) {
    warnings.push({
      code: 'INVALID_COMPARABLE_CURRENCY',
      message: 'Comparable currency must be an ISO 4217 currency supported by PrimeOpp.',
      severity: 'HIGH'
    });
  }

  const askingPrice = normalizeComparableAmount(raw.askingPrice, currency, 'askingPrice', warnings);
  const soldPrice = normalizeComparableAmount(raw.soldPrice, currency, 'soldPrice', warnings);
  const shippingCost = normalizeComparableAmount(raw.shippingCost, currency, 'shippingCost', warnings);
  const marketplaceFees = normalizeComparableAmount(raw.marketplaceFees, currency, 'marketplaceFees', warnings);

  if (askingPrice === null && soldPrice === null) {
    return {
      ok: false,
      error: comparableFailure('COMPARABLE_PRICE_MISSING', 'Comparable must include either a valid askingPrice or soldPrice.', {
        marketplaceId,
        listingId
      })
    };
  }

  const soldAmount = soldPrice === null ? null : parseFloat(soldPrice.amount);
  const buyerTotal = soldAmount === null || soldPrice === null
    ? null
    : moneyFromNumber(
        soldAmount +
          (shippingCost === null ? 0 : parseFloat(shippingCost.amount)) +
          (marketplaceFees === null ? 0 : parseFloat(marketplaceFees.amount)),
        soldPrice.currency
      );

  const soldDate = normalizeComparableDate(raw.soldDate);
  if (raw.soldDate !== null && raw.soldDate !== undefined && soldDate === null) {
    warnings.push({
      code: 'INVALID_SOLD_DATE',
      message: 'Comparable soldDate could not be parsed and was omitted.',
      severity: 'MEDIUM'
    });
  }

  const evidenceTimestamp = normalizeComparableDate(raw.evidenceTimestamp);
  const comparable: MarketplaceComparable = {
    marketplaceId,
    listingId,
    rawTitle: raw.title ?? '',
    condition: normalizeComparableCondition(raw.condition),
    currency,
    askingPrice,
    soldPrice,
    shippingCost,
    marketplaceFees,
    buyerTotal,
    listingStatus: soldPrice === null ? 'ACTIVE_LISTING' : 'SOLD_COMPARABLE',
    soldDate,
    sellerRating: raw.sellerRating ?? null,
    productIdentifiers: [...(raw.productIdentifiers ?? [])],
    url: raw.url,
    ...(evidenceTimestamp === null ? {} : { evidenceTimestamp }),
    warnings
  };

  return {
    ok: true,
    value: comparable
  };
}

export function normalizeMarketplaceComparableSet(rawComparables: readonly RawMarketplaceComparable[]): MarketplaceComparableSet {
  const accepted = new Map<string, MarketplaceComparable>();
  const rejected: Failure[] = [];
  const warnings: ComparableNormalizationWarning[] = [];

  for (const raw of rawComparables) {
    const result = normalizeMarketplaceComparable(raw);
    if (!result.ok) {
      rejected.push(result.error);
      continue;
    }
    const key = `${result.value.marketplaceId}:${result.value.listingId}`;
    accepted.set(key, result.value);
    warnings.push(...result.value.warnings);
  }

  const values = Array.from(accepted.values());
  return {
    activeListings: values.filter((comparable) => comparable.listingStatus === 'ACTIVE_LISTING'),
    soldComparables: values.filter((comparable) => comparable.listingStatus === 'SOLD_COMPARABLE'),
    rejected,
    warnings
  };
}

function medianComparable(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

function interquartileComparableRange(values: readonly number[]): number | null {
  if (values.length < 4) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const lower = sorted.slice(0, Math.floor(sorted.length / 2));
  const upper = sorted.slice(Math.ceil(sorted.length / 2));
  const q1 = medianComparable(lower);
  const q3 = medianComparable(upper);
  return q1 === null || q3 === null ? null : q3 - q1;
}

function moneyStatistic(value: number | null, currency: string | null): Money | null {
  if (value === null || currency === null) return null;
  return moneyFromNumber(value, currency);
}

export function summarizeMarketplaceComparables(set: MarketplaceComparableSet): MarketplaceComparableSummary {
  const soldWithPrices = set.soldComparables.filter((comparable) => comparable.soldPrice !== null);
  const activeWithPrices = set.activeListings.filter((comparable) => comparable.askingPrice !== null);
  const soldCurrency = soldWithPrices[0]?.soldPrice?.currency ?? null;
  const activeCurrency = activeWithPrices[0]?.askingPrice?.currency ?? null;
  const soldPrices = soldWithPrices
    .filter((comparable) => comparable.soldPrice?.currency === soldCurrency)
    .map((comparable) => parseFloat(comparable.soldPrice!.amount));
  const askingPrices = activeWithPrices
    .filter((comparable) => comparable.askingPrice?.currency === activeCurrency)
    .map((comparable) => parseFloat(comparable.askingPrice!.amount));
  const soldDates = set.soldComparables
    .map((comparable) => comparable.soldDate)
    .filter((date): date is string => date !== null)
    .sort();

  return {
    soldComparablesCount: set.soldComparables.length,
    minSoldPrice: moneyStatistic(soldPrices.length === 0 ? null : Math.min(...soldPrices), soldCurrency),
    maxSoldPrice: moneyStatistic(soldPrices.length === 0 ? null : Math.max(...soldPrices), soldCurrency),
    medianSoldPrice: moneyStatistic(medianComparable(soldPrices), soldCurrency),
    meanSoldPrice: moneyStatistic(
      soldPrices.length === 0 ? null : soldPrices.reduce((sum, price) => sum + price, 0) / soldPrices.length,
      soldCurrency
    ),
    interquartileRange: moneyStatistic(interquartileComparableRange(soldPrices), soldCurrency),
    newestSoldDate: soldDates.length === 0 ? null : soldDates[soldDates.length - 1]!,
    oldestSoldDate: soldDates.length === 0 ? null : soldDates[0]!,
    activeListingsCount: set.activeListings.length,
    minAskingPrice: moneyStatistic(askingPrices.length === 0 ? null : Math.min(...askingPrices), activeCurrency),
    maxAskingPrice: moneyStatistic(askingPrices.length === 0 ? null : Math.max(...askingPrices), activeCurrency),
    medianAskingPrice: moneyStatistic(medianComparable(askingPrices), activeCurrency)
  };
}

export class InMemorySearchIndex implements SearchIndex {
  private readonly listings = new Map<Identifier, CanonicalListing>();

  index(listing: CanonicalListing): void {
    if (listing.currentState === 'ACTIVE') this.listings.set(listing.listingId, listing);
  }

  remove(listingId: Identifier): void { this.listings.delete(listingId); }

  search(query: SearchQuery): SearchResponse {
    let items = Array.from(this.listings.values());
    if (query.text) {
      const q = query.text.toLowerCase();
      items = items.filter(l => l.title.toLowerCase().includes(q) || l.description.toLowerCase().includes(q));
    }
    if (query.category) items = items.filter(l => l.category === query.category);
    if (query.priceMin !== undefined) items = items.filter(l => parseFloat(l.price.amount) >= query.priceMin!);
    if (query.priceMax !== undefined) items = items.filter(l => parseFloat(l.price.amount) <= query.priceMax!);
    if (query.condition) items = items.filter(l => l.condition === query.condition);
    if (query.localPickupOnly) items = items.filter(l => l.shippingPolicy.localPickup);
    if (query.freeShippingOnly) items = items.filter(l => l.shippingPolicy.freeShipping);
    if (query.sellerId) items = items.filter(l => l.sellerId === query.sellerId);

    // Sort
    switch (query.sortBy) {
      case 'price_asc': items.sort((a, b) => parseFloat(a.price.amount) - parseFloat(b.price.amount)); break;
      case 'price_desc': items.sort((a, b) => parseFloat(b.price.amount) - parseFloat(a.price.amount)); break;
      case 'newest': items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); break;
      default: break;
    }

    const total = items.length;
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 20;
    const paged = items.slice(offset, offset + limit);

    const results: SearchResult[] = paged.map(l => ({
      listingId: l.listingId,
      channelId: 'primeopp-marketplace',
      title: l.title,
      price: l.price,
      condition: l.condition,
      thumbnailUrl: l.images[0]?.url,
      sellerId: l.sellerId,
      relevanceScore: 1.0
    }));

    return { results, total, limit, offset };
  }
}

export interface SavedSearch {
  readonly savedSearchId: Identifier;
  readonly tenantId: TenantId;
  readonly accountId: Identifier;
  readonly name: string;
  readonly query: SearchQuery;
  readonly createdAt: string;
}

export interface Watchlist {
  readonly watchlistId: Identifier;
  readonly tenantId: TenantId;
  readonly accountId: Identifier;
  readonly listingIds: readonly Identifier[];
  readonly updatedAt: string;
}
