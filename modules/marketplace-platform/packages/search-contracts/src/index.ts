
// @primeopp-marketplace/search-contracts
import type { CanonicalListing, Identifier, TenantId } from '@primeopp-marketplace/contracts';

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

