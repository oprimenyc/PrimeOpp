// Canonical catalog — Phase 8.
// Tenant-aware canonical product catalog with versioning, archival, audit.

import type {
  BarcodeFormat,
  Confidence,
  ConditionAssessment,
  Identified,
  IdentifierType,
  ProductAcquisition,
  ProductConfidence,
  ProductFulfillmentMode,
  ProductIdentifier,
  ProductKind,
  ProductListingState,
  ProductOwnership,
  ProductSource,
  Product,
  TenantId,
  TenantScoped,
  Timestamped,
} from '@primeopp/contracts';
import { clamp01, hashString, nowUtc, PRODUCT_SCHEMA_VERSION, stableStringify, uuid } from '@primeopp/contracts';
import type { ResolutionResult } from '@primeopp/product-identity';

export interface CatalogStorageAdapter {
  get(tenantId: TenantId, productId: string): Promise<Product | undefined>;
  upsert(product: Product): Promise<void>;
  list(tenantId: TenantId, opts?: { includeArchived?: boolean }): Promise<Product[]>;
  search(tenantId: TenantId, query: { title?: string; brand?: string; identifier?: string }): Promise<Product[]>;
}

export class InMemoryCatalogStorage implements CatalogStorageAdapter {
  private readonly products = new Map<string, Product>(); // key: tenantId|productId

  private key(tenantId: string, productId: string): string {
    return `${tenantId}|${productId}`;
  }

  async get(tenantId: TenantId, productId: string): Promise<Product | undefined> {
    return this.products.get(this.key(tenantId, productId));
  }

  async upsert(product: Product): Promise<void> {
    this.products.set(this.key(product.tenantId, product.id), product);
  }

  async list(tenantId: TenantId, opts: { includeArchived?: boolean } = {}): Promise<Product[]> {
    return Array.from(this.products.values()).filter((p) => {
      if (p.tenantId !== tenantId) return false;
      if (!opts.includeArchived && p.archived) return false;
      return true;
    });
  }

  async search(tenantId: TenantId, query: { title?: string; brand?: string; identifier?: string }): Promise<Product[]> {
    const all = await this.list(tenantId);
    return all.filter((p) => {
      if (query.title && !p.title.toLowerCase().includes(query.title.toLowerCase())) return false;
      if (query.brand && (!p.brand || p.brand.normalized !== query.brand.toUpperCase())) return false;
      if (query.identifier) {
        const has = p.identifiers.some((i) => i.value === query.identifier);
        if (!has) return false;
      }
      return true;
    });
  }
}

// ---------------------------------------------------------------------------
// Catalog operations
// ---------------------------------------------------------------------------

export interface CatalogAuditEntry extends Identified, Timestamped {
  tenantId: TenantId;
  productId: string;
  action: 'CREATE' | 'UPDATE' | 'MERGE' | 'SPLIT' | 'ARCHIVE' | 'UNARCHIVE' | 'SOFT_DELETE';
  actor: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  evidenceRefs: string[];
}

export interface CatalogAuditLog {
  append(entry: CatalogAuditEntry): void;
  list(tenantId: TenantId, productId?: string): CatalogAuditEntry[];
}

export class InMemoryCatalogAuditLog implements CatalogAuditLog {
  private readonly entries: CatalogAuditEntry[] = [];
  append(entry: CatalogAuditEntry): void {
    this.entries.push(entry);
  }
  list(tenantId: TenantId, productId?: string): CatalogAuditEntry[] {
    return this.entries.filter((e) => e.tenantId === tenantId && (productId === undefined || e.productId === productId));
  }
}

// ---------------------------------------------------------------------------
// Catalog service
// ---------------------------------------------------------------------------

export interface CanonicalCatalogOptions {
  storage: CatalogStorageAdapter;
  auditLog?: CatalogAuditLog;
}

export class CanonicalCatalog {
  private readonly opts: CanonicalCatalogOptions;
  constructor(opts: CanonicalCatalogOptions) {
    this.opts = opts;
  }

  async create(product: Product, actor: string): Promise<Product> {
    if (product.archived) throw new Error('cannot create an archived product');
    const existing = await this.opts.storage.get(product.tenantId, product.id);
    if (existing) throw new Error(`CANONICAL_PRODUCT_ALREADY_EXISTS: ${product.id}`);
    await this.opts.storage.upsert(product);
    this.appendAudit(product, 'CREATE', actor, undefined, product);
    return product;
  }

  async update(productId: string, mutator: (p: Product) => Product, scope: TenantScoped, actor: string): Promise<Product> {
    const existing = await this.opts.storage.get(scope.tenantId, productId);
    if (!existing) throw new Error(`PRODUCT_NOT_FOUND: ${productId}`);
    if (existing.archived) throw new Error('cannot update an archived product — unarchive first');
    const updated: Product = {
      ...mutator(existing),
      version: existing.version + 1,
      updatedAt: nowUtc(),
    };
    await this.opts.storage.upsert(updated);
    this.appendAudit(updated, 'UPDATE', actor, existing, updated);
    return updated;
  }

  async merge(sourceId: string, targetId: string, scope: TenantScoped, actor: string, evidenceRefs: string[]): Promise<Product> {
    if (sourceId === targetId) throw new Error('cannot merge a product with itself');
    const source = await this.opts.storage.get(scope.tenantId, sourceId);
    const target = await this.opts.storage.get(scope.tenantId, targetId);
    if (!source || !target) throw new Error('merge requires both source and target products to exist');

    // Merge identifiers from source into target.
    const mergedIdentifiers = [...target.identifiers];
    for (const id of source.identifiers) {
      if (!mergedIdentifiers.some((i) => i.type === id.type && i.value === id.value)) {
        mergedIdentifiers.push(id);
      }
    }
    const merged: Product = {
      ...target,
      identifiers: mergedIdentifiers,
      provenance: {
        ...target.provenance,
        lineage: [
          ...target.provenance.lineage,
          { action: 'merge', at: nowUtc(), actor, evidenceRef: evidenceRefs[0] },
        ],
      },
      version: target.version + 1,
      updatedAt: nowUtc(),
    };
    await this.opts.storage.upsert(merged);

    // Soft-delete source.
    const archivedSource: Product = { ...source, archived: true, updatedAt: nowUtc(), version: source.version + 1 };
    await this.opts.storage.upsert(archivedSource);

    this.appendAudit(merged, 'MERGE', actor, target, merged);
    this.appendAudit(archivedSource, 'ARCHIVE', actor, source, archivedSource);
    return merged;
  }

  async split(productId: string, scope: TenantScoped, actor: string, evidenceRefs: string[]): Promise<{ original: Product; newProduct: Product }> {
    const original = await this.opts.storage.get(scope.tenantId, productId);
    if (!original) throw new Error(`PRODUCT_NOT_FOUND: ${productId}`);
    // Splitting creates a new product record that is a copy with a new ID.
    const newProduct: Product = {
      ...original,
      id: uuid(),
      provenance: {
        ...original.provenance,
        lineage: [
          ...original.provenance.lineage,
          { action: 'split', at: nowUtc(), actor, evidenceRef: evidenceRefs[0] },
        ],
      },
      version: 0,
      createdAt: nowUtc(),
      updatedAt: nowUtc(),
    };
    await this.opts.storage.upsert(newProduct);

    const updatedOriginal: Product = {
      ...original,
      provenance: {
        ...original.provenance,
        lineage: [
          ...original.provenance.lineage,
          { action: 'split-source', at: nowUtc(), actor, evidenceRef: evidenceRefs[0] },
        ],
      },
      version: original.version + 1,
      updatedAt: nowUtc(),
    };
    await this.opts.storage.upsert(updatedOriginal);

    this.appendAudit(updatedOriginal, 'UPDATE', actor, original, updatedOriginal);
    this.appendAudit(newProduct, 'CREATE', actor, undefined, newProduct);
    return { original: updatedOriginal, newProduct };
  }

  async archive(productId: string, scope: TenantScoped, actor: string): Promise<Product> {
    const existing = await this.opts.storage.get(scope.tenantId, productId);
    if (!existing) throw new Error(`PRODUCT_NOT_FOUND: ${productId}`);
    const archived: Product = { ...existing, archived: true, updatedAt: nowUtc(), version: existing.version + 1 };
    await this.opts.storage.upsert(archived);
    this.appendAudit(archived, 'ARCHIVE', actor, existing, archived);
    return archived;
  }

  async unarchive(productId: string, scope: TenantScoped, actor: string): Promise<Product> {
    const existing = await this.opts.storage.get(scope.tenantId, productId);
    if (!existing) throw new Error(`PRODUCT_NOT_FOUND: ${productId}`);
    const unarchived: Product = { ...existing, archived: false, updatedAt: nowUtc(), version: existing.version + 1 };
    await this.opts.storage.upsert(unarchived);
    this.appendAudit(unarchived, 'UNARCHIVE', actor, existing, unarchived);
    return unarchived;
  }

  async get(productId: string, scope: TenantScoped): Promise<Product | undefined> {
    return this.opts.storage.get(scope.tenantId, productId);
  }

  async list(scope: TenantScoped, opts: { includeArchived?: boolean } = {}): Promise<Product[]> {
    return this.opts.storage.list(scope.tenantId, opts);
  }

  async search(scope: TenantScoped, query: { title?: string; brand?: string; identifier?: string }): Promise<Product[]> {
    return this.opts.storage.search(scope.tenantId, query);
  }

  private appendAudit(product: Product, action: CatalogAuditEntry['action'], actor: string, before: Product | undefined, after: Product): void {
    if (!this.opts.auditLog) return;
    this.opts.auditLog.append({
      id: uuid(),
      tenantId: product.tenantId,
      productId: product.id,
      action,
      actor,
      ...(before ? { before: before as unknown as Record<string, unknown> } : {}),
      after: after as unknown as Record<string, unknown>,
      evidenceRefs: [],
      createdAt: nowUtc(),
      updatedAt: nowUtc(),
    });
  }
}

// ---------------------------------------------------------------------------
// Resolution result -> canonical product creation
// ---------------------------------------------------------------------------

export type CanonicalProductCreationSourceKind = Extract<ProductSource['kind'], 'AI_ENRICHMENT' | 'SCAN'>;

export interface CanonicalProductCreationSourceInput {
  kind: CanonicalProductCreationSourceKind;
  ref: string;
  observedAt: string;
  confidence?: Confidence;
}

export interface CanonicalProductCreationContext {
  actor: string;
  ownership: ProductOwnership;
  kind: ProductKind;
  listingState: ProductListingState;
  fulfillmentMode: ProductFulfillmentMode;
  source: CanonicalProductCreationSourceInput;
  acquisition?: ProductAcquisition;
  condition?: ConditionAssessment;
  productId?: string;
}

export interface CanonicalProductCreationResult {
  product: Product;
  warnings: string[];
}

export function buildCanonicalProductFromResolutionResult(
  resolution: ResolutionResult,
  context: CanonicalProductCreationContext
): CanonicalProductCreationResult {
  assertNoMatchResolution(resolution);
  assertCreationContext(resolution, context);

  const warnings = [...resolution.warnings];
  const createdAt = resolution.createdAt;
  const updatedAt = resolution.updatedAt;
  const productId = context.productId?.trim() || deterministicProductId(resolution, context);
  const sourceConfidence = clamp01(context.source.confidence ?? resolution.confidence);
  const source: ProductSource = {
    kind: context.source.kind,
    ref: context.source.ref.trim(),
    observedAt: context.source.observedAt,
    confidence: sourceConfidence,
  };
  const identityConfidence = clamp01(resolution.confidence);
  const identifiers = identifiersFromResolution(resolution, source, identityConfidence, warnings);
  const category = categoryFromResolution(resolution, identityConfidence);
  const brand = trimmed(resolution.input.brand);
  const model = trimmed(resolution.input.model);
  const title = trimmed(resolution.input.title);
  if (!title) {
    throw new Error(`CANONICAL_PRODUCT_TITLE_REQUIRED: resolution ${resolution.id} cannot create a Product without input.title`);
  }

  const confidence: ProductConfidence = {
    overall: identityConfidence,
    identity: identityConfidence,
    variant: 0,
    condition: context.condition ? clamp01(context.condition.confidence) : 0,
    pricing: 0,
    rationale: `Created from identity resolution ${resolution.id} with state ${resolution.state}`,
  };

  const product: Product = {
    id: productId,
    schemaVersion: PRODUCT_SCHEMA_VERSION,
    kind: context.kind,
    title,
    ...(brand ? { brand: { name: brand, normalized: brand.toUpperCase(), confidence: identityConfidence, source: source.ref } } : {}),
    ...(model ? { model: { name: model, normalized: model.toUpperCase(), ...(brand ? { brand: brand.toUpperCase() } : {}), confidence: identityConfidence, source: source.ref } } : {}),
    ...(category ? { category } : {}),
    attributes: [],
    identifiers,
    variants: [],
    ...(context.condition ? { condition: context.condition } : {}),
    images: [],
    documents: [],
    source,
    provenance: {
      originSource: source,
      observations: [source],
      lineage: [{ action: 'create-from-resolution', at: createdAt, actor: context.actor, evidenceRef: resolution.evidenceRefs[0] }],
    },
    ownership: context.ownership,
    listingState: context.listingState,
    fulfillmentMode: context.fulfillmentMode,
    channelState: {},
    evidence: { evidenceRefs: resolution.evidenceRefs, confidence: identityConfidence },
    confidence,
    ...(context.acquisition ? { acquisition: context.acquisition } : {}),
    version: 0,
    tenantId: resolution.tenantId,
    ...(context.ownership.organizationId ? { organizationId: context.ownership.organizationId } : {}),
    createdAt,
    updatedAt,
  };

  return { product, warnings };
}

export async function createCanonicalProductFromResolutionResult(
  catalog: CanonicalCatalog,
  resolution: ResolutionResult,
  context: CanonicalProductCreationContext
): Promise<CanonicalProductCreationResult> {
  const result = buildCanonicalProductFromResolutionResult(resolution, context);
  const product = await catalog.create(result.product, context.actor);
  return { product, warnings: result.warnings };
}

function assertNoMatchResolution(resolution: ResolutionResult): void {
  if (resolution.state !== 'NO_MATCH') {
    throw new Error(`CANONICAL_PRODUCT_CREATION_REJECTED: resolution ${resolution.id} state is ${resolution.state}; only NO_MATCH can create a new canonical product`);
  }
  if (resolution.selectedCandidateId || resolution.candidates.length > 0) {
    throw new Error(`CANONICAL_PRODUCT_CREATION_REJECTED: resolution ${resolution.id} has existing candidates and must not create a duplicate canonical product`);
  }
}

function assertCreationContext(resolution: ResolutionResult, context: CanonicalProductCreationContext): void {
  if (!trimmed(context.actor)) throw new Error('CANONICAL_PRODUCT_ACTOR_REQUIRED: actor must be supplied');
  if (!context.ownership || !trimmed(context.ownership.tenantId)) {
    throw new Error('CANONICAL_PRODUCT_OWNERSHIP_REQUIRED: ownership.tenantId must be supplied');
  }
  if (context.ownership.tenantId !== resolution.tenantId) {
    throw new Error(`TENANT_SCOPE_MISMATCH: ownership tenant ${context.ownership.tenantId} does not match resolution tenant ${resolution.tenantId}`);
  }
  if (typeof context.ownership.private !== 'boolean') {
    throw new Error('CANONICAL_PRODUCT_OWNERSHIP_REQUIRED: ownership.private must be explicitly supplied');
  }
  if (!trimmed(context.source.ref)) throw new Error('CANONICAL_PRODUCT_SOURCE_REQUIRED: source.ref must be supplied');
  if (context.source.kind !== 'AI_ENRICHMENT' && context.source.kind !== 'SCAN') {
    throw new Error('CANONICAL_PRODUCT_SOURCE_KIND_UNSUPPORTED: source.kind must be AI_ENRICHMENT or SCAN');
  }
  if (Number.isNaN(new Date(context.source.observedAt).getTime())) {
    throw new Error('CANONICAL_PRODUCT_SOURCE_OBSERVED_AT_REQUIRED: source.observedAt must be ISO 8601 parseable');
  }
}

function deterministicProductId(resolution: ResolutionResult, context: CanonicalProductCreationContext): string {
  return `product_${hashString(stableStringify({
    tenantId: resolution.tenantId,
    organizationId: context.ownership.organizationId,
    input: resolution.input,
  }))}`;
}

function identifiersFromResolution(
  resolution: ResolutionResult,
  source: ProductSource,
  confidence: Confidence,
  warnings: string[]
): ProductIdentifier[] {
  const identifiers: ProductIdentifier[] = [];
  if (resolution.input.barcode) {
    identifiers.push({
      type: identifierTypeFromBarcodeFormat(resolution.input.barcode.format),
      value: resolution.input.barcode.normalizedValue,
      source: source.ref,
      verification: resolution.input.barcode.checkDigitValid ? 'CHECK_DIGIT_VALID' : 'INVALID',
      confidence,
      observedAt: source.observedAt,
    });
    if (!resolution.input.barcode.checkDigitValid) {
      warnings.push(`resolution ${resolution.id} carried a barcode with an invalid check digit; identifier is preserved with verification=INVALID`);
    }
  }
  const serialNumber = trimmed(resolution.input.serialNumber);
  if (serialNumber) {
    identifiers.push({
      type: 'SERIAL_NUMBER',
      value: serialNumber,
      source: source.ref,
      verification: 'UNVERIFIED',
      confidence,
      observedAt: source.observedAt,
    });
  }
  return identifiers;
}

function identifierTypeFromBarcodeFormat(format: BarcodeFormat): IdentifierType {
  switch (format) {
    case 'UPC_A':
    case 'UPC_E':
      return format;
    case 'EAN_8':
    case 'EAN_13':
      return format;
    case 'GTIN_14':
      return 'GTIN_14';
    case 'ISBN_10':
    case 'ISBN_13':
      return format;
    case 'CODE_128':
    case 'QR':
    case 'CUSTOM':
      return 'CUSTOM';
  }
}

function categoryFromResolution(resolution: ResolutionResult, confidence: Confidence): Product['category'] | undefined {
  const category = trimmed(resolution.input.category);
  if (!category) return undefined;
  const path = category.split('>').map((part) => part.trim()).filter((part) => part.length > 0);
  const normalizedPath = path.length > 0 ? path : [category];
  return {
    taxonomy: 'resolver-input',
    path: normalizedPath,
    leaf: normalizedPath[normalizedPath.length - 1],
    confidence,
  };
}

function trimmed(value: string | undefined): string | undefined {
  const result = value?.trim();
  return result && result.length > 0 ? result : undefined;
}

// ---------------------------------------------------------------------------
// Stale data detection
// ---------------------------------------------------------------------------

/**
 * Detect products whose observations are stale (older than threshold).
 */
export function detectStaleProducts(products: Product[], maxAgeSeconds: number): Product[] {
  const now = new Date().getTime();
  return products.filter((p) => {
    const updated = new Date(p.updatedAt).getTime();
    return (now - updated) / 1000 > maxAgeSeconds;
  });
}

/**
 * Detect duplicate products within a tenant by identifier collision.
 * Returns groups of duplicates (productId groups sharing any identifier).
 */
export function detectDuplicates(products: Product[]): Map<string, string[]> {
  const byIdValue = new Map<string, string[]>();
  for (const p of products) {
    for (const id of p.identifiers) {
      const key = `${id.type}|${id.value}`;
      const list = byIdValue.get(key) ?? [];
      if (!list.includes(p.id)) list.push(p.id);
      byIdValue.set(key, list);
    }
  }
  // Only return groups with more than one product.
  const out = new Map<string, string[]>();
  for (const [key, list] of byIdValue.entries()) {
    if (list.length > 1) out.set(key, list);
  }
  return out;
}
