# Adapter SDK

14 adapter interfaces: RetailerApiAdapter, RetailerFeedAdapter,
RetailerCrawlerAdapter, BrowserOperatorAdapter, AffiliateAdapter,
HistoricalPriceAdapter, ProductIdentityAdapter, MarketplaceCompAdapter,
AlertChannelAdapter, PublishingAdapter, CommunityModerationAdapter,
AmosAdapter, StorageAdapter, EvidenceAdapter.

Every adapter declares: adapterId, version, capabilities, supported
retailers, regions, authentication requirements, terms restrictions,
rate limits, cost metadata, health check, retry semantics, confidence,
freshness, evidence support, browser requirement, legal review status,
testOnly (when applicable).

`InMemoryAdapterRegistry` provides lookup by id and type.
`conformanceChecks` enforces the required fields.
