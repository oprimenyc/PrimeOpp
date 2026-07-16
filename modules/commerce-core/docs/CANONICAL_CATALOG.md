# Canonical Catalog

The canonical catalog lives in `packages/canonical-catalog/src/index.ts`.

## Tenant-Aware Records

Every product record is tenant-scoped. The catalog enforces tenant isolation: a read for tenant B will never return a record created by tenant A.

## Operations

- `create(product, actor)` — initial creation
- `update(productId, mutator, scope, actor)` — versioned update
- `merge(sourceId, targetId, scope, actor, evidenceRefs)` — combine identifiers, soft-delete source
- `split(productId, scope, actor, evidenceRefs)` — copy a product to a new ID with provenance
- `archive(productId, scope, actor)` — soft-delete
- `unarchive(productId, scope, actor)` — restore
- `list(scope, opts)` — list (excludes archived by default)
- `search(scope, query)` — search by title, brand, or identifier

## Audit Log

Every mutating operation appends to `CatalogAuditLog`. Each entry records:

- action (CREATE, UPDATE, MERGE, SPLIT, ARCHIVE, UNARCHIVE, SOFT_DELETE)
- actor
- before / after snapshot
- evidence refs

## Stale Data Detection

`detectStaleProducts(products, maxAgeSeconds)` returns products whose `updatedAt` is older than the threshold.

## Duplicate Detection

`detectDuplicates(products)` returns a map of identifier → product IDs that share that identifier.
