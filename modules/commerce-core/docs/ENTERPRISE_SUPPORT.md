# Enterprise Support

Enterprise types and helpers live in `packages/tenant-config/src/index.ts`.

## Hierarchy

Tenant → Organization → Team/Seller → User
Tenant → Locations (Warehouse, Store, Vehicle, Bin, Virtual, Consignment, Donor)

## Multi-Location Inventory

The inventory engine supports multiple locations per tenant. Each location has its own `InventoryRecord`. Transfers between locations are modeled as a TRANSFER (out) at the source plus an ADJUST (in) at the destination.

## Role-Based Access

Roles carry permission arrays. The `assertTenantAccess` and `assertOrganizationAccess` guards enforce scope checks at every read/write.

## Enterprise Extensions

- bulk import / bulk update (via SDK batch methods)
- batch scan (via offline scan queue)
- multiple locations (via inventory storage adapter)
- approval thresholds (per tenant and per organization)
- inventory transfer (via TRANSFER operation)
- audit history (via catalog audit log)
- API contracts (all SDK methods are public)
- custom taxonomy (via `ProductCategory` with arbitrary taxonomy name)
- organization-level pricing policy (via `TenantConfig.pricingPolicy`)
- employee permissions (via roles)

## Critical Rule

**Do not build a competing identity or authorization platform.** This package only exposes integration contracts for an external identity runtime.
