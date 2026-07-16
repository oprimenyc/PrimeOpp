// PrimeOpp Commerce Core SDK.
// High-level facade exposing all engines through a single API.

import type { TenantScoped } from '@primeopp/contracts';
import { InMemoryEvidenceStore } from '@primeopp/evidence';
import { InMemoryCatalogStorage, CanonicalCatalog, InMemoryCatalogAuditLog } from '@primeopp/canonical-catalog';
import { InventoryEngine, InMemoryInventoryStorage } from '@primeopp/inventory';
import { buildTestAdapterRegistry } from '@primeopp/adapter-testkit';
import { ProductIdentityResolver, LocalTestProductIdentityAdapter } from '@primeopp/product-identity';
import { createInMemoryEventSink } from '@primeopp/commerce-events';
import { InMemoryTenantConfigStore, createTenantConfig } from '@primeopp/tenant-config';
import { createFeeScheduleRegistry, defaultPrimeOppMarketplaceFeeSchedule, assessFees } from '@primeopp/fee-engine';
import { estimateShipping } from '@primeopp/shipping-estimator';
import { priceProduct, createPricingObservation } from '@primeopp/pricing';
import { calculateProfit } from '@primeopp/profit-engine';
import { scoreOpportunity } from '@primeopp/opportunity-engine';
import { createCanonicalListing, validateListingForPublication, listingPreview, acceptSelectedChannels, disablePrimeOppMarketplace } from '@primeopp/listing-contracts';
import { createChannelRegistry, registerChannel } from '@primeopp/channel-contracts';
import { validateBarcode, toBarcodePayload } from '@primeopp/barcode';
import { assessCondition } from '@primeopp/condition-engine';
import { buildVariant, detectVariantConflicts } from '@primeopp/variant-engine';
import type { Product, PricingInput, ProfitInput, OpportunityInput, ShippingEstimateInput, FeeAssessment, CanonicalListing, BarcodeFormat } from '@primeopp/contracts';

export interface PrimeOppSdkOptions {
  tenantId: string;
  organizationId?: string;
}

export class PrimeOppSdk {
  readonly scope: TenantScoped;
  readonly evidenceStore = new InMemoryEvidenceStore();
  readonly catalogStorage = new InMemoryCatalogStorage();
  readonly auditLog = new InMemoryCatalogAuditLog();
  readonly catalog = new CanonicalCatalog({ storage: this.catalogStorage, auditLog: this.auditLog });
  readonly inventoryStorage = new InMemoryInventoryStorage();
  readonly inventory = new InventoryEngine({ storage: this.inventoryStorage });
  readonly eventSink = createInMemoryEventSink();
  readonly tenantConfigStore = new InMemoryTenantConfigStore();
  readonly feeScheduleRegistry = createFeeScheduleRegistry();
  readonly channelRegistry = createChannelRegistry();
  readonly testAdapters = buildTestAdapterRegistry();
  readonly identityResolver: ProductIdentityResolver;

  constructor(opts: PrimeOppSdkOptions) {
    this.scope = { tenantId: opts.tenantId, ...(opts.organizationId ? { organizationId: opts.organizationId } : {}) };

    // Register default fee schedule.
    this.feeScheduleRegistry.schedules.set('primeopp-marketplace', defaultPrimeOppMarketplaceFeeSchedule());

    // Register test channels.
    for (const ch of this.testAdapters.channels.values()) {
      registerChannel(this.channelRegistry, ch);
    }

    // Identity resolver with the local test adapter.
    this.identityResolver = new ProductIdentityResolver({
      adapters: [this.testAdapters.barcode ? new LocalTestProductIdentityAdapter() : new LocalTestProductIdentityAdapter()],
    });
  }

  // -- Barcode
  validateBarcode(value: string, format?: BarcodeFormat) {
    return validateBarcode(value, format);
  }

  toBarcodePayload(value: string, format?: BarcodeFormat) {
    return toBarcodePayload(value, format);
  }

  // -- Identity
  async resolveProductIdentity(input: Parameters<ProductIdentityResolver['resolve']>[0]) {
    return this.identityResolver.resolve(input, this.scope);
  }

  // -- Catalog
  async createProduct(product: Product, actor = 'sdk') {
    return this.catalog.create(product, actor);
  }

  async getProduct(productId: string) {
    return this.catalog.get(productId, this.scope);
  }

  async listProducts(opts: { includeArchived?: boolean } = {}) {
    return this.catalog.list(this.scope, opts);
  }

  // -- Inventory
  async inventoryOp(op: Parameters<InventoryEngine['execute']>[0]) {
    return this.inventory.execute(op);
  }

  // -- Condition
  assessCondition(input: Parameters<typeof assessCondition>[0]) {
    return assessCondition(input);
  }

  // -- Pricing
  createPricingObservation(opts: Parameters<typeof createPricingObservation>[0]) {
    return createPricingObservation(opts);
  }

  priceProduct(input: PricingInput) {
    return priceProduct(input);
  }

  // -- Fees
  assessFees(opts: { marketplaceRef: string; basis: { amount: number; currency: string; precise: boolean; status: string }; category?: string; sellerTier?: string }) {
    const schedule = this.feeScheduleRegistry.schedules.get(opts.marketplaceRef);
    if (!schedule) throw new Error(`FEE_SCHEDULE_NOT_FOUND: ${opts.marketplaceRef}`);
    return assessFees({
      schedule,
      basis: opts.basis as FeeAssessment['basis'],
      scope: this.scope,
      ...(opts.category ? { category: opts.category } : {}),
      ...(opts.sellerTier ? { sellerTier: opts.sellerTier } : {}),
    });
  }

  // -- Shipping
  estimateShipping(input: ShippingEstimateInput) {
    return estimateShipping(input);
  }

  // -- Profit
  calculateProfit(input: ProfitInput) {
    return calculateProfit(input);
  }

  // -- Opportunity
  scoreOpportunity(input: OpportunityInput) {
    return scoreOpportunity(input);
  }

  // -- Listings
  createCanonicalListing(opts: Parameters<typeof createCanonicalListing>[0]) {
    return createCanonicalListing(opts);
  }

  validateListingForPublication(listing: CanonicalListing) {
    return validateListingForPublication(listing);
  }

  listingPreview(listing: CanonicalListing) {
    return listingPreview(listing);
  }

  disablePrimeOppMarketplace(listing: CanonicalListing, opts: { reason?: string; userRef: string }) {
    return disablePrimeOppMarketplace(listing, opts);
  }

  acceptSelectedChannels(listing: CanonicalListing, opts: { userRef: string; note?: string }) {
    return acceptSelectedChannels(listing, opts);
  }

  // -- Variant
  buildVariant(productId: string, attributes: Parameters<typeof buildVariant>[1], opts?: Parameters<typeof buildVariant>[2]) {
    return buildVariant(productId, attributes, opts);
  }

  detectVariantConflicts(a: Parameters<typeof detectVariantConflicts>[0], b: Parameters<typeof detectVariantConflicts>[1]) {
    return detectVariantConflicts(a, b);
  }

  // -- Tenant
  async initTenantConfig(opts: { name: string; defaultAlsoListOnPrimeOppMarketplace?: boolean }) {
    const cfg = createTenantConfig({ tenantId: this.scope.tenantId, name: opts.name, defaultAlsoListOnPrimeOppMarketplace: opts.defaultAlsoListOnPrimeOppMarketplace });
    await this.tenantConfigStore.upsert(cfg);
    return cfg;
  }
}

/**
 * Create a fully-wired SDK instance for a tenant.
 */
export function createSdk(opts: PrimeOppSdkOptions): PrimeOppSdk {
  return new PrimeOppSdk(opts);
}
