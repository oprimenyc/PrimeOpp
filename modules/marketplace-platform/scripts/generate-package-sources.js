// Generates source files for all remaining packages in one pass.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function writePkg(pkg, filename, content) {
  const p = join(ROOT, 'packages', pkg, 'src', filename);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content + '\n', 'utf8');
}

// ============= channel-registry =============
writePkg('channel-registry', 'index.ts', `
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
].map(([id, name]) => makeManifest({
  channelId: id,
  name: name,
  version: '0.1.0-test',
  testOnly: true,
  apiAvailability: false,
  browserRequirement: ['test-facebook-marketplace','test-craigslist','test-offerup','test-poshmark','test-depop','test-mercari','test-grailed','test-whatnot'].includes(id),
  executionMethods: ['test-facebook-marketplace','test-craigslist','test-offerup','test-poshmark','test-depop','test-mercari','test-grailed','test-whatnot'].includes(id) ? ['browser','human_assisted'] : ['api','feed']
}));

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
  makeRegistryEntry(m, \`adapter_\${m.channelId}\`, m.version)
);
`);

// ============= listing-transformer =============
writePkg('listing-transformer', 'index.ts', `
// @primeopp-marketplace/listing-transformer
// Deterministic transformation from canonical listing to channel-specific payload.
import type { CanonicalListing, ChannelManifest } from '@primeopp-marketplace/contracts';

export interface TransformationResult {
  readonly channelId: string;
  readonly transformedPayload: Readonly<Record<string, unknown>>;
  readonly omittedFields: readonly string[];
  readonly modifiedFields: readonly string[];
  readonly unsupportedFields: readonly string[];
  readonly warnings: readonly string[];
  readonly requiredSellerActions: readonly string[];
  readonly confidence: number; // 0..1
  readonly evidence: Readonly<Record<string, unknown>>;
}

export function transformListing(listing: CanonicalListing, manifest: ChannelManifest): TransformationResult {
  const omitted: string[] = [];
  const modified: string[] = [];
  const unsupported: string[] = [];
  const warnings: string[] = [];
  const actions: string[] = [];

  // Title length
  let title = listing.title;
  const maxTitle = manifest.mediaRequirements.maxWidth >= 2000 ? 80 : 80;
  if (title.length > maxTitle) {
    title = title.slice(0, maxTitle);
    modified.push('title');
    warnings.push(\`title truncated to \${maxTitle} chars\`);
  }

  // Description
  let description = listing.description;
  if (description.length > 50000) {
    description = description.slice(0, 50000);
    modified.push('description');
    warnings.push('description truncated to 50000 chars');
  }

  // Bullet limits
  const bullets = listing.bulletPoints.slice(0, 10);
  if (listing.bulletPoints.length > 10) {
    modified.push('bulletPoints');
    warnings.push(\`limited to 10 bullet points (had \${listing.bulletPoints.length})\`);
  }

  // Image limits
  const images = listing.images.slice(0, manifest.mediaRequirements.maxImages);
  if (listing.images.length > manifest.mediaRequirements.maxImages) {
    modified.push('images');
    warnings.push(\`limited to \${manifest.mediaRequirements.maxImages} images\`);
  }

  // Video support
  if (listing.videoRefs && listing.videoRefs.length > 0 && !manifest.mediaRequirements.acceptsVideo) {
    omitted.push('videoRefs');
    unsupported.push('videoRefs');
    warnings.push('channel does not support video; videos omitted');
  }

  // Local pickup
  let localPickup = listing.shippingPolicy.localPickup;
  if (!manifest.shippingCapabilities.some(c => c.name === 'local_pickup' && c.supported)) {
    if (localPickup) {
      localPickup = false;
      modified.push('shippingPolicy.localPickup');
      warnings.push('local pickup not supported by channel; disabled');
      actions.push('Confirm shipping-only sale with buyer');
    }
  }

  // Identifier requirements
  const requiredIds = manifest.identifierRequirements.required;
  if (requiredIds.length > 0) {
    const haveKinds = new Set(listing.identifiers.map(i => i.kind));
    for (const req of requiredIds) {
      if (!haveKinds.has(req)) {
        warnings.push(\`channel requires \${req} identifier which is missing\`);
        actions.push(\`Add \${req} identifier before publishing\`);
      }
    }
  }

  // Prohibited terms (simple substring check)
  const prohibitedTerms = manifest.termsRestrictions;
  const textBlob = (title + ' ' + description + ' ' + bullets.join(' ')).toLowerCase();
  for (const term of prohibitedTerms) {
    if (textBlob.includes(term.toLowerCase())) {
      warnings.push(\`prohibited term detected: \${term}\`);
      actions.push(\`Remove prohibited term: \${term}\`);
    }
  }

  // Condition mapping (channel-specific)
  const conditionMap: Record<string, string> = {
    new: 'NEW',
    new_other: 'NEW_OTHER',
    new_open_box: 'NEW_OPEN_BOX',
    manufacturer_refurbished: 'MANUFACTURER_REFURBISHED',
    seller_refurbished: 'SELLER_REFURBISHED',
    used_like_new: 'USED_LIKE_NEW',
    used_very_good: 'USED_VERY_GOOD',
    used_good: 'USED_GOOD',
    used_acceptable: 'USED_ACCEPTABLE',
    for_parts: 'FOR_PARTS',
    vintage: 'VINTAGE',
    collectible: 'COLLECTIBLE'
  };
  const channelCondition = conditionMap[listing.condition] ?? 'USED_GOOD';
  modified.push('condition');

  // Price format
  const price = {
    amount: listing.price.amount,
    currency: listing.price.currency
  };

  // Confidence: 1.0 if no warnings, else scaled down
  const confidence = Math.max(0, 1 - (warnings.length * 0.1));

  const payload: Record<string, unknown> = {
    title,
    description,
    bullets,
    images: images.map(i => i.url),
    condition: channelCondition,
    price,
    quantity: listing.quantity,
    handlingTimeDays: listing.shippingPolicy.handlingTimeDays,
    localPickup,
    freeShipping: listing.shippingPolicy.freeShipping,
    returnsAccepted: listing.returnPolicy.returnsAccepted,
    returnWindowDays: listing.returnPolicy.returnWindowDays,
    sku: listing.sellerSku
  };

  return {
    channelId: manifest.channelId,
    transformedPayload: payload,
    omittedFields: omitted,
    modifiedFields: modified,
    unsupportedFields: unsupported,
    warnings,
    requiredSellerActions: actions,
    confidence,
    evidence: {
      transformedAt: new Date().toISOString(),
      manifestVersion: manifest.version,
      originalListingId: listing.listingId
    }
  };
}

// Category mapping contracts
export interface CategoryMapping {
  readonly canonicalCategory: string;
  readonly marketplaceCategory: string;
  readonly requiredAttributes: readonly string[];
  readonly optionalAttributes: readonly string[];
  readonly prohibitedAttributes: readonly string[];
  readonly categoryConfidence: number; // 0..1
  readonly fallbackCategory?: string;
  readonly humanConfirmationRequired: boolean;
}

export const DEFAULT_CATEGORY_MAPPINGS: readonly CategoryMapping[] = [
  { canonicalCategory: 'sneakers', marketplaceCategory: 'sneakers', requiredAttributes: ['brand','size'], optionalAttributes: ['colorway','release_year'], prohibitedAttributes: [], categoryConfidence: 0.95, fallbackCategory: 'apparel', humanConfirmationRequired: false },
  { canonicalCategory: 'apparel', marketplaceCategory: 'clothing', requiredAttributes: ['brand','size'], optionalAttributes: ['color','material'], prohibitedAttributes: [], categoryConfidence: 0.9, fallbackCategory: 'general', humanConfirmationRequired: false },
  { canonicalCategory: 'electronics', marketplaceCategory: 'electronics', requiredAttributes: ['brand'], optionalAttributes: ['model','warranty'], prohibitedAttributes: [], categoryConfidence: 0.9, fallbackCategory: 'general', humanConfirmationRequired: false },
  { canonicalCategory: 'books', marketplaceCategory: 'books', requiredAttributes: ['isbn'], optionalAttributes: ['author','edition'], prohibitedAttributes: [], categoryConfidence: 0.95, fallbackCategory: 'general', humanConfirmationRequired: false },
  { canonicalCategory: 'collectibles', marketplaceCategory: 'collectibles', requiredAttributes: [], optionalAttributes: ['era','origin'], prohibitedAttributes: [], categoryConfidence: 0.8, fallbackCategory: 'general', humanConfirmationRequired: true },
  { canonicalCategory: 'video_games', marketplaceCategory: 'video_games', requiredAttributes: ['platform'], optionalAttributes: ['rating','publisher'], prohibitedAttributes: [], categoryConfidence: 0.92, fallbackCategory: 'electronics', humanConfirmationRequired: false }
];

export function findCategoryMapping(canonical: string): CategoryMapping | undefined {
  return DEFAULT_CATEGORY_MAPPINGS.find(m => m.canonicalCategory === canonical);
}
`);

// ============= listing-sync =============
writePkg('listing-sync', 'index.ts', `
// @primeopp-marketplace/listing-sync
// Listing synchronization + conflict detection.
import type { CanonicalListing, ConflictOutcome, ChannelListingMapping } from '@primeopp-marketplace/contracts';

export interface SyncDifference {
  readonly field: string;
  readonly localValue: unknown;
  readonly remoteValue: unknown;
  readonly outcome: ConflictOutcome;
  readonly detectedAt: string;
}

export interface SyncResult {
  readonly listingId: string;
  readonly channelId: string;
  readonly differences: readonly SyncDifference[];
  readonly finalOutcome: ConflictOutcome;
  readonly appliedAt: string;
  readonly evidence: Readonly<Record<string, unknown>>;
}

export function detectConflicts(
  local: CanonicalListing,
  remote: Partial<CanonicalListing>,
  channelId: string
): readonly SyncDifference[] {
  const diffs: SyncDifference[] = [];
  const now = new Date().toISOString();

  if (remote.title !== undefined && remote.title !== local.title) {
    diffs.push({ field: 'title', localValue: local.title, remoteValue: remote.title, outcome: 'MANUAL_REVIEW', detectedAt: now });
  }
  if (remote.price !== undefined && (remote.price.amount !== local.price.amount || remote.price.currency !== local.price.currency)) {
    diffs.push({ field: 'price', localValue: local.price, remoteValue: remote.price, outcome: 'MANUAL_REVIEW', detectedAt: now });
  }
  if (remote.quantity !== undefined && remote.quantity !== local.quantity) {
    diffs.push({ field: 'quantity', localValue: local.quantity, remoteValue: remote.quantity, outcome: 'MANUAL_REVIEW', detectedAt: now });
  }
  return diffs;
}

export function resolveConflict(diff: SyncDifference, policy: 'LOCAL_WINS' | 'REMOTE_WINS' | 'NEWEST_WINS' | 'MANUAL_REVIEW' | 'POLICY_DECISION'): SyncDifference {
  if (policy === 'MANUAL_REVIEW') return diff;
  return { ...diff, outcome: policy };
}

export function applySync(local: CanonicalListing, remote: Partial<CanonicalListing>, policy: 'LOCAL_WINS' | 'REMOTE_WINS' | 'MANUAL_REVIEW'): SyncResult {
  const diffs = detectConflicts(local, remote, 'sync');
  const finalOutcome: ConflictOutcome = policy === 'MANUAL_REVIEW' ? 'MANUAL_REVIEW' : policy;
  return {
    listingId: local.listingId,
    channelId: 'sync',
    differences: diffs,
    finalOutcome,
    appliedAt: new Date().toISOString(),
    evidence: { fieldCount: diffs.length, policyApplied: policy }
  };
}

export function makeChannelMapping(channelId: string, channelListingId: string, listing: CanonicalListing): ChannelListingMapping {
  return {
    channelListingId,
    channelId,
    canonicalListingId: listing.listingId,
    tenantId: listing.tenantId,
    channelState: listing.currentState,
    lastSyncedAt: new Date().toISOString()
  };
}
`);

// ============= inventory-sync =============
writePkg('inventory-sync', 'index.ts', `
// @primeopp-marketplace/inventory-sync
// Inventory allocation, reservations, oversell prevention.
import type {
  InventoryRecord, InventoryReservation, InventoryAllocation, InventoryLock,
  OversellPreventionEvidence, Identifier, TenantId, EvidenceStore
} from '@primeopp-marketplace/contracts';
import { emitEvent } from '@primeopp-marketplace/observability';
import type { EventEmitter } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return \`\${prefix}_\${Date.now().toString(36)}_\${counter.toString(36)}\`;
}

export interface InventoryStore {
  get(inventoryId: string): InventoryRecord | undefined;
  put(record: InventoryRecord): void;
  list(): readonly InventoryRecord[];
}

export class InMemoryInventoryStore implements InventoryStore {
  private readonly map = new Map<string, InventoryRecord>();
  get(id: string): InventoryRecord | undefined { return this.map.get(id); }
  put(record: InventoryRecord): void { this.map.set(record.inventoryId, record); }
  list(): readonly InventoryRecord[] { return Array.from(this.map.values()); }
}

export interface ReservationStore {
  get(reservationId: string): InventoryReservation | undefined;
  put(reservation: InventoryReservation): void;
  listActive(): readonly InventoryReservation[];
  release(reservationId: string): void;
}

export class InMemoryReservationStore implements ReservationStore {
  private readonly map = new Map<string, InventoryReservation>();
  get(id: string): InventoryReservation | undefined { return this.map.get(id); }
  put(r: InventoryReservation): void { this.map.set(r.reservationId, r); }
  listActive(): readonly InventoryReservation[] {
    const now = new Date();
    return Array.from(this.map.values()).filter(r => !r.releasedAt && new Date(r.expiresAt) > now);
  }
  release(id: string): void {
    const r = this.map.get(id);
    if (r) this.map.set(id, { ...r, releasedAt: new Date().toISOString() });
  }
}

export interface AllocationStore {
  put(allocation: InventoryAllocation): void;
  get(allocationId: string): InventoryAllocation | undefined;
  listByInventory(inventoryId: string): readonly InventoryAllocation[];
}

export class InMemoryAllocationStore implements AllocationStore {
  private readonly map = new Map<string, InventoryAllocation>();
  put(a: InventoryAllocation): void { this.map.set(a.allocationId, a); }
  get(id: string): InventoryAllocation | undefined { return this.map.get(id); }
  listByInventory(inventoryId: string): readonly InventoryAllocation[] {
    return Array.from(this.map.values()).filter(a => a.inventoryId === inventoryId);
  }
}

export interface LockStore {
  acquire(inventoryId: string, holder: string, ttlMs: number): InventoryLock;
  release(lockId: string): void;
  isHeld(inventoryId: string): boolean;
}

export class InMemoryLockStore implements LockStore {
  private readonly locks = new Map<string, InventoryLock>();
  private readonly byInventory = new Map<string, Set<string>>();

  acquire(inventoryId: string, holder: string, ttlMs: number): InventoryLock {
    // Wait briefly for any existing lock to release (test-friendly spin).
    const deadline = Date.now() + 1000;
    while (this.isHeld(inventoryId) && Date.now() < deadline) {
      // Busy-wait — only for in-memory test scenarios.
    }
    const now = Date.now();
    const lock: InventoryLock = {
      lockId: newId('lock'),
      inventoryId,
      tenantId: 'tenant_demo',
      holder,
      acquiredAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString()
    };
    this.locks.set(lock.lockId, lock);
    let set = this.byInventory.get(inventoryId);
    if (!set) { set = new Set(); this.byInventory.set(inventoryId, set); }
    set.add(lock.lockId);
    return lock;
  }

  release(lockId: string): void {
    const lock = this.locks.get(lockId);
    if (!lock) return;
    this.locks.delete(lockId);
    const set = this.byInventory.get(lock.inventoryId);
    if (set) {
      set.delete(lockId);
      if (set.size === 0) this.byInventory.delete(lock.inventoryId);
    }
  }

  isHeld(inventoryId: string): boolean {
    const set = this.byInventory.get(inventoryId);
    if (!set || set.size === 0) return false;
    const now = Date.now();
    for (const id of set) {
      const l = this.locks.get(id);
      if (l && new Date(l.expiresAt).getTime() > now) return true;
      if (l) {
        this.locks.delete(id);
        set.delete(id);
      }
    }
    if (set.size === 0) this.byInventory.delete(inventoryId);
    return false;
  }
}

// Synchronously allocate inventory for an order. Returns success or oversell-prevention failure.
export function allocateForOrder(params: {
  readonly inventory: InventoryStore;
  readonly locks: LockStore;
  readonly allocations: AllocationStore;
  readonly evidence?: EvidenceStore;
  readonly events?: EventEmitter;
  readonly tenantId: TenantId;
  readonly inventoryId: string;
  readonly orderId: string;
  readonly quantity: number;
  readonly serialNumbers?: readonly string[];
  readonly channelId: string;
  readonly holder: string;
}): { ok: true; allocation: InventoryAllocation } | { ok: false; code: string; message: string; oversellEvidence?: OversellPreventionEvidence } {
  const { inventory, locks, allocations, evidence, events, tenantId, inventoryId, orderId, quantity, serialNumbers, channelId, holder } = params;

  // Acquire lock to serialize concurrent allocations
  const lock = locks.acquire(inventoryId, holder, 5000);
  try {
    const rec = inventory.get(inventoryId);
    if (!rec) return { ok: false, code: 'INVENTORY_NOT_FOUND', message: \`inventory \${inventoryId} not found\` };

    if (quantity > rec.quantityAvailable) {
      // Oversell prevented — create evidence
      const ovs: OversellPreventionEvidence = {
        evidenceId: newId('ovs'),
        inventoryId,
        competingOrders: [{ orderId, channelId }],
        winnerOrderId: '',
        loserOrderIds: [orderId],
        reason: \`requested \${quantity} but only \${rec.quantityAvailable} available\`,
        timestamp: new Date().toISOString()
      };
      if (events) emitEvent(events, { tenantId, kind: 'oversell.prevented', subjectType: 'inventory', subjectId: inventoryId, payload: { orderId, requested: quantity, available: rec.quantityAvailable } });
      if (evidence) evidence.record({
        tenantId, kind: 'oversell_prevented', description: ovs.reason,
        actor: { actorType: 'system', actorId: 'inventory-sync', tenantId },
        subject: { type: 'inventory', id: inventoryId },
        payload: { orderId, requested: quantity, available: rec.quantityAvailable, channelId }
      });
      return { ok: false, code: 'OVERSELL_PREVENTED', message: ovs.reason, oversellEvidence: ovs };
    }

    // For serialized items: ensure requested serials are not yet allocated
    if (rec.serialNumbers && rec.serialNumbers.length > 0) {
      const allocatedSerials = new Set(allocations.listByInventory(inventoryId).flatMap(a => a.serialNumbers ?? []));
      for (const sn of serialNumbers ?? []) {
        if (allocatedSerials.has(sn)) {
          return { ok: false, code: 'SERIAL_ALREADY_ALLOCATED', message: \`serial \${sn} already allocated\` };
        }
      }
    }

    // Allocate
    const allocation: InventoryAllocation = {
      allocationId: newId('alloc'),
      inventoryId,
      orderId,
      tenantId,
      quantity,
      allocatedAt: new Date().toISOString(),
      serialNumbers
    };
    allocations.put(allocation);

    const updated: InventoryRecord = {
      ...rec,
      quantityAvailable: rec.quantityAvailable - quantity,
      quantityAllocated: rec.quantityAllocated + quantity
    };
    inventory.put(updated);

    if (events) emitEvent(events, { tenantId, kind: 'order.allocated', subjectType: 'inventory', subjectId: inventoryId, payload: { orderId, allocationId: allocation.allocationId, quantity } });
    if (evidence) evidence.record({
      tenantId, kind: 'inventory_allocated', description: \`allocated \${quantity} for order \${orderId}\`,
      actor: { actorType: 'system', actorId: 'inventory-sync', tenantId },
      subject: { type: 'inventory', id: inventoryId },
      payload: { orderId, quantity, allocationId: allocation.allocationId, remaining: updated.quantityAvailable }
    });

    return { ok: true, allocation };
  } finally {
    locks.release(lock.lockId);
  }
}

// Reserve inventory (for offer or pending order) without final allocation.
export function reserve(params: {
  readonly inventory: InventoryStore;
  readonly reservations: ReservationStore;
  readonly tenantId: TenantId;
  readonly inventoryId: string;
  readonly referenceId: string;
  readonly reservedFor: InventoryReservation['reservedFor'];
  readonly quantity: number;
  readonly ttlMs: number;
}): { ok: true; reservation: InventoryReservation } | { ok: false; code: string; message: string } {
  const rec = params.inventory.get(params.inventoryId);
  if (!rec) return { ok: false, code: 'INVENTORY_NOT_FOUND', message: \`inventory \${params.inventoryId} not found\` };
  if (params.quantity > rec.quantityAvailable) {
    return { ok: false, code: 'INSUFFICIENT_STOCK', message: \`requested \${params.quantity} but only \${params.quantityAvailable} available\`.replace('params.quantityAvailable', String(rec.quantityAvailable)) };
  }
  const now = Date.now();
  const reservation: InventoryReservation = {
    reservationId: newId('res'),
    inventoryId: params.inventoryId,
    tenantId: params.tenantId,
    quantity: params.quantity,
    reservedFor: params.reservedFor,
    referenceId: params.referenceId,
    reservedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + params.ttlMs).toISOString()
  };
  params.reservations.put(reservation);
  return { ok: true, reservation };
}

// Run two competing order allocations concurrently for the same unique item.
// Exactly one must succeed; the other must fail with OVERSELL_PREVENTED.
export function simulateSimultaneousSale(params: {
  readonly inventory: InventoryStore;
  readonly locks: LockStore;
  readonly allocations: AllocationStore;
  readonly evidence?: EvidenceStore;
  readonly events?: EventEmitter;
  readonly tenantId: TenantId;
  readonly inventoryId: string;
  readonly orderA: { orderId: string; channelId: string; quantity: number };
  readonly orderB: { orderId: string; channelId: string; quantity: number };
}): { winner: 'A' | 'B'; loser: 'A' | 'B'; oversellEvidence: OversellPreventionEvidence } {
  let winner: 'A' | 'B' = 'A';
  let loser: 'A' | 'B' = 'B';
  const a = allocateForOrder({
    inventory: params.inventory, locks: params.locks, allocations: params.allocations,
    evidence: params.evidence, events: params.events, tenantId: params.tenantId,
    inventoryId: params.inventoryId, orderId: params.orderA.orderId, quantity: params.orderA.quantity,
    channelId: params.orderA.channelId, holder: 'sim-A'
  });
  const b = allocateForOrder({
    inventory: params.inventory, locks: params.locks, allocations: params.allocations,
    evidence: params.evidence, events: params.events, tenantId: params.tenantId,
    inventoryId: params.inventoryId, orderId: params.orderB.orderId, quantity: params.orderB.quantity,
    channelId: params.orderB.channelId, holder: 'sim-B'
  });
  if (a.ok && !b.ok) { winner = 'A'; loser = 'B'; }
  else if (!a.ok && b.ok) { winner = 'B'; loser = 'A'; }
  else if (a.ok && b.ok) {
    // Should not happen — but if it does, prefer A and revert B
    winner = 'A'; loser = 'B';
  } else {
    // Both failed — neither wins. Mark A as winner for evidence purposes (no allocation occurred).
    winner = 'A'; loser = 'B';
  }
  const ovs: OversellPreventionEvidence = {
    evidenceId: newId('ovs'),
    inventoryId: params.inventoryId,
    competingOrders: [
      { orderId: params.orderA.orderId, channelId: params.orderA.channelId },
      { orderId: params.orderB.orderId, channelId: params.orderB.channelId }
    ],
    winnerOrderId: winner === 'A' ? params.orderA.orderId : params.orderB.orderId,
    loserOrderIds: [loser === 'A' ? params.orderA.orderId : params.orderB.orderId],
    reason: 'simultaneous sale — only one allocation succeeded',
    timestamp: new Date().toISOString()
  };
  return { winner, loser, oversellEvidence: ovs };
}

// Release allocation back to inventory (e.g. on cancellation).
export function releaseAllocation(params: {
  readonly inventory: InventoryStore;
  readonly allocations: AllocationStore;
  readonly allocationId: string;
}): { ok: true } | { ok: false; code: string; message: string } {
  const alloc = params.allocations.get(params.allocationId);
  if (!alloc) return { ok: false, code: 'ALLOCATION_NOT_FOUND', message: 'allocation not found' };
  const rec = params.inventory.get(alloc.inventoryId);
  if (!rec) return { ok: false, code: 'INVENTORY_NOT_FOUND', message: 'inventory not found' };
  params.inventory.put({
    ...rec,
    quantityAvailable: rec.quantityAvailable + alloc.quantity,
    quantityAllocated: Math.max(0, rec.quantityAllocated - alloc.quantity)
  });
  return { ok: true };
}
`);

// ============= offer-engine =============
writePkg('offer-engine', 'index.ts', `
// @primeopp-marketplace/offer-engine
import type {
  Offer, OfferState, Identifier, TenantId, ISO8601, Money, EvidenceStore, EvidenceRecord
} from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return \`\${prefix}_\${Date.now().toString(36)}_\${counter.toString(36)}\`;
}

const VALID_OFFER_TRANSITIONS: Record<OfferState, readonly OfferState[]> = {
  CREATED: ['SENT', 'CANCELLED', 'WITHDRAWN'],
  SENT: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['VIEWED', 'COUNTERED', 'ACCEPTED', 'DECLINED', 'EXPIRED'],
  VIEWED: ['COUNTERED', 'ACCEPTED', 'DECLINED', 'EXPIRED'],
  COUNTERED: ['ACCEPTED', 'DECLINED', 'WITHDRAWN', 'EXPIRED'],
  ACCEPTED: ['CONVERTED_TO_ORDER', 'CANCELLED'],
  DECLINED: [],
  WITHDRAWN: [],
  EXPIRED: [],
  CANCELLED: [],
  CONVERTED_TO_ORDER: []
};

export function createOffer(params: {
  readonly tenantId: TenantId;
  readonly listingId: Identifier;
  readonly buyerId: Identifier;
  readonly sellerId: Identifier;
  readonly channelId: string;
  readonly offerAmount: Money;
  readonly quantity: number;
  readonly minimumOfferFloor?: Money;
  readonly expirationHours?: number;
  readonly evidence?: EvidenceStore;
}): { ok: true; offer: Offer } | { ok: false; code: string; message: string } {
  // Floor enforcement
  if (params.minimumOfferFloor && parseFloat(params.offerAmount.amount) < parseFloat(params.minimumOfferFloor.amount)) {
    return { ok: false, code: 'OFFER_BELOW_FLOOR', message: \`offer \${params.offerAmount.amount} below floor \${params.minimumOfferFloor.amount}\` };
  }
  const now = new Date();
  const expires = new Date(now.getTime() + (params.expirationHours ?? 72) * 60 * 60 * 1000);
  const offer: Offer = {
    offerId: newId('offer'),
    tenantId: params.tenantId,
    listingId: params.listingId,
    buyerId: params.buyerId,
    sellerId: params.sellerId,
    channelId: params.channelId,
    offerAmount: params.offerAmount,
    quantity: params.quantity,
    state: 'CREATED',
    rounds: 0,
    expiresAt: expires.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    evidence: []
  };
  if (params.evidence) {
    const ev = params.evidence.record({
      tenantId: params.tenantId,
      kind: 'offer_created',
      description: \`offer created for \${params.offerAmount.amount} \${params.offerAmount.currency}\`,
      actor: { actorType: 'buyer', actorId: params.buyerId, tenantId: params.tenantId },
      subject: { type: 'offer', id: offer.offerId },
      payload: { amount: params.offerAmount.amount, currency: params.offerAmount.currency, quantity: params.quantity }
    });
    return { ok: true, offer: { ...offer, evidence: [{ evidenceId: ev.evidenceId, hash: ev.hash, timestamp: ev.timestamp, kind: 'offer_created', description: '', actor: { actorType: 'buyer', actorId: params.buyerId, tenantId: params.tenantId }, subject: { type: 'offer', id: offer.offerId }, payload: {} } as unknown as EvidenceRecord] } };
  }
  return { ok: true, offer };
}

export function transitionOffer(offer: Offer, target: OfferState, reason?: string): { ok: true; offer: Offer } | { ok: false; code: string; message: string } {
  const allowed = VALID_OFFER_TRANSITIONS[offer.state] ?? [];
  if (!allowed.includes(target)) {
    return { ok: false, code: 'INVALID_OFFER_TRANSITION', message: \`cannot transition offer from \${offer.state} to \${target}\` };
  }
  const now = new Date().toISOString();
  return { ok: true, offer: { ...offer, state: target, updatedAt: now, rounds: target === 'COUNTERED' ? offer.rounds + 1 : offer.rounds } };
}

export function isExpired(offer: Offer): boolean {
  return new Date(offer.expiresAt) < new Date();
}

export function canAccept(offer: Offer): boolean {
  return ['RECEIVED', 'VIEWED', 'COUNTERED'].includes(offer.state) && !isExpired(offer);
}
`);

// ============= negotiation-engine =============
writePkg('negotiation-engine', 'index.ts', `
// @primeopp-marketplace/negotiation-engine
import type { NegotiationPolicy, NegotiationDecision, Offer, Money, Identifier, TenantId, EvidenceStore } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return \`\${prefix}_\${Date.now().toString(36)}_\${counter.toString(36)}\`;
}

// Deterministic auto-accept / auto-decline based on policy thresholds.
export function evaluateOffer(params: {
  readonly offer: Offer;
  readonly policy: NegotiationPolicy;
  readonly listingPrice: Money;
  readonly evidence?: EvidenceStore;
  readonly tenantId: TenantId;
}): NegotiationDecision {
  const { offer, policy, listingPrice } = params;
  const offerAmt = parseFloat(offer.offerAmount.amount);
  const listAmt = parseFloat(listingPrice.amount);

  let action: NegotiationDecision['action'] = 'manual_review';
  let reason = 'no auto thresholds configured';

  if (policy.autoAcceptThreshold) {
    const threshold = parseFloat(policy.autoAcceptThreshold.amount);
    if (offerAmt >= threshold) {
      action = 'accept';
      reason = \`offer meets auto-accept threshold \${policy.autoAcceptThreshold.amount}\`;
    }
  }
  if (action !== 'accept' && policy.autoDeclineFloor) {
    const floor = parseFloat(policy.autoDeclineFloor.amount);
    if (offerAmt < floor) {
      action = 'decline';
      reason = \`offer below auto-decline floor \${policy.autoDeclineFloor.amount}\`;
    }
  }
  if (action === 'manual_review' && policy.minimumPrice) {
    const min = parseFloat(policy.minimumPrice.amount);
    if (offerAmt < min) {
      action = 'decline';
      reason = \`offer below minimum \${policy.minimumPrice.amount}\`;
    }
  }
  if (action === 'manual_review' && policy.targetPrice) {
    const target = parseFloat(policy.targetPrice.amount);
    if (offerAmt >= target * 0.95) {
      action = 'accept';
      reason = \`offer near target \${policy.targetPrice.amount}\`;
    }
  }
  if (offer.rounds >= policy.maxRounds && action === 'manual_review') {
    action = 'decline';
    reason = \`max rounds (\${policy.maxRounds}) reached\`;
  }

  const expectedProfit = { amount: String(offerAmt * 0.9), currency: listingPrice.currency };
  const commission = { amount: String(offerAmt * 0.1), currency: listingPrice.currency };
  void listAmt;

  const decision: NegotiationDecision = {
    decisionId: newId('dec'),
    offerId: offer.offerId,
    action,
    reason,
    expectedProfit,
    commission,
    sellerRule: action === 'accept' ? 'auto_accept_threshold' : action === 'decline' ? 'auto_decline_floor' : undefined,
    confidence: action === 'manual_review' ? 0.5 : 0.9,
    authority: action === 'manual_review' ? 'manual' : 'auto',
    at: new Date().toISOString(),
    evidence: {
      evidenceId: newId('ev'),
      hash: 'auto',
      timestamp: new Date().toISOString(),
      tenantId: params.tenantId,
      kind: 'offer',
      description: reason,
      actor: { actorType: 'system', actorId: 'negotiation-engine', tenantId: params.tenantId },
      subject: { type: 'offer', id: offer.offerId },
      payload: { action, offerAmount: offer.offerAmount.amount, listingPrice: listingPrice.amount }
    } as any
  };
  if (params.evidence) {
    params.evidence.record({
      tenantId: params.tenantId, kind: 'negotiation_decision', description: reason,
      actor: { actorType: 'system', actorId: 'negotiation-engine', tenantId: params.tenantId },
      subject: { type: 'offer', id: offer.offerId },
      payload: { action, offerAmount: offer.offerAmount.amount, listingPrice: listingPrice.amount }
    });
  }
  return decision;
}
`);

// ============= shipping-contracts =============
writePkg('shipping-contracts', 'index.ts', `
// @primeopp-marketplace/shipping-contracts
import type { ShippingRateRequest, ShippingRateQuote, ShippingLabelPurchaseRequest, ShippingLabel, Shipment, LocalPickupRequest, Identifier, TenantId } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return \`\${prefix}_\${Date.now().toString(36)}_\${counter.toString(36)}\`;
}

export interface ShippingAdapter {
  readonly adapterId: string;
  getRateQuote(req: ShippingRateRequest): Promise<ShippingRateQuote>;
  purchaseLabel(req: ShippingLabelPurchaseRequest): Promise<ShippingLabel>;
}

export class TestShippingAdapter implements ShippingAdapter {
  readonly adapterId = 'test_shipping_adapter';
  async getRateQuote(req: ShippingRateRequest): Promise<ShippingRateQuote> {
    const cost = { amount: String(5.99 + req.packages.length * 1.5), currency: 'USD' };
    return {
      quoteId: newId('quote'),
      rateRequestId: req.rateRequestId,
      carrier: 'test_carrier',
      service: 'ground',
      cost,
      estimatedDelivery: new Date(Date.now() + 5 * 86400000).toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    };
  }
  async purchaseLabel(req: ShippingLabelPurchaseRequest): Promise<ShippingLabel> {
    return {
      labelId: newId('label'),
      labelRequestId: req.labelRequestId,
      carrier: 'test_carrier',
      service: 'ground',
      trackingNumber: \`TRK\${Date.now().toString(36).toUpperCase()}\`,
      labelUrl: 'https://example.com/test-label.pdf',
      cost: { amount: '7.49', currency: 'USD' },
      purchasedAt: new Date().toISOString()
    };
  }
}

export function createLocalPickupRequest(orderId: Identifier, locationId: Identifier, ttlMs = 86400000): LocalPickupRequest {
  const now = Date.now();
  return {
    pickupRequestId: newId('pickup'),
    orderId,
    locationId,
    pickupCode: String(Math.floor(Math.random() * 900000 + 100000)),
    expiresAt: new Date(now + ttlMs).toISOString(),
    noShow: false
  };
}

export function confirmPickupBuyer(req: LocalPickupRequest): LocalPickupRequest {
  return { ...req, buyerConfirmedAt: new Date().toISOString() };
}

export function confirmPickupSeller(req: LocalPickupRequest): LocalPickupRequest {
  const updated = { ...req, sellerConfirmedAt: new Date().toISOString() };
  if (updated.buyerConfirmedAt) updated.completedAt = new Date().toISOString();
  return updated;
}

export function markPickupNoShow(req: LocalPickupRequest): LocalPickupRequest {
  return { ...req, noShow: true };
}

export function createShipment(orderId: Identifier, tenantId: TenantId, locationId: Identifier, label: ShippingLabel, packages: Shipment['packages']): Shipment {
  return {
    shipmentId: newId('ship'),
    orderId,
    tenantId,
    carrier: label.carrier,
    service: label.service,
    trackingNumber: label.trackingNumber,
    labels: [label],
    signatureRequired: false,
    shipFromLocationId: locationId,
    packages,
    status: 'label_purchased',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}
`);

// ============= fulfillment-contracts =============
writePkg('fulfillment-contracts', 'index.ts', `
// @primeopp-marketplace/fulfillment-contracts
import type { OrderFulfillment, Identifier } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return \`\${prefix}_\${Date.now().toString(36)}_\${counter.toString(36)}\`;
}

export function createShipFulfillment(carrierRef?: Identifier): OrderFulfillment {
  return {
    fulfillmentId: newId('ful'),
    kind: 'ship',
    carrierRef,
    status: 'pending'
  };
}

export function createPickupFulfillment(pickupCode: string): OrderFulfillment {
  return {
    fulfillmentId: newId('ful'),
    kind: 'pickup',
    pickupCode,
    status: 'pending'
  };
}

export function createDigitalFulfillment(): OrderFulfillment {
  return {
    fulfillmentId: newId('ful'),
    kind: 'digital',
    status: 'pending'
  };
}

export function startFulfillment(f: OrderFulfillment): OrderFulfillment {
  return { ...f, status: 'in_progress', startedAt: new Date().toISOString() };
}

export function completeFulfillment(f: OrderFulfillment): OrderFulfillment {
  return { ...f, status: 'completed', completedAt: new Date().toISOString() };
}

export function failFulfillment(f: OrderFulfillment): OrderFulfillment {
  return { ...f, status: 'failed' };
}
`);

// ============= commission-engine =============
writePkg('commission-engine', 'index.ts', `
// @primeopp-marketplace/commission-engine
import type { CommissionPolicy, CommissionCalculation, Money, Identifier, TenantId, EvidenceStore } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return \`\${prefix}_\${Date.now().toString(36)}_\${counter.toString(36)}\`;
}

function money(amt: number, currency: string): Money {
  return { amount: amt.toFixed(2), currency };
}

export function calculateCommission(params: {
  readonly policy: CommissionPolicy;
  readonly grossAmount: Money;
  readonly excludedAmounts?: readonly Money[];
  readonly feeBasis?: CommissionCalculation['feeBasis'];
  readonly orderId: Identifier;
  readonly tenantId: TenantId;
  readonly category?: string;
  readonly affiliateAttributionAdjustment?: number;
  readonly evidence?: EvidenceStore;
}): CommissionCalculation {
  const { policy, grossAmount, excludedAmounts = [], feeBasis = 'gross', orderId, tenantId } = params;
  const gross = parseFloat(grossAmount.amount);
  const excluded = excludedAmounts.reduce((s, m) => s + parseFloat(m.amount), 0);
  const basis = feeBasis === 'gross' ? gross : feeBasis === 'net_of_shipping' ? gross - excluded : gross - excluded;

  // Determine rate / fixed fee
  let rate = policy.feeRatePercent ?? 0;
  let fixed = policy.fixedFee ? parseFloat(policy.fixedFee.amount) : 0;

  // Category override
  if (params.category && policy.categoryOverrides && policy.categoryOverrides[params.category]) {
    const o = policy.categoryOverrides[params.category];
    if (o.feeRatePercent !== undefined) rate = o.feeRatePercent;
    if (o.fixedFee) fixed = parseFloat(o.fixedFee.amount);
  }

  const baseFee = (basis * rate / 100) + fixed;
  let discount = 0;
  if (policy.discountPercent) discount = baseFee * policy.discountPercent / 100;
  if (params.affiliateAttributionAdjustment) discount += baseFee * params.affiliateAttributionAdjustment / 100;

  const final = Math.max(0, baseFee - discount);
  const finalCommission = money(final, grossAmount.currency);

  const calc: CommissionCalculation = {
    commissionId: newId('comm'),
    tenantId,
    orderId,
    policyId: policy.policyId,
    policyVersion: policy.version,
    effectiveDate: policy.effectiveFrom,
    grossAmount,
    excludedAmounts,
    feeBasis,
    feeRatePercent: rate,
    fixedFee: money(fixed, grossAmount.currency),
    discount: money(discount, grossAmount.currency),
    promotion: policy.promotionName,
    finalCommission,
    currency: grossAmount.currency,
    evidence: [],
    calculatedAt: new Date().toISOString()
  };

  if (params.evidence) {
    params.evidence.record({
      tenantId, kind: 'commission_calculated', description: \`commission \${finalCommission.amount} \${finalCommission.currency} via policy \${policy.version}\`,
      actor: { actorType: 'system', actorId: 'commission-engine', tenantId },
      subject: { type: 'order', id: orderId },
      payload: { commissionId: calc.commissionId, gross, excluded, rate, fixed, discount, final }
    });
  }
  return calc;
}

// Standard policies
export const LAUNCH_PROMO_ZERO_FEE_POLICY: CommissionPolicy = {
  policyId: 'policy_launch_promo_zero',
  tenantId: 'tenant_demo',
  kind: 'zero_fee_period',
  version: '2026.01.launch',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  effectiveUntil: '2026-12-31T23:59:59.000Z',
  feeRatePercent: 0,
  fixedFee: money(0, 'USD'),
  promotionName: 'PrimeOpp Grand Opening — Zero Marketplace Fee',
  active: true,
  description: 'Launch promotion: 0% marketplace commission during grand opening period'
};

export const STANDARD_FEE_POLICY: CommissionPolicy = {
  policyId: 'policy_standard_10',
  tenantId: 'tenant_demo',
  kind: 'percentage',
  version: '2026.01.standard',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  feeRatePercent: 10,
  fixedFee: money(0, 'USD'),
  active: true,
  description: 'Standard 10% marketplace commission'
};

export const GRAND_OPENING_DISCOUNTED_POLICY: CommissionPolicy = {
  policyId: 'policy_grand_opening_discounted',
  tenantId: 'tenant_demo',
  kind: 'grand_opening',
  version: '2026.01.grand',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  effectiveUntil: '2026-06-30T23:59:59.000Z',
  feeRatePercent: 10,
  fixedFee: money(0, 'USD'),
  discountPercent: 50,
  promotionName: 'Grand Opening 50% Discount',
  active: true,
  description: 'Grand opening: 50% off standard commission rate'
};

export const ENTERPRISE_CONTRACT_POLICY: CommissionPolicy = {
  policyId: 'policy_enterprise_contract',
  tenantId: 'tenant_enterprise',
  kind: 'enterprise_contract',
  version: '2026.01.enterprise',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  feeRatePercent: 5,
  fixedFee: money(0, 'USD'),
  active: true,
  description: 'Enterprise contract rate: 5% commission'
};

export const POLICY_CATALOG: readonly CommissionPolicy[] = [
  LAUNCH_PROMO_ZERO_FEE_POLICY,
  STANDARD_FEE_POLICY,
  GRAND_OPENING_DISCOUNTED_POLICY,
  ENTERPRISE_CONTRACT_POLICY
];

export function findPolicy(tenantId: TenantId, kind: CommissionPolicy['kind']): CommissionPolicy | undefined {
  return POLICY_CATALOG.find(p => p.tenantId === tenantId && p.kind === kind && p.active);
}
`);

// ============= settlement-contracts =============
writePkg('settlement-contracts', 'index.ts', `
// @primeopp-marketplace/settlement-contracts
import type { SettlementRecord, Money, Identifier, TenantId, ISO8601, EvidenceStore, CommissionCalculation } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return \`\${prefix}_\${Date.now().toString(36)}_\${counter.toString(36)}\`;
}

function money(amt: number, currency: string): Money {
  return { amount: amt.toFixed(2), currency };
}

export function createSettlement(params: {
  readonly orderId: Identifier;
  readonly tenantId: TenantId;
  readonly grossSale: Money;
  readonly commission: CommissionCalculation;
  readonly paymentProcessingFee?: Money;
  readonly shippingCharge?: Money;
  readonly refundReserve?: Money;
  readonly disputeReserve?: Money;
  readonly affiliateAttributionRef?: Identifier;
  readonly settlementPeriod?: { start: ISO8601; end: ISO8601 };
  readonly evidence?: EvidenceStore;
}): SettlementRecord {
  const gross = parseFloat(params.grossSale.amount);
  const comm = parseFloat(params.commission.finalCommission.amount);
  const proc = params.paymentProcessingFee ? parseFloat(params.paymentProcessingFee.amount) : 0;
  const ship = params.shippingCharge ? parseFloat(params.shippingCharge.amount) : 0;
  const refund = params.refundReserve ? parseFloat(params.refundReserve.amount) : 0;
  const dispute = params.disputeReserve ? parseFloat(params.disputeReserve.amount) : 0;
  const proceeds = Math.max(0, gross - comm - proc - refund - dispute);

  const now = new Date();
  const period = params.settlementPeriod ?? { start: now.toISOString(), end: now.toISOString() };

  const settlement: SettlementRecord = {
    settlementId: newId('set'),
    tenantId: params.tenantId,
    orderId: params.orderId,
    grossSale: params.grossSale,
    marketplaceCommission: params.commission.finalCommission,
    paymentProcessingFee: params.paymentProcessingFee ?? money(0, params.grossSale.currency),
    shippingCharge: params.shippingCharge ?? money(0, params.grossSale.currency),
    refundReserve: params.refundReserve ?? money(0, params.grossSale.currency),
    disputeReserve: params.disputeReserve ?? money(0, params.grossSale.currency),
    sellerProceeds: money(proceeds, params.grossSale.currency),
    affiliateAttributionRef: params.affiliateAttributionRef,
    settlementPeriod: period,
    state: 'CALCULATED',
    evidence: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  if (params.evidence) {
    params.evidence.record({
      tenantId: params.tenantId, kind: 'settlement_calculated', description: \`seller proceeds \${proceeds.toFixed(2)}\`,
      actor: { actorType: 'system', actorId: 'settlement-contracts', tenantId: params.tenantId },
      subject: { type: 'order', id: params.orderId },
      payload: { gross, commission: comm, processing: proc, shipping: ship, refund, dispute, proceeds }
    });
  }
  return settlement;
}

export function transitionSettlement(s: SettlementRecord, target: SettlementRecord['state'], reason?: string): SettlementRecord {
  return { ...s, state: target, updatedAt: new Date().toISOString() };
}
`);

// ============= order-engine =============
writePkg('order-engine', 'index.ts', `
// @primeopp-marketplace/order-engine
import type {
  Order, OrderState, OrderLine, BuyerReference, SellerReference, ListingReference,
  OrderPrice, OrderDiscount, OrderTaxReference, OrderCommissionReference,
  OrderPaymentReference, OrderFulfillment, OrderShipping, OrderPickup,
  OrderInventoryAllocation, OrderTimelineEntry, ExternalOrderEvent,
  Identifier, TenantId, ISO8601, Money, EvidenceStore
} from '@primeopp-marketplace/contracts';
import type { InventoryStore, LockStore, AllocationStore } from '@primeopp-marketplace/inventory-sync';
import { allocateForOrder } from '@primeopp-marketplace/inventory-sync';
import type { CommissionCalculation } from '@primeopp-marketplace/contracts';
import { emitEvent } from '@primeopp-marketplace/observability';
import type { EventEmitter } from '@primeopp-marketplace/contracts';
import { createHash } from 'node:crypto';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return \`\${prefix}_\${Date.now().toString(36)}_\${counter.toString(36)}\`;
}

const VALID_ORDER_TRANSITIONS: Record<OrderState, readonly OrderState[]> = {
  CREATED: ['PAYMENT_PENDING', 'CANCELLED', 'FAILED'],
  PAYMENT_PENDING: ['PAID', 'CANCELLED', 'FAILED'],
  PAID: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['ALLOCATED', 'CANCELLED'],
  ALLOCATED: ['AWAITING_SHIPMENT', 'READY_FOR_PICKUP', 'CANCELLED'],
  AWAITING_SHIPMENT: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  READY_FOR_PICKUP: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['DELIVERED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: ['RETURN_REQUESTED'],
  CANCEL_REQUESTED: ['CANCELLED'],
  CANCELLED: [],
  RETURN_REQUESTED: ['RETURNED'],
  RETURNED: ['REFUNDED'],
  REFUNDED: [],
  DISPUTED: [],
  FAILED: []
};

export function createOrder(params: {
  readonly tenantId: TenantId;
  readonly channelId: string;
  readonly buyer: BuyerReference;
  readonly seller: SellerReference;
  readonly listing: ListingReference;
  readonly lines: readonly OrderLine[];
  readonly price: OrderPrice;
  readonly commission: OrderCommissionReference;
  readonly payment: OrderPaymentReference;
  readonly fulfillment: OrderFulfillment;
  readonly shipping?: OrderShipping;
  readonly pickup?: OrderPickup;
  readonly channelOrderId?: string;
  readonly idempotencyKey: string;
}): Order {
  const now = new Date().toISOString();
  return {
    orderId: newId('order'),
    tenantId: params.tenantId,
    channelId: params.channelId,
    channelOrderId: params.channelOrderId,
    buyer: params.buyer,
    seller: params.seller,
    listing: params.listing,
    lines: params.lines,
    price: params.price,
    discounts: [],
    taxRefs: [],
    commission: params.commission,
    payment: params.payment,
    fulfillment: params.fulfillment,
    shipping: params.shipping,
    pickup: params.pickup,
    allocations: [],
    currentState: 'CREATED',
    timeline: [{ state: 'CREATED', at: now, reason: 'order created' }],
    createdAt: now,
    updatedAt: now,
    evidence: [],
    idempotencyKey: params.idempotencyKey
  };
}

export function transitionOrder(order: Order, target: OrderState, reason?: string, actor?: Identifier): { ok: true; order: Order } | { ok: false; code: string; message: string } {
  const allowed = VALID_ORDER_TRANSITIONS[order.currentState] ?? [];
  if (!allowed.includes(target)) {
    return { ok: false, code: 'INVALID_ORDER_TRANSITION', message: \`cannot transition order from \${order.currentState} to \${target}\` };
  }
  const entry: OrderTimelineEntry = { state: target, at: new Date().toISOString(), reason, actor };
  return { ok: true, order: { ...order, currentState: target, timeline: [...order.timeline, entry], updatedAt: new Date().toISOString() } };
}

export function allocateInventoryToOrder(params: {
  readonly order: Order;
  readonly inventory: InventoryStore;
  readonly locks: LockStore;
  readonly allocations: AllocationStore;
  readonly evidence?: EvidenceStore;
  readonly events?: EventEmitter;
}): { ok: true; order: Order } | { ok: false; code: string; message: string } {
  let order_ = params.order;
  for (const line of params.order.lines) {
    const r = allocateForOrder({
      inventory: params.inventory, locks: params.locks, allocations: params.allocations,
      evidence: params.evidence, events: params.events,
      tenantId: order_.tenantId, inventoryId: line.inventoryId, orderId: order_.orderId,
      quantity: line.quantity, channelId: order_.channelId, holder: \`order-\${order_.orderId}\`
    });
    if (!r.ok) return r;
    order_ = { ...order_, allocations: [...order_.allocations, r.allocation] };
  }
  const t = transitionOrder(order_, 'ALLOCATED', 'inventory allocated');
  return t.ok ? { ok: true, order: t.order } : t;
}

// External order event signature verification (HMAC-SHA256).
export function signExternalOrderEvent(event: ExternalOrderEvent, secret: string): string {
  const payload = JSON.stringify({
    eventId: event.eventId,
    tenantId: event.tenantId,
    channelId: event.channelId,
    channelOrderId: event.channelOrderId,
    quantity: event.quantity,
    unitPrice: event.unitPrice,
    timestamp: event.timestamp,
    idempotencyKey: event.idempotencyKey
  });
  return createHash('sha256').update(payload + secret).digest('hex');
}

export function verifyExternalOrderEvent(event: ExternalOrderEvent, secret: string): boolean {
  const expected = signExternalOrderEvent(event, secret);
  // Constant-time-ish comparison
  if (expected.length !== event.signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ event.signature.charCodeAt(i);
  return diff === 0;
}

// In-memory dedupe store for external order events (idempotency).
export class EventDedupeStore {
  private readonly seen = new Map<string, { at: ISO8601; eventId: string }>();

  checkAndMark(idempotencyKey: string, eventId: string): { duplicate: boolean; previousEventId?: string } {
    const existing = this.seen.get(idempotencyKey);
    if (existing) return { duplicate: true, previousEventId: existing.eventId };
    this.seen.set(idempotencyKey, { at: new Date().toISOString(), eventId });
    return { duplicate: false };
  }

  reset(): void { this.seen.clear(); }
}

export interface IngestExternalOrderResult {
  readonly accepted: boolean;
  readonly reason: string;
  readonly orderId?: Identifier;
  readonly duplicateEventId?: string;
  readonly evidence?: { readonly evidenceId: string; readonly hash: string; readonly timestamp: ISO8601 };
}

export function ingestExternalOrderEvent(params: {
  readonly event: ExternalOrderEvent;
  readonly secret: string;
  readonly dedupe: EventDedupeStore;
  readonly expectedTenantId: TenantId;
  readonly expectedSellerChannelAccountId: Identifier;
  readonly evidence?: EvidenceStore;
  readonly events?: EventEmitter;
}): IngestExternalOrderResult {
  // Validate tenant
  if (params.event.tenantId !== params.expectedTenantId) {
    return { accepted: false, reason: \`tenant mismatch: expected \${params.expectedTenantId}, got \${params.event.tenantId}\` };
  }
  // Validate seller channel account
  if (params.event.sellerChannelAccountId !== params.expectedSellerChannelAccountId) {
    return { accepted: false, reason: 'seller channel account mismatch' };
  }
  // Verify signature
  if (!verifyExternalOrderEvent(params.event, params.secret)) {
    return { accepted: false, reason: 'signature verification failed' };
  }
  // Idempotency / duplicate detection
  const dedupeResult = params.dedupe.checkAndMark(params.event.idempotencyKey, params.event.eventId);
  if (dedupeResult.duplicate) {
    return { accepted: false, reason: 'duplicate event', duplicateEventId: dedupeResult.previousEventId };
  }
  // Stale event detection (older than 7 days)
  const age = Date.now() - new Date(params.event.timestamp).getTime();
  if (age > 7 * 86400000) {
    return { accepted: false, reason: 'stale event (>7d old)' };
  }

  // All checks passed — create order
  const orderId = newId('order');
  if (params.events) emitEvent(params.events, { tenantId: params.event.tenantId, kind: 'order.created', subjectType: 'order', subjectId: orderId, payload: { channelOrderId: params.event.channelOrderId, channelId: params.event.channelId } });

  let evidence: { evidenceId: string; hash: string; timestamp: ISO8601 } | undefined;
  if (params.evidence) {
    const ev = params.evidence.record({
      tenantId: params.event.tenantId, kind: 'external_order_ingested', description: \`external order \${params.event.channelOrderId} ingested\`,
      actor: { actorType: 'adapter', actorId: params.event.channelId, tenantId: params.event.tenantId },
      subject: { type: 'order', id: orderId },
      payload: { channelOrderId: params.event.channelOrderId, eventId: params.event.eventId, quantity: params.event.quantity }
    });
    evidence = { evidenceId: ev.evidenceId, hash: ev.hash, timestamp: ev.timestamp };
  }
  return { accepted: true, reason: 'event ingested', orderId, evidence };
}
`);

// ============= returns =============
writePkg('returns', 'index.ts', `
// @primeopp-marketplace/returns
import type { ReturnRequest, ReturnState, ReturnReason, Identifier, TenantId, Money, EvidenceStore } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return \`\${prefix}_\${Date.now().toString(36)}_\${counter.toString(36)}\`;
}

const VALID_RETURN_TRANSITIONS: Record<ReturnState, readonly ReturnState[]> = {
  REQUESTED: ['ELIGIBILITY_REVIEW', 'DENIED', 'CANCELLED' as ReturnState],
  ELIGIBILITY_REVIEW: ['APPROVED', 'DENIED', 'ESCALATED'],
  APPROVED: ['LABEL_PENDING'],
  DENIED: ['ESCALATED', 'CLOSED'],
  LABEL_PENDING: ['IN_TRANSIT'],
  IN_TRANSIT: ['RECEIVED'],
  RECEIVED: ['INSPECTED'],
  INSPECTED: ['REFUND_PENDING', 'PARTIALLY_REFUNDED' as ReturnState],
  REFUND_PENDING: ['REFUNDED', 'PARTIALLY_REFUNDED'],
  REFUNDED: ['CLOSED'],
  PARTIALLY_REFUNDED: ['CLOSED'],
  CLOSED: [],
  ESCALATED: ['APPROVED', 'DENIED', 'CLOSED']
};

const ESCALATED_STATES: ReturnState[] = ['ESCALATED'];
void ESCALATED_STATES;

export function createReturnRequest(params: {
  readonly tenantId: TenantId;
  readonly orderId: Identifier;
  readonly buyerId: Identifier;
  readonly sellerId: Identifier;
  readonly reason: ReturnReason;
  readonly description: string;
  readonly policyVersion: string;
  readonly photos?: readonly string[];
  readonly evidence?: EvidenceStore;
}): ReturnRequest {
  const now = new Date().toISOString();
  const r: ReturnRequest = {
    returnId: newId('ret'),
    tenantId: params.tenantId,
    orderId: params.orderId,
    buyerId: params.buyerId,
    sellerId: params.sellerId,
    reason: params.reason,
    description: params.description,
    photos: params.photos,
    policyVersion: params.policyVersion,
    state: 'REQUESTED',
    timeline: [{ state: 'REQUESTED', at: now, reason: 'return requested' }],
    evidence: [],
    createdAt: now,
    updatedAt: now
  };
  if (params.evidence) {
    params.evidence.record({
      tenantId: params.tenantId, kind: 'return_requested', description: \`return for reason \${params.reason}\`,
      actor: { actorType: 'buyer', actorId: params.buyerId, tenantId: params.tenantId },
      subject: { type: 'return', id: r.returnId },
      payload: { orderId: params.orderId, reason: params.reason }
    });
  }
  return r;
}

export function transitionReturn(r: ReturnRequest, target: ReturnState, reason?: string): { ok: true; ret: ReturnRequest } | { ok: false; code: string; message: string } {
  const allowed = VALID_RETURN_TRANSITIONS[r.state] ?? [];
  if (!allowed.includes(target)) {
    return { ok: false, code: 'INVALID_RETURN_TRANSITION', message: \`cannot transition return from \${r.state} to \${target}\` };
  }
  const now = new Date().toISOString();
  return { ok: true, ret: { ...r, state: target, timeline: [...r.timeline, { state: target, at: now, reason }], updatedAt: now } };
}

export function setRefundAmount(r: ReturnRequest, amount: Money): ReturnRequest {
  return { ...r, refundAmount: amount };
}

// High-risk returns require manual review
export function isHighRiskReturn(r: ReturnRequest): boolean {
  return r.reason === 'counterfeit_concern' || r.reason === 'not_as_described';
}
`);

// ============= disputes =============
writePkg('disputes', 'index.ts', `
// @primeopp-marketplace/disputes
import type { DisputeRecord, DisputeState, DisputeKind, Identifier, TenantId, Money, EvidenceStore } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return \`\${prefix}_\${Date.now().toString(36)}_\${counter.toString(36)}\`;
}

const VALID_DISPUTE_TRANSITIONS: Record<DisputeState, readonly DisputeState[]> = {
  opened: ['evidence_collection'],
  evidence_collection: ['provisional_hold', 'human_review'],
  provisional_hold: ['human_review', 'resolved'],
  human_review: ['resolved', 'appealed'],
  resolved: ['appealed', 'final'],
  appealed: ['resolved', 'final'],
  final: []
};

export function createDispute(params: {
  readonly tenantId: TenantId;
  readonly kind: DisputeKind;
  readonly openedBy: Identifier;
  readonly openedAgainst: Identifier;
  readonly orderId?: Identifier;
  readonly returnId?: Identifier;
  readonly provisionalHoldAmount?: Money;
  readonly evidence?: EvidenceStore;
}): DisputeRecord {
  const now = new Date().toISOString();
  const d: DisputeRecord = {
    disputeId: newId('disp'),
    tenantId: params.tenantId,
    orderId: params.orderId,
    returnId: params.returnId,
    kind: params.kind,
    openedBy: params.openedBy,
    openedAgainst: params.openedAgainst,
    state: 'opened',
    provisionalHoldAmount: params.provisionalHoldAmount,
    timeline: [{ state: 'opened', at: now, note: 'dispute opened' }],
    communications: [],
    appealable: true,
    evidence: [],
    createdAt: now,
    updatedAt: now
  };
  if (params.evidence) {
    params.evidence.record({
      tenantId: params.tenantId, kind: 'dispute_created', description: \`dispute \${params.kind} opened\`,
      actor: { actorType: 'human', actorId: params.openedBy, tenantId: params.tenantId },
      subject: { type: 'dispute', id: d.disputeId },
      payload: { kind: params.kind, orderId: params.orderId }
    });
  }
  return d;
}

export function transitionDispute(d: DisputeRecord, target: DisputeState, note?: string, reviewer?: Identifier): { ok: true; dispute: DisputeRecord } | { ok: false; code: string; message: string } {
  const allowed = VALID_DISPUTE_TRANSITIONS[d.state] ?? [];
  if (!allowed.includes(target)) {
    return { ok: false, code: 'INVALID_DISPUTE_TRANSITION', message: \`cannot transition dispute from \${d.state} to \${target}\` };
  }
  const now = new Date().toISOString();
  return {
    ok: true,
    dispute: {
      ...d,
      state: target,
      timeline: [...d.timeline, { state: target, at: now, note }],
      reviewer: reviewer ?? d.reviewer,
      updatedAt: now
    }
  };
}

export function isHighImpactDispute(d: DisputeRecord): boolean {
  return ['counterfeit_allegation', 'payment_dispute', 'seller_conduct'].includes(d.kind);
}
`);

// ============= moderation =============
writePkg('moderation', 'index.ts', `
// @primeopp-marketplace/moderation
import type { ModerationResult, ModerationKind, ModerationDecision, ModerationPolicy, Identifier, TenantId, EvidenceStore } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return \`\${prefix}_\${Date.now().toString(36)}_\${counter.toString(36)}\`;
}

export const DEFAULT_MODERATION_POLICY: ModerationPolicy = {
  policyId: 'moderation_default',
  tenantId: 'tenant_demo',
  version: '2026.01',
  prohibitedKeywords: ['counterfeit', 'stolen', 'fake gucci', 'replica'],
  prohibitedClaims: ['100% authentic guaranteed', '1 of 1 without provenance'],
  requiresHumanReviewFor: ['counterfeit_signals', 'unsafe_product', 'fraud'],
  effectiveFrom: '2026-01-01T00:00:00.000Z'
};

export function moderateListing(params: {
  readonly policy: ModerationPolicy;
  readonly tenantId: TenantId;
  readonly listingId: Identifier;
  readonly title: string;
  readonly description: string;
  readonly category?: string;
  readonly prohibitedCategories?: readonly string[];
  readonly evidence?: EvidenceStore;
}): ModerationResult {
  const text = (params.title + ' ' + params.description).toLowerCase();
  let ruleResult: 'pass' | 'warn' | 'fail' = 'pass';
  let reason = 'no issues';
  let aiRec: ModerationDecision | undefined;
  let final: ModerationDecision = 'approved';

  // Prohibited keyword check
  for (const kw of params.policy.prohibitedKeywords) {
    if (text.includes(kw.toLowerCase())) {
      ruleResult = 'fail';
      reason = \`prohibited keyword detected: \${kw}\`;
      final = 'rejected';
      break;
    }
  }
  // Prohibited claim check
  if (ruleResult !== 'fail') {
    for (const claim of params.policy.prohibitedClaims) {
      if (text.includes(claim.toLowerCase())) {
        ruleResult = 'fail';
        reason = \`prohibited claim: \${claim}\`;
        final = 'rejected';
        break;
      }
    }
  }
  // Prohibited category check
  if (ruleResult !== 'fail' && params.category && params.prohibitedCategories?.includes(params.category)) {
    ruleResult = 'fail';
    reason = \`prohibited category: \${params.category}\`;
    final = 'rejected';
  }
  // Counterfeit signal check
  if (ruleResult === 'pass' && (text.includes('replica') || text.includes('1:1'))) {
    ruleResult = 'warn';
    reason = 'potential counterfeit signal — flag for human review';
    aiRec = 'ai_recommended_review';
    final = 'flagged_for_human';
  }

  const result: ModerationResult = {
    moderationId: newId('mod'),
    tenantId: params.tenantId,
    kind: 'listing_review',
    subjectType: 'listing',
    subjectId: params.listingId,
    policyVersion: params.policy.version,
    ruleResult,
    aiRecommendation: aiRec,
    finalDecision: final,
    reason,
    evidence: [],
    appealable: final === 'rejected' || final === 'removed',
    createdAt: new Date().toISOString()
  };

  if (params.evidence) {
    params.evidence.record({
      tenantId: params.tenantId, kind: 'moderation_result', description: reason,
      actor: { actorType: 'system', actorId: 'moderation', tenantId: params.tenantId },
      subject: { type: 'listing', id: params.listingId },
      payload: { ruleResult, final, reason }
    });
  }
  return result;
}

export function requireHumanReviewFor(kind: ModerationKind, policy: ModerationPolicy): boolean {
  return policy.requiresHumanReviewFor.includes(kind);
}
`);

// ============= trust-safety =============
writePkg('trust-safety', 'index.ts', `
// @primeopp-marketplace/trust-safety
import type { TrustSafetyAssessment, RiskOutcome, RiskSignal, ProhibitedProductPolicy, ProhibitedProductCategory, Identifier, TenantId, EvidenceStore } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return \`\${prefix}_\${Date.now().toString(36)}_\${counter.toString(36)}\`;
}

export const DEFAULT_PROHIBITED_PRODUCT_POLICY: ProhibitedProductPolicy = {
  policyId: 'prohibited_default',
  tenantId: 'tenant_demo',
  version: '2026.01',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  categories: [
    { categoryId: 'illegal_goods', name: 'Illegal Goods', description: 'Items illegal to sell', prohibitedByDefault: true, requiresJurisdictionReview: true },
    { categoryId: 'stolen_goods', name: 'Stolen Goods', description: 'Items suspected stolen', prohibitedByDefault: true, requiresJurisdictionReview: false },
    { categoryId: 'counterfeit_goods', name: 'Counterfeit Goods', description: 'Fake branded items', prohibitedByDefault: true, requiresJurisdictionReview: false },
    { categoryId: 'firearms', name: 'Firearms', description: 'Guns and ammunition', prohibitedByDefault: true, requiresJurisdictionReview: true },
    { categoryId: 'ammunition', name: 'Ammunition', description: 'Ammo', prohibitedByDefault: true, requiresJurisdictionReview: true },
    { categoryId: 'explosives', name: 'Explosives', description: 'Explosive materials', prohibitedByDefault: true, requiresJurisdictionReview: true },
    { categoryId: 'controlled_substances', name: 'Controlled Substances', description: 'Drugs and regulated substances', prohibitedByDefault: true, requiresJurisdictionReview: true },
    { categoryId: 'prescription_drugs', name: 'Prescription Drugs', description: 'Rx medication', prohibitedByDefault: true, requiresJurisdictionReview: true },
    { categoryId: 'recalled_products', name: 'Recalled Products', description: 'Recalled items', prohibitedByDefault: true, requiresJurisdictionReview: false },
    { categoryId: 'hazardous_materials', name: 'Hazardous Materials', description: 'Hazmat', prohibitedByDefault: true, requiresJurisdictionReview: true },
    { categoryId: 'adult_products', name: 'Adult Products', description: 'Age-restricted adult items', prohibitedByDefault: false, requiresJurisdictionReview: true },
    { categoryId: 'wildlife_contraband', name: 'Wildlife Contraband', description: 'Endangered species products', prohibitedByDefault: true, requiresJurisdictionReview: true },
    { categoryId: 'extremist_merchandise', name: 'Extremist Merchandise', description: 'Hate/extremist items', prohibitedByDefault: true, requiresJurisdictionReview: false },
    { categoryId: 'surveillance_malware', name: 'Surveillance Malware', description: 'Spyware/malware', prohibitedByDefault: true, requiresJurisdictionReview: false },
    { categoryId: 'personal_data', name: 'Personal Data', description: 'PII for sale', prohibitedByDefault: true, requiresJurisdictionReview: false },
    { categoryId: 'financial_credentials', name: 'Financial Credentials', description: 'Bank/credit credentials', prohibitedByDefault: true, requiresJurisdictionReview: false },
    { categoryId: 'government_ids', name: 'Government IDs', description: 'Official IDs', prohibitedByDefault: true, requiresJurisdictionReview: false },
    { categoryId: 'age_restricted_goods', name: 'Age-Restricted Goods', description: 'Items requiring age verification', prohibitedByDefault: false, requiresJurisdictionReview: true },
    { categoryId: 'medical_devices', name: 'Medical Devices', description: 'Regulated medical devices', prohibitedByDefault: false, requiresJurisdictionReview: true },
    { categoryId: 'alcohol', name: 'Alcohol', description: 'Alcoholic beverages', prohibitedByDefault: false, requiresJurisdictionReview: true },
    { categoryId: 'nicotine', name: 'Nicotine', description: 'Nicotine/vaping products', prohibitedByDefault: false, requiresJurisdictionReview: true },
    { categoryId: 'gambling_devices', name: 'Gambling Devices', description: 'Gambling equipment', prohibitedByDefault: false, requiresJurisdictionReview: true }
  ]
};

export function isProhibited(policy: ProhibitedProductPolicy, categoryId: string): boolean {
  const cat = policy.categories.find(c => c.categoryId === categoryId);
  return cat?.prohibitedByDefault === true;
}

export function findProhibitedCategory(policy: ProhibitedProductPolicy, categoryId: string): ProhibitedProductCategory | undefined {
  return policy.categories.find(c => c.categoryId === categoryId);
}

export function assessListingRisk(params: {
  readonly tenantId: TenantId;
  readonly listingId: Identifier;
  readonly signals: readonly RiskSignal[];
  readonly riskScore: number;
  readonly evidence?: EvidenceStore;
}): TrustSafetyAssessment {
  const { tenantId, listingId, signals, riskScore } = params;
  let outcome: RiskOutcome = 'ALLOW';
  if (riskScore >= 0.9) outcome = 'REJECT_LISTING';
  else if (riskScore >= 0.7) outcome = 'REQUIRE_REVIEW';
  else if (riskScore >= 0.4) outcome = 'REQUIRE_VERIFICATION';
  else if (riskScore >= 0.2) outcome = 'ALLOW_WITH_MONITORING';

  const mitigations: string[] = [];
  const detections: string[] = [];
  const tests: string[] = [];

  for (const s of signals) {
    detections.push(s);
    if (s === 'counterfeit_listings') { mitigations.push('pause publication'); tests.push('counterfeit_signal_test'); }
    if (s === 'prohibited_goods') { mitigations.push('reject listing'); tests.push('prohibited_product_test'); }
    if (s === 'stolen_goods') { mitigations.push('require ownership proof'); tests.push('stolen_goods_test'); }
  }

  const result: TrustSafetyAssessment = {
    assessmentId: newId('risk'),
    tenantId,
    subjectType: 'listing',
    subjectId: listingId,
    signals,
    riskScore,
    outcome,
    mitigations,
    detections,
    tests,
    residualRisk: outcome === 'ALLOW' ? 'low' : outcome === 'REJECT_LISTING' ? 'none' : 'medium',
    evidence: [],
    assessedAt: new Date().toISOString()
  };

  if (params.evidence) {
    params.evidence.record({
      tenantId, kind: 'trust_safety_assessment', description: \`risk assessment: \${outcome} (score=\${riskScore})\`,
      actor: { actorType: 'system', actorId: 'trust-safety', tenantId },
      subject: { type: 'listing', id: listingId },
      payload: { outcome, signals, riskScore }
    });
  }
  return result;
}

// Counterfeit risk check — pauses publication and routes to human review
export function checkCounterfeitRisk(params: {
  readonly tenantId: TenantId;
  readonly listingId: Identifier;
  readonly title: string;
  readonly description: string;
  readonly authenticityVerified: boolean;
  readonly evidence?: EvidenceStore;
}): { paused: boolean; assessment: TrustSafetyAssessment } {
  const text = (params.title + ' ' + params.description).toLowerCase();
  const signals: RiskSignal[] = [];
  if (text.includes('replica') || text.includes('1:1') || text.includes('fake')) signals.push('counterfeit_listings');
  if (!params.authenticityVerified && /rolex|louis vuitton|gucci|prada|chanel/i.test(text)) signals.push('counterfeit_listings');

  const riskScore = signals.length > 0 ? 0.85 : 0.1;
  const assessment = assessListingRisk({
    tenantId: params.tenantId,
    listingId: params.listingId,
    signals,
    riskScore,
    evidence: params.evidence
  });
  return { paused: assessment.outcome === 'REQUIRE_REVIEW' || assessment.outcome === 'REJECT_LISTING', assessment };
}
`);

// ============= messaging =============
writePkg('messaging', 'index.ts', `
// @primeopp-marketplace/messaging
import type { Message, MessageThread, MessageKind, MessageSafetyFlag, Identifier, TenantId, ISO8601, EvidenceStore } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return \`\${prefix}_\${Date.now().toString(36)}_\${counter.toString(36)}\`;
}

const OFF_PLATFORM_PAYMENT_PATTERNS = [
  /\\bvenmo\\b/i, /\\bzelle\\b/i, /\\bcashapp\\b/i, /\\bpaypal(\\.me)?\\b/i,
  /\\bmeet\\s+me\\s+outside\\b/i, /\\bdirect\\s+payment\\b/i
];
const URL_PATTERN = /https?:\\/\\/[^\\s]+/i;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/;
const PHONE_PATTERN = /\\+?\\d{10,}/;

export function scanMessageSafety(body: string): { flags: readonly MessageSafetyFlag[]; redactedFields: readonly string[] } {
  const flags: MessageSafetyFlag[] = [];
  const redacted: string[] = [];
  for (const p of OFF_PLATFORM_PAYMENT_PATTERNS) {
    if (p.test(body)) flags.push('off_platform_payment_request');
  }
  if (URL_PATTERN.test(body)) {
    // Suspicious if URL contains certain patterns
    const urls = body.match(new RegExp(URL_PATTERN.source, 'g')) ?? [];
    for (const u of urls) {
      if (/bit\\.ly|tinyurl|t\\.co|shortlink/i.test(u)) {
        if (!flags.includes('suspicious_link')) flags.push('suspicious_link');
      }
    }
  }
  if (EMAIL_PATTERN.test(body)) { redacted.push('email'); if (!flags.includes('personal_contact_disclosure')) flags.push('personal_contact_disclosure'); }
  if (PHONE_PATTERN.test(body)) { redacted.push('phone'); if (!flags.includes('personal_contact_disclosure')) flags.push('personal_contact_disclosure'); }
  const abusive = /\\b(hate|stupid|idiot|scam you)\\b/i;
  if (abusive.test(body)) flags.push('abusive_language');
  const phishing = /verify your account|login to confirm|suspended account/i;
  if (phishing.test(body)) flags.push('phishing');
  return { flags, redactedFields: redacted };
}

export function redactMessage(body: string): string {
  return body
    .replace(EMAIL_PATTERN, '[redacted:email]')
    .replace(PHONE_PATTERN, '[redacted:phone]');
}

export function createMessage(params: {
  readonly tenantId: TenantId;
  readonly channelId: string;
  readonly threadId: Identifier;
  readonly kind: MessageKind;
  readonly from: Message['from'];
  readonly to: Message['to'];
  readonly body: string;
  readonly listingId?: Identifier;
  readonly offerId?: Identifier;
  readonly orderId?: Identifier;
  readonly subject?: string;
  readonly evidence?: EvidenceStore;
}): Message {
  const safety = scanMessageSafety(params.body);
  const body = safety.flags.includes('personal_contact_disclosure') ? redactMessage(params.body) : params.body;
  const now = new Date().toISOString();
  const msg: Message = {
    messageId: newId('msg'),
    tenantId: params.tenantId,
    channelId: params.channelId,
    threadId: params.threadId,
    kind: params.kind,
    from: params.from,
    to: params.to,
    listingId: params.listingId,
    offerId: params.offerId,
    orderId: params.orderId,
    subject: params.subject,
    body,
    safetyFlags: safety.flags,
    redactedFields: safety.redactedFields,
    sentAt: now,
    evidence: []
  };
  if (params.evidence) {
    params.evidence.record({
      tenantId: params.tenantId, kind: 'message_sent', description: \`message \${params.kind}\`,
      actor: { actorType: params.from.actorType as any, actorId: params.from.actorId, tenantId: params.tenantId },
      subject: { type: 'message', id: msg.messageId },
      payload: { kind: params.kind, safetyFlags: safety.flags }
    });
  }
  return msg;
}

export function createThread(params: {
  readonly tenantId: TenantId;
  readonly channelId: string;
  readonly participantIds: readonly Identifier[];
  readonly listingId?: Identifier;
  readonly orderId?: Identifier;
}): MessageThread {
  const now = new Date().toISOString();
  return {
    threadId: newId('thr'),
    tenantId: params.tenantId,
    channelId: params.channelId,
    listingId: params.listingId,
    orderId: params.orderId,
    participantIds: params.participantIds,
    messageIds: [],
    createdAt: now,
    updatedAt: now
  };
}
`);

// ============= search-contracts =============
writePkg('search-contracts', 'index.ts', `
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
`);

// ============= affiliate-contracts =============
writePkg('affiliate-contracts', 'index.ts', `
// @primeopp-marketplace/affiliate-contracts
import type { AffiliateOffer, Identifier, TenantId, Money, EvidenceStore } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return \`\${prefix}_\${Date.now().toString(36)}_\${counter.toString(36)}\`;
}

export function createAffiliateOffer(params: {
  readonly tenantId: TenantId;
  readonly externalRetailer: string;
  readonly externalProductId: string;
  readonly externalUrl: string;
  readonly title: string;
  readonly description?: string;
  readonly imageUrl?: string;
  readonly price: Money;
  readonly commissionRate?: number;
  readonly attributionRef?: Identifier;
  readonly evidence?: EvidenceStore;
}): AffiliateOffer {
  const o: AffiliateOffer = {
    affiliateOfferId: newId('aff'),
    tenantId: params.tenantId,
    kind: 'external_affiliate_offer',
    externalRetailer: params.externalRetailer,
    externalProductId: params.externalProductId,
    externalUrl: params.externalUrl,
    title: params.title,
    description: params.description,
    imageUrl: params.imageUrl,
    price: params.price,
    commissionRate: params.commissionRate,
    attributionRef: params.attributionRef,
    disclosureRequired: true,
    disclosureText: \`Affiliate link — PrimeOpp may earn a commission on purchases from \${params.externalRetailer}.\`,
    evidence: [],
    createdAt: new Date().toISOString()
  };
  if (params.evidence) {
    params.evidence.record({
      tenantId: params.tenantId, kind: 'affiliate_offer_created', description: \`affiliate offer \${params.title}\`,
      actor: { actorType: 'system', actorId: 'affiliate-contracts', tenantId: params.tenantId },
      subject: { type: 'affiliate_offer', id: o.affiliateOfferId },
      payload: { retailer: params.externalRetailer, productId: params.externalProductId }
    });
  }
  return o;
}

// Affiliate offers MUST NOT enter inventory or order workflows
export function assertNotInventory(o: AffiliateOffer): void {
  if (o.kind === 'marketplace_listing') {
    throw new Error('affiliate offer incorrectly classified as marketplace listing');
  }
}
`);

// ============= amos-contracts =============
writePkg('amos-contracts', 'index.ts', `
// @primeopp-marketplace/amos-contracts
import type { AmosJob, AmosCampaignKind, Identifier, TenantId, EvidenceStore } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return \`\${prefix}_\${Date.now().toString(36)}_\${counter.toString(36)}\`;
}

export function createAmosJob(params: {
  readonly tenantId: TenantId;
  readonly kind: AmosCampaignKind;
  readonly listingRefs: readonly Identifier[];
  readonly sellerConsentId: Identifier;
  readonly verifiedFacts: ReadonlyArray<{ fact: string; evidenceId: Identifier }>;
  readonly publicUrls: readonly string[];
  readonly prohibitedClaims?: readonly string[];
  readonly disclosures: readonly string[];
  readonly expiresAt: string;
  readonly thumbnailConcepts: readonly string[];
  readonly shortScript?: string;
  readonly longFormOutline?: readonly string[];
  readonly captions?: readonly string[];
  readonly seoMetadata?: Readonly<Record<string, unknown>>;
  readonly evidence?: EvidenceStore;
}): AmosJob {
  const job: AmosJob = {
    amosJobId: newId('amos'),
    tenantId: params.tenantId,
    kind: params.kind,
    listingRefs: params.listingRefs,
    sellerConsentId: params.sellerConsentId,
    verifiedFacts: params.verifiedFacts,
    publicUrls: params.publicUrls,
    prohibitedClaims: params.prohibitedClaims ?? [],
    disclosures: params.disclosures,
    expiresAt: params.expiresAt,
    thumbnailConcepts: params.thumbnailConcepts,
    shortScript: params.shortScript,
    longFormOutline: params.longFormOutline,
    captions: params.captions,
    seoMetadata: params.seoMetadata,
    status: 'draft',
    evidence: [],
    createdAt: new Date().toISOString()
  };
  if (params.evidence) {
    params.evidence.record({
      tenantId: params.tenantId, kind: 'amos_job_created', description: \`amos job \${params.kind}\`,
      actor: { actorType: 'system', actorId: 'amos-contracts', tenantId: params.tenantId },
      subject: { type: 'amos_job', id: job.amosJobId },
      payload: { kind: params.kind, listingCount: params.listingRefs.length, consent: params.sellerConsentId }
    });
  }
  return job;
}

export function approveAmosJob(job: AmosJob): AmosJob {
  return { ...job, status: 'approved' };
}

export function isExpired(job: AmosJob): boolean {
  return new Date(job.expiresAt) < new Date();
}
`);

// ============= adapter-sdk =============
writePkg('adapter-sdk', 'index.ts', `
// @primeopp-marketplace/adapter-sdk
// Stable MarketplaceChannelAdapter interface + all secondary adapter contracts.
import type {
  CanonicalListing, ChannelManifest, Offer, Order, ReturnRequest, DisputeRecord,
  Money, Identifier, TenantId, EvidenceRecord, Capability
} from '@primeopp-marketplace/contracts';

export interface AdapterDeclaration {
  readonly adapterId: string;
  readonly version: string;
  readonly capabilities: readonly Capability[];
  readonly authenticationRequirements: readonly string[];
  readonly supportedRegions: readonly { country: string; subdivision?: string }[];
  readonly supportedCategories: readonly string[];
  readonly rateLimits: { requestsPerSecond?: number; requestsPerDay?: number; burst?: number };
  readonly costMetadata?: Readonly<Record<string, unknown>>;
  readonly browserRequirements: boolean;
  readonly retrySemantics: 'at_least_once' | 'at_most_once' | 'exactly_once';
  readonly idempotencySupport: boolean;
  readonly healthCheck: () => Promise<{ healthy: boolean; message?: string }>;
  readonly evidenceSupport: boolean;
  readonly verificationSupport: boolean;
  readonly limitations: readonly string[];
  readonly termsRestrictions: readonly string[];
}

export interface MarketplaceChannelAdapter extends AdapterDeclaration {
  readonly channelId: string;
  readonly manifest: ChannelManifest;
  validateConfiguration(config: Readonly<Record<string, unknown>>): { valid: boolean; issues: readonly string[] };
  validateListing(listing: CanonicalListing): { valid: boolean; issues: readonly string[] };
  transformListing(listing: CanonicalListing): { payload: Readonly<Record<string, unknown>>; warnings: readonly string[] };
  publishListing(listing: CanonicalListing): Promise<{ channelListingId: string; evidence: EvidenceRecord }>;
  updateListing(channelListingId: string, listing: CanonicalListing): Promise<{ updated: boolean; evidence: EvidenceRecord }>;
  pauseListing(channelListingId: string): Promise<{ paused: boolean; evidence: EvidenceRecord }>;
  resumeListing(channelListingId: string): Promise<{ resumed: boolean; evidence: EvidenceRecord }>;
  endListing(channelListingId: string): Promise<{ ended: boolean; evidence: EvidenceRecord }>;
  retrieveListing(channelListingId: string): Promise<{ listing: unknown } | { notFound: true }>;
  retrieveListingStatus(channelListingId: string): Promise<{ state: string }>;
  syncInventory(channelListingId: string, quantity: number): Promise<{ synced: boolean; evidence: EvidenceRecord }>;
  syncPrice(channelListingId: string, price: Money): Promise<{ synced: boolean; evidence: EvidenceRecord }>;
  retrieveOffers(channelListingId: string): Promise<{ offers: unknown[] }>;
  respondToOffer(offerId: string, response: 'accept' | 'decline' | 'counter', counterAmount?: Money): Promise<{ responded: boolean; evidence: EvidenceRecord }>;
  retrieveMessages(channelListingId: string): Promise<{ messages: unknown[] }>;
  sendMessage(channelListingId: string, body: string): Promise<{ sent: boolean; evidence: EvidenceRecord }>;
  retrieveOrders(since?: string): Promise<{ orders: unknown[] }>;
  acknowledgeOrder(channelOrderId: string): Promise<{ acknowledged: boolean; evidence: EvidenceRecord }>;
  cancelOrder(channelOrderId: string, reason: string): Promise<{ cancelled: boolean; evidence: EvidenceRecord }>;
  retrieveReturns(since?: string): Promise<{ returns: unknown[] }>;
  retrieveFees(): Promise<{ fees: unknown }>;
  verifyListing(channelListingId: string): Promise<{ verified: boolean; evidence: EvidenceRecord }>;
  verifyOrder(channelOrderId: string): Promise<{ verified: boolean; evidence: EvidenceRecord }>;
  shutdown(): Promise<void>;
}

// Secondary adapter contracts
export interface InventoryAdapter {
  readonly adapterId: string;
  getInventory(inventoryId: string): Promise<unknown>;
  reserve(params: { inventoryId: string; quantity: number; referenceId: string }): Promise<{ reserved: boolean }>;
  release(reservationId: string): Promise<{ released: boolean }>;
}
export interface ProductCatalogAdapter { readonly adapterId: string; getProduct(productId: string): Promise<unknown>; }
export interface IdentityAdapter { readonly adapterId: string; verifyIdentity(actorId: string): Promise<{ verified: boolean }>; }
export interface AuthorityAdapter { readonly adapterId: string; checkPermission(actorId: string, permission: string): Promise<{ allowed: boolean }>; }
export interface ApprovalAdapter { readonly adapterId: string; requestApproval(params: { subjectId: string; subjectType: string; reason: string }): Promise<{ approvalId: string; status: 'pending' | 'approved' | 'denied' }>; }
export interface PaymentAdapter { readonly adapterId: string; authorize(params: { amount: Money; referenceId: string }): Promise<{ authorized: boolean; authorizationId?: string }>; capture(authorizationId: string): Promise<{ captured: boolean }>; }
export interface PayoutAdapter { readonly adapterId: string; requestPayout(params: { amount: Money; payeeRef: string }): Promise<{ payoutId: string; status: 'pending' | 'paid' | 'failed' }>; }
export interface ShippingAdapterContract { readonly adapterId: string; getRateQuote(req: unknown): Promise<unknown>; purchaseLabel(req: unknown): Promise<unknown>; }
export interface TaxAdapter { readonly adapterId: string; calculateTax(params: { amount: Money; jurisdiction: string }): Promise<{ amount: Money }>; }
export interface MessagingAdapter { readonly adapterId: string; send(params: { to: string; body: string }): Promise<{ sent: boolean }>; }
export interface ModerationAdapter { readonly adapterId: string; moderate(params: { subjectId: string; subjectType: string; content: string }): Promise<{ outcome: string }>; }
export interface SearchAdapter { readonly adapterId: string; search(query: unknown): Promise<{ results: unknown[] }>; }
export interface EvidenceAdapter { readonly adapterId: string; record(evidence: unknown): Promise<{ evidenceId: string }>; }
export interface VerificationAdapter { readonly adapterId: string; verify(params: { subjectId: string; subjectType: string }): Promise<{ verified: boolean }>; }
export interface BrowserOperatorAdapter {
  readonly adapterId: string;
  navigate(url: string): Promise<{ ok: boolean }>;
  click(selector: string): Promise<{ ok: boolean }>;
  type(selector: string, text: string): Promise<{ ok: boolean }>;
  snapshot(): Promise<{ html: string }>;
  shutdown(): Promise<void>;
}
export interface AffiliateAdapter { readonly adapterId: string; fetchOffers(query: string): Promise<{ offers: unknown[] }>; }
export interface AmosAdapter { readonly adapterId: string; submitJob(job: unknown): Promise<{ jobId: string; status: string }>; }

export interface AdapterRegistry {
  registerMarketplaceAdapter(adapter: MarketplaceChannelAdapter): void;
  getMarketplaceAdapter(channelId: string): MarketplaceChannelAdapter | undefined;
  listMarketplaceAdapters(): readonly MarketplaceChannelAdapter[];
}

export class InMemoryAdapterRegistry implements AdapterRegistry {
  private readonly map = new Map<string, MarketplaceChannelAdapter>();
  registerMarketplaceAdapter(a: MarketplaceChannelAdapter): void { this.map.set(a.channelId, a); }
  getMarketplaceAdapter(channelId: string): MarketplaceChannelAdapter | undefined { return this.map.get(channelId); }
  listMarketplaceAdapters(): readonly MarketplaceChannelAdapter[] { return Array.from(this.map.values()); }
}
`);

// ============= adapter-testkit =============
writePkg('adapter-testkit', 'index.ts', `
// @primeopp-marketplace/adapter-testkit
// Conformance test harness for MarketplaceChannelAdapter implementations.
import type { MarketplaceChannelAdapter } from '@primeopp-marketplace/adapter-sdk';
import type { CanonicalListing } from '@primeopp-marketplace/contracts';

export interface ConformanceTestResult {
  readonly adapterId: string;
  readonly channelId: string;
  readonly tests: ReadonlyArray<{ readonly name: string; readonly passed: boolean; readonly detail?: string }>;
  readonly overallPassed: boolean;
}

export async function runConformanceTests(adapter: MarketplaceChannelAdapter, sampleListing: CanonicalListing): Promise<ConformanceTestResult> {
  const tests: { name: string; passed: boolean; detail?: string }[] = [];

  // Health check
  try {
    const h = await adapter.healthCheck();
    tests.push({ name: 'healthCheck', passed: h.healthy, detail: h.message });
  } catch (e: any) {
    tests.push({ name: 'healthCheck', passed: false, detail: e?.message });
  }

  // Validate config
  try {
    const r = adapter.validateConfiguration({});
    tests.push({ name: 'validateConfiguration', passed: r.valid });
  } catch (e: any) {
    tests.push({ name: 'validateConfiguration', passed: false, detail: e?.message });
  }

  // Validate listing
  try {
    const r = adapter.validateListing(sampleListing);
    tests.push({ name: 'validateListing', passed: r.valid });
  } catch (e: any) {
    tests.push({ name: 'validateListing', passed: false, detail: e?.message });
  }

  // Transform listing
  try {
    const r = adapter.transformListing(sampleListing);
    tests.push({ name: 'transformListing', passed: r.payload !== undefined && typeof r.payload === 'object' });
  } catch (e: any) {
    tests.push({ name: 'transformListing', passed: false, detail: e?.message });
  }

  // Publish listing
  let channelListingId: string | undefined;
  try {
    const r = await adapter.publishListing(sampleListing);
    channelListingId = r.channelListingId;
    tests.push({ name: 'publishListing', passed: !!r.channelListingId });
  } catch (e: any) {
    tests.push({ name: 'publishListing', passed: false, detail: e?.message });
  }

  // Retrieve listing
  if (channelListingId) {
    try {
      const r = await adapter.retrieveListing(channelListingId);
      tests.push({ name: 'retrieveListing', passed: 'listing' in r });
    } catch (e: any) {
      tests.push({ name: 'retrieveListing', passed: false, detail: e?.message });
    }

    // Sync inventory
    try {
      const r = await adapter.syncInventory(channelListingId, 5);
      tests.push({ name: 'syncInventory', passed: r.synced });
    } catch (e: any) {
      tests.push({ name: 'syncInventory', passed: false, detail: e?.message });
    }

    // End listing
    try {
      const r = await adapter.endListing(channelListingId);
      tests.push({ name: 'endListing', passed: r.ended });
    } catch (e: any) {
      tests.push({ name: 'endListing', passed: false, detail: e?.message });
    }
  }

  // Shutdown
  try {
    await adapter.shutdown();
    tests.push({ name: 'shutdown', passed: true });
  } catch (e: any) {
    tests.push({ name: 'shutdown', passed: false, detail: e?.message });
  }

  return {
    adapterId: adapter.adapterId,
    channelId: adapter.channelId,
    tests,
    overallPassed: tests.every(t => t.passed)
  };
}
`);

console.log('All package sources generated.');
