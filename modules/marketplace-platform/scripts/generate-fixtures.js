// Generates fixture JSON files for sellers, buyers, products, listings, channels, etc.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FIXT = join(ROOT, 'fixtures');

function write(category, name, obj) {
  const dir = join(FIXT, category);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

// Sellers
write('sellers', 'individual_seller', {
  tenantId: 'tenant_demo',
  displayName: 'Alex Individual',
  email: 'alex@example.test',
  sellerType: 'individual_reseller',
  timezone: 'America/New_York',
  locale: 'en-US',
  defaultAlsoListOnPrimeOppMarketplace: true,
  defaultChannels: ['primeopp-marketplace']
});
write('sellers', 'business_seller', {
  tenantId: 'tenant_demo',
  displayName: 'SoleStar Sneakers LLC',
  email: 'ops@solestar.test',
  sellerType: 'business',
  timezone: 'America/New_York',
  locale: 'en-US',
  defaultAlsoListOnPrimeOppMarketplace: true,
  defaultChannels: ['primeopp-marketplace', 'test-ebay', 'test-goat']
});
write('sellers', 'consignment_seller', {
  tenantId: 'tenant_demo',
  displayName: 'ConsignCo',
  email: 'ops@consignco.test',
  sellerType: 'consignment_seller',
  timezone: 'America/New_York',
  locale: 'en-US',
  defaultAlsoListOnPrimeOppMarketplace: true
});
write('sellers', 'nonprofit_seller', {
  tenantId: 'tenant_demo',
  displayName: 'Good Cause Thrift',
  email: 'donations@goodcause.test',
  sellerType: 'nonprofit',
  timezone: 'America/New_York',
  locale: 'en-US',
  defaultAlsoListOnPrimeOppMarketplace: true
});
write('sellers', 'enterprise_seller', {
  tenantId: 'tenant_enterprise',
  displayName: 'MegaRetail Enterprise',
  email: 'it@megaretail.test',
  sellerType: 'enterprise',
  timezone: 'America/New_York',
  locale: 'en-US',
  defaultAlsoListOnPrimeOppMarketplace: false,
  defaultChannels: ['primeopp-marketplace']
});
write('sellers', 'tenant_a_seller', {
  tenantId: 'tenant_demo',
  displayName: 'Tenant A Seller',
  email: 'a@tenant-a.test',
  sellerType: 'business',
  timezone: 'America/New_York',
  locale: 'en-US'
});
write('sellers', 'tenant_b_seller', {
  tenantId: 'tenant_enterprise',
  displayName: 'Tenant B Seller',
  email: 'b@tenant-b.test',
  sellerType: 'business',
  timezone: 'America/New_York',
  locale: 'en-US'
});

// Buyers
write('buyers', 'guest_buyer', { tenantId: 'tenant_demo', displayName: 'Guest', buyerType: 'guest' });
write('buyers', 'registered_buyer', { tenantId: 'tenant_demo', displayName: 'Reg Buyer', email: 'reg@buyer.test', buyerType: 'registered' });
write('buyers', 'verified_buyer', { tenantId: 'tenant_demo', displayName: 'Ver Buyer', email: 'ver@buyer.test', buyerType: 'verified' });
write('buyers', 'business_buyer', { tenantId: 'tenant_demo', displayName: 'Biz Buyer Co', email: 'biz@buyer.test', buyerType: 'business' });
write('buyers', 'tenant_a_buyer', { tenantId: 'tenant_demo', displayName: 'TA Buyer', email: 'tab@buyer.test', buyerType: 'registered' });
write('buyers', 'tenant_b_buyer', { tenantId: 'tenant_enterprise', displayName: 'TB Buyer', email: 'tbb@buyer.test', buyerType: 'registered' });

// Products
write('products', 'sneaker_air_jordan_1', {
  productId: 'prod_aj1_001',
  title: 'Air Jordan 1 Retro High OG — Chicago',
  brand: 'Nike',
  model: 'Air Jordan 1',
  description: 'Air Jordan 1 Retro High OG in Chicago colorway. Size 10.',
  identifiers: [{ kind: 'UPC', value: '019123456789' }, { kind: 'brand_sku', value: 'AJ1-CHI-10' }],
  attributes: [
    { namespace: 'apparel', name: 'size', value: '10' },
    { namespace: 'apparel', name: 'colorway', value: 'Chicago' }
  ],
  categories: [{ categoryId: 'cat_sneakers', canonicalName: 'sneakers', path: ['sneakers'], attributes: [] }],
  images: [{ imageId: 'img1', url: 'https://example.test/aj1.jpg', alt: 'Air Jordan 1 Chicago' }],
  condition: 'new'
});
write('products', 'collectible_vinyl', {
  productId: 'prod_vinyl_001',
  title: 'Rare Beatles White Album Vinyl',
  brand: 'Apple Records',
  description: 'Original pressing Beatles White Album, low serial number.',
  identifiers: [{ kind: 'UPC', value: '077779999999' }],
  attributes: [{ namespace: 'collectibles', name: 'era', value: '1968' }],
  categories: [{ categoryId: 'cat_collectibles', canonicalName: 'collectibles', path: ['collectibles'], attributes: [] }],
  images: [{ imageId: 'img2', url: 'https://example.test/white-album.jpg' }],
  condition: 'used_very_good'
});
write('products', 'electronics_laptop', {
  productId: 'prod_laptop_001',
  title: 'ThinkPad X1 Carbon Gen 10',
  brand: 'Lenovo',
  description: 'ThinkPad X1 Carbon Gen 10, i7, 16GB RAM, 512GB SSD.',
  identifiers: [{ kind: 'UPC', value: '019234567890' }, { kind: 'MPN', value: 'TPX1C10' }],
  attributes: [
    { namespace: 'electronics', name: 'cpu', value: 'i7-1260P' },
    { namespace: 'electronics', name: 'ram', value: '16GB' }
  ],
  categories: [{ categoryId: 'cat_electronics', canonicalName: 'electronics', path: ['electronics'], attributes: [] }],
  images: [{ imageId: 'img3', url: 'https://example.test/thinkpad.jpg' }],
  condition: 'used_very_good'
});
write('products', 'counterfeit_risk_sneaker', {
  productId: 'prod_counterfeit_risk',
  title: 'Replica Air Jordan 1',
  brand: 'Unknown',
  description: '1:1 replica Air Jordan 1. Looks just like the real thing.',
  identifiers: [],
  attributes: [],
  categories: [{ categoryId: 'cat_sneakers', canonicalName: 'sneakers', path: ['sneakers'], attributes: [] }],
  images: [],
  condition: 'new'
});
write('products', 'prohibited_firearm', {
  productId: 'prod_prohibited_firearm',
  title: 'Vintage firearm — collector sale',
  brand: 'Unknown',
  description: 'For sale: vintage firearm.',
  identifiers: [],
  attributes: [],
  categories: [{ categoryId: 'firearms', canonicalName: 'firearms', path: ['firearms'], attributes: [] }],
  images: [],
  condition: 'used_good'
});

// Inventory
write('inventory', 'physical_unique', {
  inventoryId: 'inv_unique_1', tenantId: 'tenant_demo', organizationId: 'org_demo',
  productId: 'prod_aj1_001', sku: 'AJ1-CHI-10', kind: 'serialized',
  quantityTotal: 1, quantityAvailable: 1, quantityReserved: 0, quantityAllocated: 0, quantitySold: 0, quantityDamaged: 0,
  location: { locationId: 'loc_demo_1', name: 'Main Warehouse', region: 'US' },
  serialNumbers: ['SN-AJ1-0001'],
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
});
write('inventory', 'physical_multi', {
  inventoryId: 'inv_multi_1', tenantId: 'tenant_demo', organizationId: 'org_demo',
  productId: 'prod_laptop_001', sku: 'TPX1C10', kind: 'physical',
  quantityTotal: 5, quantityAvailable: 5, quantityReserved: 0, quantityAllocated: 0, quantitySold: 0, quantityDamaged: 0,
  location: { locationId: 'loc_demo_1', name: 'Main Warehouse', region: 'US' },
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
});
write('inventory', 'pod_virtual', {
  inventoryId: 'inv_pod_1', tenantId: 'tenant_demo', organizationId: 'org_demo',
  productId: 'prod_pod_shirt_001', sku: 'POD-T-SHIRT', kind: 'virtual_pod',
  quantityTotal: 999, quantityAvailable: 999, quantityReserved: 0, quantityAllocated: 0, quantitySold: 0, quantityDamaged: 0,
  location: { locationId: 'loc_supplier', name: 'POD Supplier', region: 'US' },
  supplierRef: 'supplier_pod_1',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
});
write('inventory', 'dropship_stale', {
  inventoryId: 'inv_drop_1', tenantId: 'tenant_demo', organizationId: 'org_demo',
  productId: 'prod_drop_001', sku: 'DROP-SKU', kind: 'dropship',
  quantityTotal: 3, quantityAvailable: 3, quantityReserved: 0, quantityAllocated: 0, quantitySold: 0, quantityDamaged: 0,
  location: { locationId: 'loc_supplier', name: 'Dropship Supplier', region: 'US' },
  supplierRef: 'supplier_drop_1',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
});
write('inventory', 'enterprise_multi_location', {
  inventoryId: 'inv_ent_loc_a', tenantId: 'tenant_enterprise', organizationId: 'org_ent',
  productId: 'prod_ent_001', sku: 'ENT-SKU', kind: 'physical',
  quantityTotal: 10, quantityAvailable: 10, quantityReserved: 0, quantityAllocated: 0, quantitySold: 0, quantityDamaged: 0,
  location: { locationId: 'loc_ent_east', name: 'East Warehouse', region: 'US-NE' },
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
});

// Listings
write('listings', 'sneaker_listing_visible_default', {
  tenantId: 'tenant_demo', organizationId: 'org_demo', sellerId: 'seller_demo',
  productId: 'prod_aj1_001', inventoryId: 'inv_unique_1',
  title: 'Air Jordan 1 Retro High OG Chicago — Size 10 — DS',
  description: 'Brand new in box, deadstock Air Jordan 1 Chicago. Size 10. Authentic.',
  bulletPoints: ['Brand new in box', 'Size 10 US', 'Chicago colorway', 'Deadstock'],
  condition: 'new',
  price: { amount: '450.00', currency: 'USD' },
  minimumOffer: { amount: '380.00', currency: 'USD' },
  quantity: 1,
  shippingPolicy: { shippingPolicyId: 'pol_demo', handlingTimeDays: 2, localPickup: true, freeShipping: false },
  returnPolicy: { returnPolicyId: 'ret_demo', returnsAccepted: true, returnWindowDays: 14, restockingFeePercent: 10, returnShippingPaidBy: 'buyer' },
  authenticity: { verifiedAuthentic: true, verificationMethod: 'seller_attestation', disclosures: ['Photo of receipt available on request'] },
  seo: { keywords: ['air jordan 1', 'chicago', 'size 10', 'deadstock'], searchTags: ['sneakers', 'jordan', 'chicago'] },
  destinations: [{ channelId: 'primeopp-marketplace', enabled: true, explicitlySelected: false, primeOppMarketplace: true, selectedAt: '2026-01-01T00:00:00.000Z' }]
});
write('listings', 'multi_channel_listing', {
  tenantId: 'tenant_demo', organizationId: 'org_demo', sellerId: 'seller_demo',
  productId: 'prod_laptop_001', inventoryId: 'inv_multi_1',
  title: 'ThinkPad X1 Carbon Gen 10 i7 16GB 512GB',
  description: 'Excellent condition ThinkPad X1 Carbon Gen 10. Light business use.',
  condition: 'used_very_good',
  price: { amount: '850.00', currency: 'USD' },
  quantity: 5,
  shippingPolicy: { shippingPolicyId: 'pol_laptop', handlingTimeDays: 1, localPickup: false, freeShipping: true },
  returnPolicy: { returnPolicyId: 'ret_laptop', returnsAccepted: true, returnWindowDays: 30, restockingFeePercent: 5, returnShippingPaidBy: 'buyer' },
  authenticity: { verifiedAuthentic: false },
  destinations: [
    { channelId: 'primeopp-marketplace', enabled: true, explicitlySelected: true, primeOppMarketplace: true, selectedAt: '2026-01-01T00:00:00.000Z' },
    { channelId: 'test-ebay', enabled: true, explicitlySelected: true, primeOppMarketplace: false, selectedAt: '2026-01-01T00:00:00.000Z' },
    { channelId: 'test-amazon', enabled: true, explicitlySelected: true, primeOppMarketplace: false, selectedAt: '2026-01-01T00:00:00.000Z' }
  ]
});
write('listings', 'seller_opt_out_listing', {
  tenantId: 'tenant_demo', organizationId: 'org_demo', sellerId: 'seller_demo',
  productId: 'prod_vinyl_001', inventoryId: 'inv_vinyl_1',
  title: 'Beatles White Album Original Pressing',
  description: 'Original pressing Beatles White Album, low serial number.',
  condition: 'used_very_good',
  price: { amount: '1200.00', currency: 'USD' },
  quantity: 1,
  shippingPolicy: { shippingPolicyId: 'pol_vinyl', handlingTimeDays: 3, localPickup: false, freeShipping: false },
  returnPolicy: { returnPolicyId: 'ret_vinyl', returnsAccepted: false, returnWindowDays: 0, restockingFeePercent: 0, returnShippingPaidBy: 'buyer' },
  authenticity: { verifiedAuthentic: false },
  destinations: [
    { channelId: 'primeopp-marketplace', enabled: false, explicitlySelected: true, primeOppMarketplace: true, selectedAt: '2026-01-01T00:00:00.000Z' },
    { channelId: 'test-ebay', enabled: true, explicitlySelected: true, primeOppMarketplace: false, selectedAt: '2026-01-01T00:00:00.000Z' }
  ]
});
write('listings', 'counterfeit_risk_listing', {
  tenantId: 'tenant_demo', organizationId: 'org_demo', sellerId: 'seller_demo',
  productId: 'prod_counterfeit_risk', inventoryId: 'inv_cf_1',
  title: 'Replica Air Jordan 1 — 1:1 Mirror Quality',
  description: '1:1 replica Air Jordan 1. Looks just like the real thing.',
  condition: 'new',
  price: { amount: '120.00', currency: 'USD' },
  quantity: 1,
  shippingPolicy: { shippingPolicyId: 'pol_cf', handlingTimeDays: 2, localPickup: false, freeShipping: false },
  returnPolicy: { returnPolicyId: 'ret_cf', returnsAccepted: false, returnWindowDays: 0, restockingFeePercent: 0, returnShippingPaidBy: 'buyer' },
  authenticity: { verifiedAuthentic: false },
  destinations: [{ channelId: 'primeopp-marketplace', enabled: true, explicitlySelected: false, primeOppMarketplace: true, selectedAt: '2026-01-01T00:00:00.000Z' }]
});
write('listings', 'prohibited_listing', {
  tenantId: 'tenant_demo', organizationId: 'org_demo', sellerId: 'seller_demo',
  productId: 'prod_prohibited_firearm', inventoryId: 'inv_firearm_1',
  title: 'Vintage firearm — collector sale',
  description: 'For sale: vintage firearm.',
  condition: 'used_good',
  price: { amount: '500.00', currency: 'USD' },
  quantity: 1,
  shippingPolicy: { shippingPolicyId: 'pol_firearm', handlingTimeDays: 5, localPickup: true, freeShipping: false },
  returnPolicy: { returnPolicyId: 'ret_firearm', returnsAccepted: false, returnWindowDays: 0, restockingFeePercent: 0, returnShippingPaidBy: 'buyer' },
  authenticity: { verifiedAuthentic: false },
  category: 'firearms',
  destinations: [{ channelId: 'primeopp-marketplace', enabled: true, explicitlySelected: false, primeOppMarketplace: true, selectedAt: '2026-01-01T00:00:00.000Z' }]
});
write('listings', 'pod_listing', {
  tenantId: 'tenant_demo', organizationId: 'org_demo', sellerId: 'seller_demo',
  productId: 'prod_pod_shirt_001', inventoryId: 'inv_pod_1',
  title: 'Custom Print T-Shirt — PrimeOpp Logo',
  description: 'Custom-designed PrimeOpp logo t-shirt. Printed on demand.',
  condition: 'new',
  price: { amount: '24.99', currency: 'USD' },
  quantity: 999,
  shippingPolicy: { shippingPolicyId: 'pol_pod', handlingTimeDays: 5, localPickup: false, freeShipping: false },
  returnPolicy: { returnPolicyId: 'ret_pod', returnsAccepted: true, returnWindowDays: 14, restockingFeePercent: 0, returnShippingPaidBy: 'buyer' },
  authenticity: { verifiedAuthentic: false },
  destinations: [{ channelId: 'primeopp-marketplace', enabled: true, explicitlySelected: false, primeOppMarketplace: true, selectedAt: '2026-01-01T00:00:00.000Z' }]
});
write('listings', 'consignment_listing', {
  tenantId: 'tenant_demo', organizationId: 'org_demo', sellerId: 'seller_demo',
  productId: 'prod_consignment_watch', inventoryId: 'inv_consignment_1',
  title: 'Vintage Rolex Datejust — Consignment',
  description: 'Vintage Rolex Datejust, consigned by original owner.',
  condition: 'used_good',
  price: { amount: '5500.00', currency: 'USD' },
  quantity: 1,
  shippingPolicy: { shippingPolicyId: 'pol_watch', handlingTimeDays: 3, localPickup: false, freeShipping: false },
  returnPolicy: { returnPolicyId: 'ret_watch', returnsAccepted: true, returnWindowDays: 7, restockingFeePercent: 0, returnShippingPaidBy: 'buyer' },
  authenticity: { verifiedAuthentic: true, verificationMethod: 'third_party', disclosures: ['Authenticated by WGS'] },
  destinations: [{ channelId: 'primeopp-marketplace', enabled: true, explicitlySelected: false, primeOppMarketplace: true, selectedAt: '2026-01-01T00:00:00.000Z' }]
});

// Channels
write('channels', 'registry', [
  { channelId: 'primeopp-marketplace', name: 'PrimeOpp Marketplace', testOnly: false },
  { channelId: 'test-ebay', name: 'eBay (TEST)', testOnly: true },
  { channelId: 'test-amazon', name: 'Amazon (TEST)', testOnly: true },
  { channelId: 'test-walmart', name: 'Walmart (TEST)', testOnly: true },
  { channelId: 'test-facebook-marketplace', name: 'Facebook Marketplace (TEST)', testOnly: true, browserRequired: true },
  { channelId: 'test-offerup', name: 'OfferUp (TEST)', testOnly: true, browserRequired: true },
  { channelId: 'test-depop', name: 'Depop (TEST)', testOnly: true, browserRequired: true },
  { channelId: 'test-poshmark', name: 'Poshmark (TEST)', testOnly: true, browserRequired: true },
  { channelId: 'test-mercari', name: 'Mercari (TEST)', testOnly: true, browserRequired: true },
  { channelId: 'test-etsy', name: 'Etsy (TEST)', testOnly: true },
  { channelId: 'test-goat', name: 'GOAT (TEST)', testOnly: true },
  { channelId: 'test-stockx', name: 'StockX (TEST)', testOnly: true },
  { channelId: 'test-alias', name: 'Alias (TEST)', testOnly: true },
  { channelId: 'test-flight-club', name: 'Flight Club (TEST)', testOnly: true },
  { channelId: 'test-stadium-goods', name: 'Stadium Goods (TEST)', testOnly: true },
  { channelId: 'test-grailed', name: 'Grailed (TEST)', testOnly: true, browserRequired: true },
  { channelId: 'test-whatnot', name: 'Whatnot (TEST)', testOnly: true, browserRequired: true },
  { channelId: 'test-craigslist', name: 'Craigslist (TEST)', testOnly: true, browserRequired: true }
]);

// Offers
write('offers', 'sneaker_offer', {
  tenantId: 'tenant_demo', listingId: 'list_demo_sneaker', buyerId: 'buyer_demo', sellerId: 'seller_demo',
  channelId: 'primeopp-marketplace', offerAmount: '400.00', quantity: 1
});
write('offers', 'lowball_offer', {
  tenantId: 'tenant_demo', listingId: 'list_demo_sneaker', buyerId: 'buyer_demo', sellerId: 'seller_demo',
  channelId: 'primeopp-marketplace', offerAmount: '50.00', quantity: 1
});
write('offers', 'acceptable_offer', {
  tenantId: 'tenant_demo', listingId: 'list_demo_sneaker', buyerId: 'buyer_demo', sellerId: 'seller_demo',
  channelId: 'primeopp-marketplace', offerAmount: '440.00', quantity: 1
});

// Orders
write('orders', 'primeopp_order', {
  tenantId: 'tenant_demo', channelId: 'primeopp-marketplace',
  buyer: { buyerId: 'buyer_demo', buyerType: 'registered' },
  seller: { sellerId: 'seller_demo', organizationId: 'org_demo' },
  listing: { listingId: 'list_demo_sneaker', channelId: 'primeopp-marketplace' },
  lines: [{ lineId: 'l1', listingId: 'list_demo_sneaker', productId: 'prod_aj1_001', inventoryId: 'inv_unique_1', quantity: 1, unitPrice: '450.00', lineTotal: '450.00' }],
  price: { subtotal: '450.00', shipping: '15.00', tax: '0.00', discount: '0.00', total: '465.00' },
  commission: { commissionId: 'c1', policyVersion: '2026.01.launch', amount: '0.00' },
  payment: { paymentRef: 'pay1', provider: 'test', authorizedAmount: '465.00', method: 'card' },
  fulfillment: { fulfillmentId: 'f1', kind: 'ship', status: 'pending' },
  idempotencyKey: 'idem_primeopp_001'
});
write('orders', 'external_signed_event', {
  eventId: 'evt_ext_001', tenantId: 'tenant_demo', channelId: 'test-ebay',
  channelOrderId: 'ebay_order_12345', sellerChannelAccountId: 'sca_demo_ebay',
  buyerRef: { buyerId: 'buyer_ebay_1', buyerType: 'registered' },
  listingRef: { listingId: 'list_demo_sneaker', channelId: 'test-ebay', channelListingId: 'ebay_list_001' },
  quantity: 1, unitPrice: '440.00', timestamp: '2026-01-15T10:30:00.000Z',
  signature: '', payload: { source: 'ebay' }, idempotencyKey: 'idem_ebay_001'
});
write('orders', 'duplicate_event', {
  eventId: 'evt_ext_001_dup', tenantId: 'tenant_demo', channelId: 'test-ebay',
  channelOrderId: 'ebay_order_12345', sellerChannelAccountId: 'sca_demo_ebay',
  buyerRef: { buyerId: 'buyer_ebay_1', buyerType: 'registered' },
  listingRef: { listingId: 'list_demo_sneaker', channelId: 'test-ebay', channelListingId: 'ebay_list_001' },
  quantity: 1, unitPrice: '440.00', timestamp: '2026-01-15T10:30:00.000Z',
  signature: '', payload: { source: 'ebay' }, idempotencyKey: 'idem_ebay_001'
});
write('orders', 'cross_tenant_event', {
  eventId: 'evt_xt_001', tenantId: 'tenant_enterprise', channelId: 'test-ebay',
  channelOrderId: 'ebay_order_99999', sellerChannelAccountId: 'sca_demo_ebay',
  buyerRef: { buyerId: 'buyer_ebay_2', buyerType: 'registered' },
  listingRef: { listingId: 'list_demo_sneaker', channelId: 'test-ebay' },
  quantity: 1, unitPrice: '440.00', timestamp: '2026-01-15T10:30:00.000Z',
  signature: '', payload: {}, idempotencyKey: 'idem_xt_001'
});

// Returns
write('returns', 'return_request_damaged', {
  tenantId: 'tenant_demo', orderId: 'order_demo_1', buyerId: 'buyer_demo', sellerId: 'seller_demo',
  reason: 'damaged', description: 'Item arrived with visible damage to the box.',
  policyVersion: '2026.01'
});
write('returns', 'return_request_counterfeit', {
  tenantId: 'tenant_demo', orderId: 'order_demo_2', buyerId: 'buyer_demo', sellerId: 'seller_demo',
  reason: 'counterfeit_concern', description: 'Suspicious that the item is not authentic.',
  policyVersion: '2026.01'
});

// Disputes
write('disputes', 'dispute_not_received', {
  tenantId: 'tenant_demo', kind: 'item_not_received',
  openedBy: 'buyer_demo', openedAgainst: 'seller_demo', orderId: 'order_demo_1'
});
write('disputes', 'dispute_counterfeit', {
  tenantId: 'tenant_demo', kind: 'counterfeit_allegation',
  openedBy: 'buyer_demo', openedAgainst: 'seller_demo', orderId: 'order_demo_2'
});

// Commissions
write('commissions', 'launch_promo_zero_fee', {
  policy: 'launch_promo', grossAmount: '450.00', orderId: 'order_demo_1', tenantId: 'tenant_demo'
});
write('commissions', 'standard_10_percent', {
  policy: 'standard', grossAmount: '450.00', orderId: 'order_demo_2', tenantId: 'tenant_demo'
});
write('commissions', 'grand_opening_discounted', {
  policy: 'grand_opening', grossAmount: '450.00', orderId: 'order_demo_3', tenantId: 'tenant_demo'
});

// Settlements
write('settlements', 'standard_settlement', {
  orderId: 'order_demo_1', tenantId: 'tenant_demo', grossAmount: '450.00'
});

// Moderation
write('moderation', 'flagged_listing', {
  tenantId: 'tenant_demo', listingId: 'list_flagged_1', title: 'Replica Watch', description: '1:1 mirror replica watch'
});
write('moderation', 'clean_listing', {
  tenantId: 'tenant_demo', listingId: 'list_clean_1', title: 'Authentic Seiko Watch', description: 'Genuine Seiko 5'
});

console.log('All fixtures generated.');
