export { ingestProduct } from './orchestrator.ts';
export type { IngestProductOptions, IngestProductResult } from './orchestrator.ts';

export { FileCatalogStorage } from './storage/file-catalog-storage.ts';
export { FileIntakeStore } from './storage/file-intake-store.ts';
export { CatalogBackedIdentityAdapter } from './identity/catalog-backed-adapter.ts';
export { createLocalEnrichmentProviders } from './enrichment-providers.ts';
