# Changelog

All notable changes to PrimeOpp Commerce Core are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-07-14

### Added
- Initial production build of PrimeOpp Commerce Core.
- 24 TypeScript packages covering canonical product model, identity resolution, barcode framework, OCR/image contracts, variant engine, condition engine, canonical catalog, inventory engine, acquisition & cost basis, pricing observations, pricing engine, fee engine, shipping estimator, profit & ROI engine, opportunity decision engine, listing contracts, channel contracts, PrimeOpp Marketplace default listing support, commerce events, multi-tenant & enterprise support, security & data integrity, observability, adapter SDK, SDK and CLI.
- 10 reference workflows (barcode scan, sneaker, electronics, thrift, inventory reservation, PrimeOpp Marketplace default, POD, dropship, affiliate, multi-location, cross-tenant attack, conflicting comps).
- `npm run verify` runtime proof command (24-point verification).
- `primeopp-commerce-core.zip` clean-room installable artifact.
- Documentation: README, ARCHITECTURE, DISCOVERY_REPORT, CONTRACT_COMPATIBILITY, PRODUCT_MODEL, PRODUCT_IDENTITY, BARCODE_FRAMEWORK, OCR_AND_IMAGE_CONTRACTS, VARIANT_ENGINE, CONDITION_ENGINE, CANONICAL_CATALOG, INVENTORY_ENGINE, ACQUISITION_AND_COST_BASIS, PRICING_OBSERVATIONS, PRICING_ENGINE, FEE_ENGINE, SHIPPING_ESTIMATOR, PROFIT_ENGINE, OPPORTUNITY_ENGINE, LISTING_CONTRACTS, CHANNEL_ADAPTERS, PRIMEOPP_MARKETPLACE_DEFAULT, ENTERPRISE_SUPPORT, ADAPTER_SDK, SECURITY, THREAT_MODEL, DATA_CLASSIFICATION, OBSERVABILITY, SDK_REFERENCE, CLI_REFERENCE, TESTING, OPERATIONS, PRIMEOPP_INTEGRATION_GUIDE, POD_MIGRATION_GUIDE, FOUNDRY_INTEGRATION_GUIDE, EVE_VERIFICATION_GUIDE, AMOS_INTEGRATION_GUIDE, MIGRATION, CHANGELOG.
- Mermaid diagrams for package architecture, product resolution, barcode flow, product/variant relationship, pricing pipeline, profit calculation, opportunity decision, inventory lifecycle, multi-channel listing, PrimeOpp Marketplace default flow, enterprise multi-location, future Foundry integration.

### Known Limitations
- No live marketplace, barcode, OCR, shipping or payment connectivity — all external providers are contracts + local test adapters only.
- No camera hardware integration — scanner contracts define capabilities; image-upload and external-SDK adapters are documented as seams.
- SQLite inventory adapter is implemented in-memory; persistent SQLite persistence is documented as a seam (`InventoryStorageAdapter` contract).
- No external carrier label purchasing — shipping estimator returns estimates only.
