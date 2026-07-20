// File-backed CatalogStorageAdapter.
//
// The only shipped CatalogStorageAdapter implementation in
// @primeopp/canonical-catalog is InMemoryCatalogStorage, which is wiped on
// every process exit -- unusable for a CLI where each invocation is a fresh
// process. This adapter persists the same Product records to a single JSON
// file so canonical products survive across CLI runs.
//
// Behavior mirrors InMemoryCatalogStorage exactly (same key scheme, same
// filters); only the backing store differs.

import type { CatalogStorageAdapter } from '@primeopp/canonical-catalog';
import type { Product, TenantId } from '@primeopp/contracts';
import { readJsonFile, writeJsonFileAtomic } from './json-file.ts';

interface CatalogFileShape {
  products: Record<string, Product>;
}

export class FileCatalogStorage implements CatalogStorageAdapter {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  private key(tenantId: string, productId: string): string {
    return `${tenantId}|${productId}`;
  }

  private async load(): Promise<CatalogFileShape> {
    return readJsonFile<CatalogFileShape>(this.filePath, { products: {} });
  }

  async get(tenantId: TenantId, productId: string): Promise<Product | undefined> {
    const data = await this.load();
    return data.products[this.key(tenantId, productId)];
  }

  async upsert(product: Product): Promise<void> {
    const data = await this.load();
    data.products[this.key(product.tenantId, product.id)] = product;
    await writeJsonFileAtomic(this.filePath, data);
  }

  async list(tenantId: TenantId, opts: { includeArchived?: boolean } = {}): Promise<Product[]> {
    const data = await this.load();
    return Object.values(data.products).filter((p) => {
      if (p.tenantId !== tenantId) return false;
      if (!opts.includeArchived && p.archived) return false;
      return true;
    });
  }

  async search(
    tenantId: TenantId,
    query: { title?: string; brand?: string; identifier?: string }
  ): Promise<Product[]> {
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
