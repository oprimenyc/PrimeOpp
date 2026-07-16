// @primeopp-marketplace/sdk
// Top-level SDK that wires together all core engines + adapter registration.
export * from '@primeopp-marketplace/contracts';
export * as Seller from '@primeopp-marketplace/seller';
export * as Buyer from '@primeopp-marketplace/buyer';
export * as CanonicalListing from '@primeopp-marketplace/canonical-listing';
export * as ChannelRegistry from '@primeopp-marketplace/channel-registry';
export * as ListingTransformer from '@primeopp-marketplace/listing-transformer';
export * as ListingPublisher from '@primeopp-marketplace/listing-publisher';
export * as ListingSync from '@primeopp-marketplace/listing-sync';
export * as InventorySync from '@primeopp-marketplace/inventory-sync';
export * as OfferEngine from '@primeopp-marketplace/offer-engine';
export * as NegotiationEngine from '@primeopp-marketplace/negotiation-engine';
export * as OrderEngine from '@primeopp-marketplace/order-engine';
export * as FulfillmentContracts from '@primeopp-marketplace/fulfillment-contracts';
export * as ShippingContracts from '@primeopp-marketplace/shipping-contracts';
export * as CommissionEngine from '@primeopp-marketplace/commission-engine';
export * as SettlementContracts from '@primeopp-marketplace/settlement-contracts';
export * as Returns from '@primeopp-marketplace/returns';
export * as Disputes from '@primeopp-marketplace/disputes';
export * as Messaging from '@primeopp-marketplace/messaging';
export * as TrustSafety from '@primeopp-marketplace/trust-safety';
export * as Moderation from '@primeopp-marketplace/moderation';
export * as SearchContracts from '@primeopp-marketplace/search-contracts';
export * as Seo from '@primeopp-marketplace/seo';
export * as AffiliateContracts from '@primeopp-marketplace/affiliate-contracts';
export * as AmosContracts from '@primeopp-marketplace/amos-contracts';
export * as Evidence from '@primeopp-marketplace/evidence';
export * as Observability from '@primeopp-marketplace/observability';
export * as TenantConfig from '@primeopp-marketplace/tenant-config';
export * as AdapterSdk from '@primeopp-marketplace/adapter-sdk';
export * as AdapterTestkit from '@primeopp-marketplace/adapter-testkit';
export * as Schemas from '@primeopp-marketplace/schemas';

import { InMemoryEvidenceStore, createInMemoryEvidenceStore } from '@primeopp-marketplace/evidence';
import { InMemoryEventEmitter, InMemoryMetricReporter, createInMemoryEventEmitter, createInMemoryMetricReporter } from '@primeopp-marketplace/observability';
import { InMemoryAdapterRegistry } from '@primeopp-marketplace/adapter-sdk';
import { InMemoryInventoryStore, InMemoryReservationStore, InMemoryAllocationStore, InMemoryLockStore } from '@primeopp-marketplace/inventory-sync';
import { InMemorySearchIndex } from '@primeopp-marketplace/search-contracts';
import { createPrimeOppMarketplaceAdapter } from '@primeopp-marketplace/primeopp-marketplace';
import type { MarketplaceChannelAdapter } from '@primeopp-marketplace/adapter-sdk';

export interface PrimeOppRuntime {
  readonly evidence: ReturnType<typeof createInMemoryEvidenceStore>;
  readonly events: ReturnType<typeof createInMemoryEventEmitter>;
  readonly metrics: ReturnType<typeof createInMemoryMetricReporter>;
  readonly adapters: InMemoryAdapterRegistry;
  readonly inventory: InMemoryInventoryStore;
  readonly reservations: InMemoryReservationStore;
  readonly allocations: InMemoryAllocationStore;
  readonly locks: InMemoryLockStore;
  readonly search: InMemorySearchIndex;
}

export function createPrimeOppRuntime(): PrimeOppRuntime {
  const evidence = createInMemoryEvidenceStore();
  const events = createInMemoryEventEmitter();
  const metrics = createInMemoryMetricReporter();
  const adapters = new InMemoryAdapterRegistry();
  const inventory = new InMemoryInventoryStore();
  const reservations = new InMemoryReservationStore();
  const allocations = new InMemoryAllocationStore();
  const locks = new InMemoryLockStore();
  const search = new InMemorySearchIndex();
  // Auto-register PrimeOpp Marketplace adapter
  adapters.registerMarketplaceAdapter(createPrimeOppMarketplaceAdapter());
  return { evidence, events, metrics, adapters, inventory, reservations, allocations, locks, search };
}

export function registerAdapter(runtime: PrimeOppRuntime, adapter: MarketplaceChannelAdapter): void {
  runtime.adapters.registerMarketplaceAdapter(adapter);
}

export { InMemoryEvidenceStore, InMemoryEventEmitter, InMemoryMetricReporter, InMemoryAdapterRegistry, InMemoryInventoryStore, InMemoryReservationStore, InMemoryAllocationStore, InMemoryLockStore, InMemorySearchIndex };
