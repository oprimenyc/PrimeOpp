
// @primeopp-marketplace/channel-registry
// Channel manifests for PrimeOpp Marketplace + 18 test-* external marketplace adapters.
import type { ChannelManifest, ChannelRegistryEntry } from '@primeopp-marketplace/contracts';

const baseCapabilities = [
  { name: 'publish_listing', supported: true },
  { name: 'update_listing', supported: true },
  { name: 'pause_listing', supported: true },
  { name: 'end_listing', supported: true },
  { name: 'sync_inventory', supported: true },
  { name: 'sync_price', supported: true }
];

const baseOfferCapabilities = [
  { name: 'receive_offers', supported: true },
  { name: 'respond_to_offers', supported: true }
];

const baseMessagingCapabilities = [
  { name: 'buyer_question', supported: true },
  { name: 'seller_response', supported: true }
];

const baseOrderCapabilities = [
  { name: 'retrieve_orders', supported: true },
  { name: 'acknowledge_order', supported: true }
];

const baseShippingCapabilities = [
  { name: 'shipping_rates', supported: false },
  { name: 'label_purchase', supported: false }
];

const baseReturnCapabilities = [
  { name: 'return_request', supported: true },
  { name: 'return_label', supported: false }
];

const baseInvSync = [{ name: 'quantity_sync', supported: true }];
const basePriceSync = [{ name: 'price_sync', supported: true }];

function makeManifest(opts: {
  channelId: string; name: string; version: string; testOnly: boolean;
  browserRequirement?: boolean; apiAvailability?: boolean; importExportSupport?: boolean;
  supportedCategories?: string[];
  executionMethods?: ('api' | 'feed' | 'import_export' | 'browser' | 'human_assisted')[];
  termsRestrictions?: string[];
}): ChannelManifest {
  return {
    channelId: opts.channelId,
    name: opts.name,
    version: opts.version,
    supportedRegions: [{ country: 'US' }],
    supportedCategories: opts.supportedCategories ?? ['general'],
    authenticationRequirements: ['oauth2'],
    listingCapabilities: baseCapabilities,
    offerCapabilities: baseOfferCapabilities,
    messagingCapabilities: baseMessagingCapabilities,
    orderCapabilities: baseOrderCapabilities,
    shippingCapabilities: baseShippingCapabilities,
    returnCapabilities: baseReturnCapabilities,
    inventorySyncCapabilities: baseInvSync,
    priceSyncCapabilities: basePriceSync,
    mediaRequirements: { minImages: 1, maxImages: 24, maxWidth: 2000, maxHeight: 2000, acceptsVideo: false },
    identifierRequirements: { required: [], supported: ['UPC','EAN','MPN','brand_sku'] },
    feeScheduleRef: { feeScheduleId: 'fee_default', description: 'Standard test fee schedule' },
    rateLimits: { requestsPerSecond: 5, requestsPerDay: 10000, burst: 10 },
    browserRequirement: opts.browserRequirement ?? false,
    apiAvailability: opts.apiAvailability ?? true,
    importExportSupport: opts.importExportSupport ?? true,
    termsRestrictions: opts.termsRestrictions ?? [],
    healthState: 'healthy',
    verificationSupport: true,
    executionMethods: opts.executionMethods ?? ['api','feed','import_export'],
    testOnly: opts.testOnly,
    releasedAt: '2026-01-01T00:00:00.000Z'
  };
}

export const PRIMEOPP_MARKETPLACE_MANIFEST: ChannelManifest = makeManifest({
  channelId: 'primeopp-marketplace',
  name: 'PrimeOpp Marketplace',
  version: '1.0.0',
  testOnly: false,
  apiAvailability: true,
  importExportSupport: true,
  supportedCategories: ['sneakers','apparel','electronics','books','collectibles','tools','toys','video_games','home_goods','beauty','sporting_goods','automotive','furniture','appliances','general_merchandise'],
  executionMethods: ['api','feed','import_export']
});

export const TEST_ADAPTER_MANIFESTS: readonly ChannelManifest[] = [
  ['test-ebay','eBay (TEST)'],
  ['test-amazon','Amazon (TEST)'],
  ['test-walmart','Walmart (TEST)'],
  ['test-facebook-marketplace','Facebook Marketplace (TEST)'],
  ['test-offerup','OfferUp (TEST)'],
  ['test-depop','Depop (TEST)'],
  ['test-poshmark','Poshmark (TEST)'],
  ['test-mercari','Mercari (TEST)'],
  ['test-etsy','Etsy (TEST)'],
  ['test-goat','GOAT (TEST)'],
  ['test-stockx','StockX (TEST)'],
  ['test-alias','Alias (TEST)'],
  ['test-flight-club','Flight Club (TEST)'],
  ['test-stadium-goods','Stadium Goods (TEST)'],
  ['test-grailed','Grailed (TEST)'],
  ['test-whatnot','Whatnot (TEST)'],
  ['test-craigslist','Craigslist (TEST)']
].map((entry: readonly string[]) => {
  const id = entry[0] ?? '';
  const name = entry[1] ?? '';
  return makeManifest({
    channelId: id,
    name: name,
    version: '0.1.0-test',
    testOnly: true,
    apiAvailability: false,
    browserRequirement: ['test-facebook-marketplace','test-craigslist','test-offerup','test-poshmark','test-depop','test-mercari','test-grailed','test-whatnot'].includes(id),
    executionMethods: ['test-facebook-marketplace','test-craigslist','test-offerup','test-poshmark','test-depop','test-mercari','test-grailed','test-whatnot'].includes(id) ? ['browser','human_assisted'] : ['api','feed']
  });
});

export const ALL_MANIFESTS: readonly ChannelManifest[] = [PRIMEOPP_MARKETPLACE_MANIFEST, ...TEST_ADAPTER_MANIFESTS];

export function getManifest(channelId: string): ChannelManifest | undefined {
  return ALL_MANIFESTS.find(m => m.channelId === channelId);
}

export function listChannels(): readonly ChannelManifest[] {
  return ALL_MANIFESTS;
}

export function listTestOnlyChannels(): readonly ChannelManifest[] {
  return ALL_MANIFESTS.filter(m => m.testOnly);
}

export function isTestOnly(channelId: string): boolean {
  const m = getManifest(channelId);
  return m?.testOnly === true;
}

export function makeRegistryEntry(manifest: ChannelManifest, adapterId: string, adapterVersion: string): ChannelRegistryEntry {
  return {
    manifest,
    adapterId,
    adapterVersion,
    registeredAt: new Date().toISOString()
  };
}

export const DEFAULT_REGISTRY: readonly ChannelRegistryEntry[] = ALL_MANIFESTS.map(m =>
  makeRegistryEntry(m, `adapter_${m.channelId}`, m.version)
);

