/**
 * @primeopp-deal-intelligence/retailer-registry
 *
 * Canonical retailer registry. 20 starter retailers covering national
 * chains, membership clubs, manufacturer stores and online-only retailers.
 *
 * IMPORTANT: No retailer in this registry claims live scraping support.
 * Every entry exposes the contract for fixture-based evidence only.
 * External live verification is explicitly PENDING and must be performed
 * by a human-legal-reviewed adapter before any live retrieval is enabled.
 */
import type {
  Retailer, RetailerId, RetailerType, RegionCode, RetailerSourceMethod
} from '@primeopp-deal-intelligence/contracts';

const RETAILERS: Retailer[] = [
  {
    id: 'ret:amazon' as RetailerId,
    name: "Amazon",
    type: "national-chain" as RetailerType,
    regions: ["US"],
    domains: [{ domain: 'amazon.com', official: true, verifiedAt: '2024-01-01T00:00:00Z' }],
    sourceMethods: ['official-api', 'browser-operator', 'community-submission', 'manual-entry'],
    accessRestrictions: ["none"],
    affiliateProgram: {
      available: true,
      network: "Amazon Associates",
      programId: 'amazon-program',
      termsRef: 'terms://amazon/affiliate'
    },
    termsReference: {
      termsUrl: 'https://www.amazon.com/terms',
      robotsUrl: 'https://www.amazon.com/robots.txt',
      legalReviewStatus: 'pending'
    },
    permittedAutomationModes: ['fixture-evidence', 'manual-verification'],
    rateLimitMetadata: { requestsPerMinute: 30, burst: 5 },
    robotsPolicyRef: 'https://www.amazon.com/robots.txt',
    browserRequired: false,
    loginRequired: false,
    membershipRequired: false,
    evidenceFreshness: '2024-01-01T00:00:00Z',
    health: { status: 'unknown', lastCheckedAt: '2024-01-01T00:00:00Z' },
    promotionMethod: {
      supportsCoupons: true,
      supportsAutomaticPromotions: true,
      supportsBOGO: true,
      supportsBuyMoreSaveMore: true,
      supportsMemberPricing: false,
      supportsGiftCardPromos: true,
      supportsRebates: false
    },
    availabilityMethod: { type: 'api', granularity: 'store' },
    fulfillmentMethods: [
      { type: 'shipping', regions: ["US"] },
      { type: 'pickup', regions: ["US"] }
    ],
    evidence: []
  },
  {
    id: 'ret:walmart' as RetailerId,
    name: "Walmart",
    type: "national-chain" as RetailerType,
    regions: ["US"],
    domains: [{ domain: 'walmart.com', official: true, verifiedAt: '2024-01-01T00:00:00Z' }],
    sourceMethods: ['public-product-page', 'browser-operator', 'community-submission', 'manual-entry'],
    accessRestrictions: ["none"],
    affiliateProgram: {
      available: true,
      network: "Walmart Affiliate",
      programId: 'walmart-program',
      termsRef: 'terms://walmart/affiliate'
    },
    termsReference: {
      termsUrl: 'https://www.walmart.com/terms',
      robotsUrl: 'https://www.walmart.com/robots.txt',
      legalReviewStatus: 'pending'
    },
    permittedAutomationModes: ['fixture-evidence', 'manual-verification'],
    rateLimitMetadata: { requestsPerMinute: 30, burst: 5 },
    robotsPolicyRef: 'https://www.walmart.com/robots.txt',
    browserRequired: false,
    loginRequired: false,
    membershipRequired: false,
    evidenceFreshness: '2024-01-01T00:00:00Z',
    health: { status: 'unknown', lastCheckedAt: '2024-01-01T00:00:00Z' },
    promotionMethod: {
      supportsCoupons: true,
      supportsAutomaticPromotions: true,
      supportsBOGO: true,
      supportsBuyMoreSaveMore: true,
      supportsMemberPricing: false,
      supportsGiftCardPromos: true,
      supportsRebates: false
    },
    availabilityMethod: { type: 'api', granularity: 'store' },
    fulfillmentMethods: [
      { type: 'shipping', regions: ["US"] },
      { type: 'pickup', regions: ["US"] }
    ],
    evidence: []
  },
  {
    id: 'ret:target' as RetailerId,
    name: "Target",
    type: "national-chain" as RetailerType,
    regions: ["US"],
    domains: [{ domain: 'target.com', official: true, verifiedAt: '2024-01-01T00:00:00Z' }],
    sourceMethods: ['public-product-page', 'browser-operator', 'community-submission', 'manual-entry'],
    accessRestrictions: ["none"],
    affiliateProgram: {
      available: true,
      network: "Target Partners",
      programId: 'target-program',
      termsRef: 'terms://target/affiliate'
    },
    termsReference: {
      termsUrl: 'https://www.target.com/terms',
      robotsUrl: 'https://www.target.com/robots.txt',
      legalReviewStatus: 'pending'
    },
    permittedAutomationModes: ['fixture-evidence', 'manual-verification'],
    rateLimitMetadata: { requestsPerMinute: 30, burst: 5 },
    robotsPolicyRef: 'https://www.target.com/robots.txt',
    browserRequired: false,
    loginRequired: false,
    membershipRequired: false,
    evidenceFreshness: '2024-01-01T00:00:00Z',
    health: { status: 'unknown', lastCheckedAt: '2024-01-01T00:00:00Z' },
    promotionMethod: {
      supportsCoupons: true,
      supportsAutomaticPromotions: true,
      supportsBOGO: true,
      supportsBuyMoreSaveMore: true,
      supportsMemberPricing: false,
      supportsGiftCardPromos: true,
      supportsRebates: false
    },
    availabilityMethod: { type: 'api', granularity: 'store' },
    fulfillmentMethods: [
      { type: 'shipping', regions: ["US"] },
      { type: 'pickup', regions: ["US"] }
    ],
    evidence: []
  },
  {
    id: 'ret:lowes' as RetailerId,
    name: "Lowe's",
    type: "national-chain" as RetailerType,
    regions: ["US"],
    domains: [{ domain: 'lowes.com', official: true, verifiedAt: '2024-01-01T00:00:00Z' }],
    sourceMethods: ['public-product-page', 'browser-operator', 'community-submission', 'manual-entry'],
    accessRestrictions: ["none"],
    affiliateProgram: {
      available: true,
      network: "Lowe's Affiliate",
      programId: 'lowes-program',
      termsRef: 'terms://lowes/affiliate'
    },
    termsReference: {
      termsUrl: 'https://www.lowes.com/terms',
      robotsUrl: 'https://www.lowes.com/robots.txt',
      legalReviewStatus: 'pending'
    },
    permittedAutomationModes: ['fixture-evidence', 'manual-verification'],
    rateLimitMetadata: { requestsPerMinute: 30, burst: 5 },
    robotsPolicyRef: 'https://www.lowes.com/robots.txt',
    browserRequired: false,
    loginRequired: false,
    membershipRequired: false,
    evidenceFreshness: '2024-01-01T00:00:00Z',
    health: { status: 'unknown', lastCheckedAt: '2024-01-01T00:00:00Z' },
    promotionMethod: {
      supportsCoupons: true,
      supportsAutomaticPromotions: true,
      supportsBOGO: true,
      supportsBuyMoreSaveMore: true,
      supportsMemberPricing: false,
      supportsGiftCardPromos: true,
      supportsRebates: false
    },
    availabilityMethod: { type: 'api', granularity: 'store' },
    fulfillmentMethods: [
      { type: 'shipping', regions: ["US"] },
      { type: 'pickup', regions: ["US"] }
    ],
    evidence: []
  },
  {
    id: 'ret:homedepot' as RetailerId,
    name: "The Home Depot",
    type: "national-chain" as RetailerType,
    regions: ["US"],
    domains: [{ domain: 'homedepot.com', official: true, verifiedAt: '2024-01-01T00:00:00Z' }],
    sourceMethods: ['public-product-page', 'browser-operator', 'community-submission', 'manual-entry'],
    accessRestrictions: ["none"],
    affiliateProgram: {
      available: true,
      network: "Home Depot Affiliate",
      programId: 'homedepot-program',
      termsRef: 'terms://homedepot/affiliate'
    },
    termsReference: {
      termsUrl: 'https://www.homedepot.com/terms',
      robotsUrl: 'https://www.homedepot.com/robots.txt',
      legalReviewStatus: 'pending'
    },
    permittedAutomationModes: ['fixture-evidence', 'manual-verification'],
    rateLimitMetadata: { requestsPerMinute: 30, burst: 5 },
    robotsPolicyRef: 'https://www.homedepot.com/robots.txt',
    browserRequired: false,
    loginRequired: false,
    membershipRequired: false,
    evidenceFreshness: '2024-01-01T00:00:00Z',
    health: { status: 'unknown', lastCheckedAt: '2024-01-01T00:00:00Z' },
    promotionMethod: {
      supportsCoupons: true,
      supportsAutomaticPromotions: true,
      supportsBOGO: true,
      supportsBuyMoreSaveMore: true,
      supportsMemberPricing: false,
      supportsGiftCardPromos: true,
      supportsRebates: false
    },
    availabilityMethod: { type: 'api', granularity: 'store' },
    fulfillmentMethods: [
      { type: 'shipping', regions: ["US"] },
      { type: 'pickup', regions: ["US"] }
    ],
    evidence: []
  },
  {
    id: 'ret:bestbuy' as RetailerId,
    name: "Best Buy",
    type: "national-chain" as RetailerType,
    regions: ["US"],
    domains: [{ domain: 'bestbuy.com', official: true, verifiedAt: '2024-01-01T00:00:00Z' }],
    sourceMethods: ['public-product-page', 'browser-operator', 'community-submission', 'manual-entry'],
    accessRestrictions: ["none"],
    affiliateProgram: {
      available: true,
      network: "Best Buy Affiliate",
      programId: 'bestbuy-program',
      termsRef: 'terms://bestbuy/affiliate'
    },
    termsReference: {
      termsUrl: 'https://www.bestbuy.com/terms',
      robotsUrl: 'https://www.bestbuy.com/robots.txt',
      legalReviewStatus: 'pending'
    },
    permittedAutomationModes: ['fixture-evidence', 'manual-verification'],
    rateLimitMetadata: { requestsPerMinute: 30, burst: 5 },
    robotsPolicyRef: 'https://www.bestbuy.com/robots.txt',
    browserRequired: false,
    loginRequired: false,
    membershipRequired: false,
    evidenceFreshness: '2024-01-01T00:00:00Z',
    health: { status: 'unknown', lastCheckedAt: '2024-01-01T00:00:00Z' },
    promotionMethod: {
      supportsCoupons: true,
      supportsAutomaticPromotions: true,
      supportsBOGO: true,
      supportsBuyMoreSaveMore: true,
      supportsMemberPricing: false,
      supportsGiftCardPromos: true,
      supportsRebates: false
    },
    availabilityMethod: { type: 'api', granularity: 'store' },
    fulfillmentMethods: [
      { type: 'shipping', regions: ["US"] },
      { type: 'pickup', regions: ["US"] }
    ],
    evidence: []
  },
  {
    id: 'ret:costco' as RetailerId,
    name: "Costco",
    type: "membership-club" as RetailerType,
    regions: ["US", "CA"],
    domains: [{ domain: 'costco.com', official: true, verifiedAt: '2024-01-01T00:00:00Z' }],
    sourceMethods: ['public-product-page', 'browser-operator', 'community-submission', 'manual-entry'],
    accessRestrictions: ["login-required"],
    affiliateProgram: {
      available: true,
      network: "Costco Affiliate",
      programId: 'costco-program',
      termsRef: 'terms://costco/affiliate'
    },
    termsReference: {
      termsUrl: 'https://www.costco.com/terms',
      robotsUrl: 'https://www.costco.com/robots.txt',
      legalReviewStatus: 'pending'
    },
    permittedAutomationModes: ['fixture-evidence', 'manual-verification'],
    rateLimitMetadata: { requestsPerMinute: 30, burst: 5 },
    robotsPolicyRef: 'https://www.costco.com/robots.txt',
    browserRequired: false,
    loginRequired: true,
    membershipRequired: true,
    evidenceFreshness: '2024-01-01T00:00:00Z',
    health: { status: 'unknown', lastCheckedAt: '2024-01-01T00:00:00Z' },
    promotionMethod: {
      supportsCoupons: true,
      supportsAutomaticPromotions: true,
      supportsBOGO: true,
      supportsBuyMoreSaveMore: true,
      supportsMemberPricing: true,
      supportsGiftCardPromos: true,
      supportsRebates: false
    },
    availabilityMethod: { type: 'api', granularity: 'store' },
    fulfillmentMethods: [
      { type: 'shipping', regions: ["US", "CA"] },
      { type: 'pickup', regions: ["US", "CA"] }
    ],
    evidence: []
  },
  {
    id: 'ret:samsclub' as RetailerId,
    name: "Sam's Club",
    type: "membership-club" as RetailerType,
    regions: ["US"],
    domains: [{ domain: 'samsclub.com', official: true, verifiedAt: '2024-01-01T00:00:00Z' }],
    sourceMethods: ['public-product-page', 'browser-operator', 'community-submission', 'manual-entry'],
    accessRestrictions: ["login-required"],
    affiliateProgram: {
      available: true,
      network: "Sam's Club Affiliate",
      programId: 'samsclub-program',
      termsRef: 'terms://samsclub/affiliate'
    },
    termsReference: {
      termsUrl: 'https://www.samsclub.com/terms',
      robotsUrl: 'https://www.samsclub.com/robots.txt',
      legalReviewStatus: 'pending'
    },
    permittedAutomationModes: ['fixture-evidence', 'manual-verification'],
    rateLimitMetadata: { requestsPerMinute: 30, burst: 5 },
    robotsPolicyRef: 'https://www.samsclub.com/robots.txt',
    browserRequired: false,
    loginRequired: true,
    membershipRequired: true,
    evidenceFreshness: '2024-01-01T00:00:00Z',
    health: { status: 'unknown', lastCheckedAt: '2024-01-01T00:00:00Z' },
    promotionMethod: {
      supportsCoupons: true,
      supportsAutomaticPromotions: true,
      supportsBOGO: true,
      supportsBuyMoreSaveMore: true,
      supportsMemberPricing: true,
      supportsGiftCardPromos: true,
      supportsRebates: false
    },
    availabilityMethod: { type: 'api', granularity: 'store' },
    fulfillmentMethods: [
      { type: 'shipping', regions: ["US"] },
      { type: 'pickup', regions: ["US"] }
    ],
    evidence: []
  },
  {
    id: 'ret:harborfreight' as RetailerId,
    name: "Harbor Freight",
    type: "national-chain" as RetailerType,
    regions: ["US"],
    domains: [{ domain: 'harborfreight.com', official: true, verifiedAt: '2024-01-01T00:00:00Z' }],
    sourceMethods: ['public-product-page', 'browser-operator', 'community-submission', 'manual-entry'],
    accessRestrictions: ["none"],
    affiliateProgram: {
      available: true,
      network: "Harbor Freight Affiliate",
      programId: 'harborfreight-program',
      termsRef: 'terms://harborfreight/affiliate'
    },
    termsReference: {
      termsUrl: 'https://www.harborfreight.com/terms',
      robotsUrl: 'https://www.harborfreight.com/robots.txt',
      legalReviewStatus: 'pending'
    },
    permittedAutomationModes: ['fixture-evidence', 'manual-verification'],
    rateLimitMetadata: { requestsPerMinute: 30, burst: 5 },
    robotsPolicyRef: 'https://www.harborfreight.com/robots.txt',
    browserRequired: false,
    loginRequired: false,
    membershipRequired: false,
    evidenceFreshness: '2024-01-01T00:00:00Z',
    health: { status: 'unknown', lastCheckedAt: '2024-01-01T00:00:00Z' },
    promotionMethod: {
      supportsCoupons: true,
      supportsAutomaticPromotions: true,
      supportsBOGO: true,
      supportsBuyMoreSaveMore: true,
      supportsMemberPricing: false,
      supportsGiftCardPromos: true,
      supportsRebates: false
    },
    availabilityMethod: { type: 'api', granularity: 'store' },
    fulfillmentMethods: [
      { type: 'shipping', regions: ["US"] },
      { type: 'pickup', regions: ["US"] }
    ],
    evidence: []
  },
  {
    id: 'ret:nike' as RetailerId,
    name: "Nike",
    type: "manufacturer-store" as RetailerType,
    regions: ["US"],
    domains: [{ domain: 'nike.com', official: true, verifiedAt: '2024-01-01T00:00:00Z' }],
    sourceMethods: ['public-product-page', 'browser-operator', 'community-submission', 'manual-entry'],
    accessRestrictions: ["login-required"],
    affiliateProgram: {
      available: true,
      network: "Nike Affiliate",
      programId: 'nike-program',
      termsRef: 'terms://nike/affiliate'
    },
    termsReference: {
      termsUrl: 'https://www.nike.com/terms',
      robotsUrl: 'https://www.nike.com/robots.txt',
      legalReviewStatus: 'pending'
    },
    permittedAutomationModes: ['fixture-evidence', 'manual-verification'],
    rateLimitMetadata: { requestsPerMinute: 30, burst: 5 },
    robotsPolicyRef: 'https://www.nike.com/robots.txt',
    browserRequired: false,
    loginRequired: true,
    membershipRequired: false,
    evidenceFreshness: '2024-01-01T00:00:00Z',
    health: { status: 'unknown', lastCheckedAt: '2024-01-01T00:00:00Z' },
    promotionMethod: {
      supportsCoupons: true,
      supportsAutomaticPromotions: true,
      supportsBOGO: true,
      supportsBuyMoreSaveMore: true,
      supportsMemberPricing: false,
      supportsGiftCardPromos: true,
      supportsRebates: false
    },
    availabilityMethod: { type: 'api', granularity: 'store' },
    fulfillmentMethods: [
      { type: 'shipping', regions: ["US"] },
      { type: 'pickup', regions: ["US"] }
    ],
    evidence: []
  },
  {
    id: 'ret:adidas' as RetailerId,
    name: "Adidas",
    type: "manufacturer-store" as RetailerType,
    regions: ["US"],
    domains: [{ domain: 'adidas.com', official: true, verifiedAt: '2024-01-01T00:00:00Z' }],
    sourceMethods: ['public-product-page', 'browser-operator', 'community-submission', 'manual-entry'],
    accessRestrictions: ["login-required"],
    affiliateProgram: {
      available: true,
      network: "Adidas Affiliate",
      programId: 'adidas-program',
      termsRef: 'terms://adidas/affiliate'
    },
    termsReference: {
      termsUrl: 'https://www.adidas.com/terms',
      robotsUrl: 'https://www.adidas.com/robots.txt',
      legalReviewStatus: 'pending'
    },
    permittedAutomationModes: ['fixture-evidence', 'manual-verification'],
    rateLimitMetadata: { requestsPerMinute: 30, burst: 5 },
    robotsPolicyRef: 'https://www.adidas.com/robots.txt',
    browserRequired: false,
    loginRequired: true,
    membershipRequired: false,
    evidenceFreshness: '2024-01-01T00:00:00Z',
    health: { status: 'unknown', lastCheckedAt: '2024-01-01T00:00:00Z' },
    promotionMethod: {
      supportsCoupons: true,
      supportsAutomaticPromotions: true,
      supportsBOGO: true,
      supportsBuyMoreSaveMore: true,
      supportsMemberPricing: false,
      supportsGiftCardPromos: true,
      supportsRebates: false
    },
    availabilityMethod: { type: 'api', granularity: 'store' },
    fulfillmentMethods: [
      { type: 'shipping', regions: ["US"] },
      { type: 'pickup', regions: ["US"] }
    ],
    evidence: []
  },
  {
    id: 'ret:victoriassecret' as RetailerId,
    name: "Victoria's Secret",
    type: "national-chain" as RetailerType,
    regions: ["US"],
    domains: [{ domain: 'victoriassecret.com', official: true, verifiedAt: '2024-01-01T00:00:00Z' }],
    sourceMethods: ['public-product-page', 'browser-operator', 'community-submission', 'manual-entry'],
    accessRestrictions: ["none"],
    affiliateProgram: {
      available: true,
      network: "VS Affiliate",
      programId: 'victoriassecret-program',
      termsRef: 'terms://victoriassecret/affiliate'
    },
    termsReference: {
      termsUrl: 'https://www.victoriassecret.com/terms',
      robotsUrl: 'https://www.victoriassecret.com/robots.txt',
      legalReviewStatus: 'pending'
    },
    permittedAutomationModes: ['fixture-evidence', 'manual-verification'],
    rateLimitMetadata: { requestsPerMinute: 30, burst: 5 },
    robotsPolicyRef: 'https://www.victoriassecret.com/robots.txt',
    browserRequired: false,
    loginRequired: false,
    membershipRequired: false,
    evidenceFreshness: '2024-01-01T00:00:00Z',
    health: { status: 'unknown', lastCheckedAt: '2024-01-01T00:00:00Z' },
    promotionMethod: {
      supportsCoupons: true,
      supportsAutomaticPromotions: true,
      supportsBOGO: true,
      supportsBuyMoreSaveMore: true,
      supportsMemberPricing: false,
      supportsGiftCardPromos: true,
      supportsRebates: false
    },
    availabilityMethod: { type: 'api', granularity: 'store' },
    fulfillmentMethods: [
      { type: 'shipping', regions: ["US"] },
      { type: 'pickup', regions: ["US"] }
    ],
    evidence: []
  },
  {
    id: 'ret:bathandbodyworks' as RetailerId,
    name: "Bath & Body Works",
    type: "national-chain" as RetailerType,
    regions: ["US"],
    domains: [{ domain: 'bathandbodyworks.com', official: true, verifiedAt: '2024-01-01T00:00:00Z' }],
    sourceMethods: ['public-product-page', 'browser-operator', 'community-submission', 'manual-entry'],
    accessRestrictions: ["none"],
    affiliateProgram: {
      available: true,
      network: "BBW Affiliate",
      programId: 'bathandbodyworks-program',
      termsRef: 'terms://bathandbodyworks/affiliate'
    },
    termsReference: {
      termsUrl: 'https://www.bathandbodyworks.com/terms',
      robotsUrl: 'https://www.bathandbodyworks.com/robots.txt',
      legalReviewStatus: 'pending'
    },
    permittedAutomationModes: ['fixture-evidence', 'manual-verification'],
    rateLimitMetadata: { requestsPerMinute: 30, burst: 5 },
    robotsPolicyRef: 'https://www.bathandbodyworks.com/robots.txt',
    browserRequired: false,
    loginRequired: false,
    membershipRequired: false,
    evidenceFreshness: '2024-01-01T00:00:00Z',
    health: { status: 'unknown', lastCheckedAt: '2024-01-01T00:00:00Z' },
    promotionMethod: {
      supportsCoupons: true,
      supportsAutomaticPromotions: true,
      supportsBOGO: true,
      supportsBuyMoreSaveMore: true,
      supportsMemberPricing: false,
      supportsGiftCardPromos: true,
      supportsRebates: false
    },
    availabilityMethod: { type: 'api', granularity: 'store' },
    fulfillmentMethods: [
      { type: 'shipping', regions: ["US"] },
      { type: 'pickup', regions: ["US"] }
    ],
    evidence: []
  },
  {
    id: 'ret:macys' as RetailerId,
    name: "Macy's",
    type: "national-chain" as RetailerType,
    regions: ["US"],
    domains: [{ domain: 'macys.com', official: true, verifiedAt: '2024-01-01T00:00:00Z' }],
    sourceMethods: ['public-product-page', 'browser-operator', 'community-submission', 'manual-entry'],
    accessRestrictions: ["none"],
    affiliateProgram: {
      available: true,
      network: "Macy's Affiliate",
      programId: 'macys-program',
      termsRef: 'terms://macys/affiliate'
    },
    termsReference: {
      termsUrl: 'https://www.macys.com/terms',
      robotsUrl: 'https://www.macys.com/robots.txt',
      legalReviewStatus: 'pending'
    },
    permittedAutomationModes: ['fixture-evidence', 'manual-verification'],
    rateLimitMetadata: { requestsPerMinute: 30, burst: 5 },
    robotsPolicyRef: 'https://www.macys.com/robots.txt',
    browserRequired: false,
    loginRequired: false,
    membershipRequired: false,
    evidenceFreshness: '2024-01-01T00:00:00Z',
    health: { status: 'unknown', lastCheckedAt: '2024-01-01T00:00:00Z' },
    promotionMethod: {
      supportsCoupons: true,
      supportsAutomaticPromotions: true,
      supportsBOGO: true,
      supportsBuyMoreSaveMore: true,
      supportsMemberPricing: false,
      supportsGiftCardPromos: true,
      supportsRebates: false
    },
    availabilityMethod: { type: 'api', granularity: 'store' },
    fulfillmentMethods: [
      { type: 'shipping', regions: ["US"] },
      { type: 'pickup', regions: ["US"] }
    ],
    evidence: []
  },
  {
    id: 'ret:kohls' as RetailerId,
    name: "Kohl's",
    type: "national-chain" as RetailerType,
    regions: ["US"],
    domains: [{ domain: 'kohls.com', official: true, verifiedAt: '2024-01-01T00:00:00Z' }],
    sourceMethods: ['public-product-page', 'browser-operator', 'community-submission', 'manual-entry'],
    accessRestrictions: ["none"],
    affiliateProgram: {
      available: true,
      network: "Kohl's Affiliate",
      programId: 'kohls-program',
      termsRef: 'terms://kohls/affiliate'
    },
    termsReference: {
      termsUrl: 'https://www.kohls.com/terms',
      robotsUrl: 'https://www.kohls.com/robots.txt',
      legalReviewStatus: 'pending'
    },
    permittedAutomationModes: ['fixture-evidence', 'manual-verification'],
    rateLimitMetadata: { requestsPerMinute: 30, burst: 5 },
    robotsPolicyRef: 'https://www.kohls.com/robots.txt',
    browserRequired: false,
    loginRequired: false,
    membershipRequired: false,
    evidenceFreshness: '2024-01-01T00:00:00Z',
    health: { status: 'unknown', lastCheckedAt: '2024-01-01T00:00:00Z' },
    promotionMethod: {
      supportsCoupons: true,
      supportsAutomaticPromotions: true,
      supportsBOGO: true,
      supportsBuyMoreSaveMore: true,
      supportsMemberPricing: false,
      supportsGiftCardPromos: true,
      supportsRebates: false
    },
    availabilityMethod: { type: 'api', granularity: 'store' },
    fulfillmentMethods: [
      { type: 'shipping', regions: ["US"] },
      { type: 'pickup', regions: ["US"] }
    ],
    evidence: []
  },
  {
    id: 'ret:cvs' as RetailerId,
    name: "CVS",
    type: "national-chain" as RetailerType,
    regions: ["US"],
    domains: [{ domain: 'cvs.com', official: true, verifiedAt: '2024-01-01T00:00:00Z' }],
    sourceMethods: ['public-product-page', 'browser-operator', 'community-submission', 'manual-entry'],
    accessRestrictions: ["none"],
    affiliateProgram: {
      available: true,
      network: "CVS Affiliate",
      programId: 'cvs-program',
      termsRef: 'terms://cvs/affiliate'
    },
    termsReference: {
      termsUrl: 'https://www.cvs.com/terms',
      robotsUrl: 'https://www.cvs.com/robots.txt',
      legalReviewStatus: 'pending'
    },
    permittedAutomationModes: ['fixture-evidence', 'manual-verification'],
    rateLimitMetadata: { requestsPerMinute: 30, burst: 5 },
    robotsPolicyRef: 'https://www.cvs.com/robots.txt',
    browserRequired: false,
    loginRequired: false,
    membershipRequired: false,
    evidenceFreshness: '2024-01-01T00:00:00Z',
    health: { status: 'unknown', lastCheckedAt: '2024-01-01T00:00:00Z' },
    promotionMethod: {
      supportsCoupons: true,
      supportsAutomaticPromotions: true,
      supportsBOGO: true,
      supportsBuyMoreSaveMore: true,
      supportsMemberPricing: false,
      supportsGiftCardPromos: true,
      supportsRebates: false
    },
    availabilityMethod: { type: 'api', granularity: 'store' },
    fulfillmentMethods: [
      { type: 'shipping', regions: ["US"] },
      { type: 'pickup', regions: ["US"] }
    ],
    evidence: []
  },
  {
    id: 'ret:walgreens' as RetailerId,
    name: "Walgreens",
    type: "national-chain" as RetailerType,
    regions: ["US"],
    domains: [{ domain: 'walgreens.com', official: true, verifiedAt: '2024-01-01T00:00:00Z' }],
    sourceMethods: ['public-product-page', 'browser-operator', 'community-submission', 'manual-entry'],
    accessRestrictions: ["none"],
    affiliateProgram: {
      available: true,
      network: "Walgreens Affiliate",
      programId: 'walgreens-program',
      termsRef: 'terms://walgreens/affiliate'
    },
    termsReference: {
      termsUrl: 'https://www.walgreens.com/terms',
      robotsUrl: 'https://www.walgreens.com/robots.txt',
      legalReviewStatus: 'pending'
    },
    permittedAutomationModes: ['fixture-evidence', 'manual-verification'],
    rateLimitMetadata: { requestsPerMinute: 30, burst: 5 },
    robotsPolicyRef: 'https://www.walgreens.com/robots.txt',
    browserRequired: false,
    loginRequired: false,
    membershipRequired: false,
    evidenceFreshness: '2024-01-01T00:00:00Z',
    health: { status: 'unknown', lastCheckedAt: '2024-01-01T00:00:00Z' },
    promotionMethod: {
      supportsCoupons: true,
      supportsAutomaticPromotions: true,
      supportsBOGO: true,
      supportsBuyMoreSaveMore: true,
      supportsMemberPricing: false,
      supportsGiftCardPromos: true,
      supportsRebates: false
    },
    availabilityMethod: { type: 'api', granularity: 'store' },
    fulfillmentMethods: [
      { type: 'shipping', regions: ["US"] },
      { type: 'pickup', regions: ["US"] }
    ],
    evidence: []
  },
  {
    id: 'ret:officedepot' as RetailerId,
    name: "Office Depot",
    type: "national-chain" as RetailerType,
    regions: ["US"],
    domains: [{ domain: 'officedepot.com', official: true, verifiedAt: '2024-01-01T00:00:00Z' }],
    sourceMethods: ['public-product-page', 'browser-operator', 'community-submission', 'manual-entry'],
    accessRestrictions: ["none"],
    affiliateProgram: {
      available: true,
      network: "Office Depot Affiliate",
      programId: 'officedepot-program',
      termsRef: 'terms://officedepot/affiliate'
    },
    termsReference: {
      termsUrl: 'https://www.officedepot.com/terms',
      robotsUrl: 'https://www.officedepot.com/robots.txt',
      legalReviewStatus: 'pending'
    },
    permittedAutomationModes: ['fixture-evidence', 'manual-verification'],
    rateLimitMetadata: { requestsPerMinute: 30, burst: 5 },
    robotsPolicyRef: 'https://www.officedepot.com/robots.txt',
    browserRequired: false,
    loginRequired: false,
    membershipRequired: false,
    evidenceFreshness: '2024-01-01T00:00:00Z',
    health: { status: 'unknown', lastCheckedAt: '2024-01-01T00:00:00Z' },
    promotionMethod: {
      supportsCoupons: true,
      supportsAutomaticPromotions: true,
      supportsBOGO: true,
      supportsBuyMoreSaveMore: true,
      supportsMemberPricing: false,
      supportsGiftCardPromos: true,
      supportsRebates: false
    },
    availabilityMethod: { type: 'api', granularity: 'store' },
    fulfillmentMethods: [
      { type: 'shipping', regions: ["US"] },
      { type: 'pickup', regions: ["US"] }
    ],
    evidence: []
  },
  {
    id: 'ret:staples' as RetailerId,
    name: "Staples",
    type: "national-chain" as RetailerType,
    regions: ["US"],
    domains: [{ domain: 'staples.com', official: true, verifiedAt: '2024-01-01T00:00:00Z' }],
    sourceMethods: ['public-product-page', 'browser-operator', 'community-submission', 'manual-entry'],
    accessRestrictions: ["none"],
    affiliateProgram: {
      available: true,
      network: "Staples Affiliate",
      programId: 'staples-program',
      termsRef: 'terms://staples/affiliate'
    },
    termsReference: {
      termsUrl: 'https://www.staples.com/terms',
      robotsUrl: 'https://www.staples.com/robots.txt',
      legalReviewStatus: 'pending'
    },
    permittedAutomationModes: ['fixture-evidence', 'manual-verification'],
    rateLimitMetadata: { requestsPerMinute: 30, burst: 5 },
    robotsPolicyRef: 'https://www.staples.com/robots.txt',
    browserRequired: false,
    loginRequired: false,
    membershipRequired: false,
    evidenceFreshness: '2024-01-01T00:00:00Z',
    health: { status: 'unknown', lastCheckedAt: '2024-01-01T00:00:00Z' },
    promotionMethod: {
      supportsCoupons: true,
      supportsAutomaticPromotions: true,
      supportsBOGO: true,
      supportsBuyMoreSaveMore: true,
      supportsMemberPricing: false,
      supportsGiftCardPromos: true,
      supportsRebates: false
    },
    availabilityMethod: { type: 'api', granularity: 'store' },
    fulfillmentMethods: [
      { type: 'shipping', regions: ["US"] },
      { type: 'pickup', regions: ["US"] }
    ],
    evidence: []
  },
  {
    id: 'ret:newegg' as RetailerId,
    name: "Newegg",
    type: "online-only" as RetailerType,
    regions: ["US"],
    domains: [{ domain: 'newegg.com', official: true, verifiedAt: '2024-01-01T00:00:00Z' }],
    sourceMethods: ['public-product-page', 'browser-operator', 'community-submission', 'manual-entry'],
    accessRestrictions: ["none"],
    affiliateProgram: {
      available: true,
      network: "Newegg Affiliate",
      programId: 'newegg-program',
      termsRef: 'terms://newegg/affiliate'
    },
    termsReference: {
      termsUrl: 'https://www.newegg.com/terms',
      robotsUrl: 'https://www.newegg.com/robots.txt',
      legalReviewStatus: 'pending'
    },
    permittedAutomationModes: ['fixture-evidence', 'manual-verification'],
    rateLimitMetadata: { requestsPerMinute: 30, burst: 5 },
    robotsPolicyRef: 'https://www.newegg.com/robots.txt',
    browserRequired: false,
    loginRequired: false,
    membershipRequired: false,
    evidenceFreshness: '2024-01-01T00:00:00Z',
    health: { status: 'unknown', lastCheckedAt: '2024-01-01T00:00:00Z' },
    promotionMethod: {
      supportsCoupons: true,
      supportsAutomaticPromotions: true,
      supportsBOGO: true,
      supportsBuyMoreSaveMore: true,
      supportsMemberPricing: false,
      supportsGiftCardPromos: true,
      supportsRebates: false
    },
    availabilityMethod: { type: 'api', granularity: 'store' },
    fulfillmentMethods: [
      { type: 'shipping', regions: ["US"] },
      { type: 'pickup', regions: ["US"] }
    ],
    evidence: []
  }
];

const RETAILER_BY_ID = new Map<string, Retailer>(RETAILERS.map(r => [r.id, r]));

export function listRetailers(): Retailer[] {
  return RETAILERS.slice();
}

export function getRetailer(id: string): Retailer | undefined {
  return RETAILER_BY_ID.get(id);
}

export function getRetailerBySlug(slug: string): Retailer | undefined {
  return RETAILER_BY_ID.get(`ret:${slug}`);
}

export function listRetailersByRegion(region: RegionCode): Retailer[] {
  return RETAILERS.filter(r => r.regions.includes(region));
}

export function listRetailersByType(type: RetailerType): Retailer[] {
  return RETAILERS.filter(r => r.type === type);
}

export function supportsSourceMethod(r: Retailer, method: RetailerSourceMethod): boolean {
  return r.sourceMethods.includes(method);
}

export const RETAILER_SLUGS: string[] = RETAILERS.map(r => r.id.replace('ret:', ''));

export const RETAILER_COUNT = RETAILERS.length;
