/**
 * @primeopp-deal-intelligence/adapter-sdk
 *
 * Adapter SDK interfaces and conformance base. Every adapter must declare
 * adapterId, version, capabilities, supported retailers, regions,
 * authentication requirements, terms restrictions, rate limits, cost
 * metadata, health check, retry semantics, confidence, freshness,
 * evidence support, browser requirement and legal review status.
 */
import type { AdapterCapability, AdapterId } from '@primeopp-deal-intelligence/contracts';

export interface RetailerApiAdapter extends AdapterCapability {
  type: 'retailer-api';
  fetchProduct(productId: string): Promise<unknown>;
}
export interface RetailerFeedAdapter extends AdapterCapability {
  type: 'retailer-feed';
  fetchFeed(): Promise<unknown>;
}
export interface RetailerCrawlerAdapter extends AdapterCapability {
  type: 'retailer-crawler';
  crawl(url: string): Promise<unknown>;
}
export interface BrowserOperatorAdapter extends AdapterCapability {
  type: 'browser-operator';
  navigate(url: string): Promise<unknown>;
}
export interface AffiliateAdapter extends AdapterCapability {
  type: 'affiliate';
  buildLink(input: { destinationUrl: string; merchantId: string }): Promise<unknown>;
}
export interface HistoricalPriceAdapter extends AdapterCapability {
  type: 'historical-price';
  record(obs: unknown): Promise<void>;
  stats(productId: string): Promise<unknown>;
}
export interface ProductIdentityAdapter extends AdapterCapability {
  type: 'product-identity';
  resolve(identifier: { type: string; value: string }): Promise<unknown>;
}
export interface MarketplaceCompAdapter extends AdapterCapability {
  type: 'marketplace-comp';
  fetchComps(productId: string): Promise<unknown>;
}
export interface AlertChannelAdapter extends AdapterCapability {
  type: 'alert-channel';
  deliver(alert: unknown): Promise<unknown>;
}
export interface PublishingAdapter extends AdapterCapability {
  type: 'publishing';
  publish(pub: unknown): Promise<unknown>;
}
export interface CommunityModerationAdapter extends AdapterCapability {
  type: 'community-moderation';
  moderate(submissionId: string): Promise<unknown>;
}
export interface AmosAdapter extends AdapterCapability {
  type: 'amos';
  submitJob(job: unknown): Promise<unknown>;
}
export interface StorageAdapter extends AdapterCapability {
  type: 'storage';
  read(key: string): Promise<unknown>;
  write(key: string, value: unknown): Promise<void>;
}
export interface EvidenceAdapter extends AdapterCapability {
  type: 'evidence';
  store(payload: unknown): Promise<string>;
  verify(ref: string): Promise<boolean>;
}

export type AnyAdapter =
  | RetailerApiAdapter | RetailerFeedAdapter | RetailerCrawlerAdapter
  | BrowserOperatorAdapter | AffiliateAdapter | HistoricalPriceAdapter
  | ProductIdentityAdapter | MarketplaceCompAdapter | AlertChannelAdapter
  | PublishingAdapter | CommunityModerationAdapter | AmosAdapter
  | StorageAdapter | EvidenceAdapter;

export interface AdapterRegistry {
  register(adapter: AnyAdapter): void;
  list(): AnyAdapter[];
  byId(id: AdapterId): AnyAdapter | undefined;
  byType(type: AnyAdapter['type']): AnyAdapter[];
}

export class InMemoryAdapterRegistry implements AdapterRegistry {
  private map = new Map<AdapterId, AnyAdapter>();
  register(a: AnyAdapter): void {
    if (this.map.has(a.id)) throw new Error(`adapter ${a.id} already registered`);
    this.map.set(a.id, a);
  }
  list(): AnyAdapter[] { return [...this.map.values()]; }
  byId(id: AdapterId): AnyAdapter | undefined { return this.map.get(id); }
  byType(type: AnyAdapter['type']): AnyAdapter[] {
    return this.list().filter(a => a.type === type);
  }
}

/** Conformance base: every adapter must satisfy these checks. */
export function conformanceChecks(a: AnyAdapter): string[] {
  const issues: string[] = [];
  if (!a.id) issues.push('adapter: id required');
  if (!a.version) issues.push('adapter: version required');
  if (!a.capabilities?.length) issues.push('adapter: capabilities required');
  if (typeof a.healthCheck !== 'function') issues.push('adapter: healthCheck must be a function');
  if (!a.retrySemantics || typeof a.retrySemantics.maxRetries !== 'number') issues.push('adapter: retrySemantics.maxRetries required');
  if (typeof a.confidence !== 'number' || a.confidence < 0 || a.confidence > 1) issues.push('adapter: confidence must be 0..1');
  if (!a.legalReviewStatus) issues.push('adapter: legalReviewStatus required');
  return issues;
}
