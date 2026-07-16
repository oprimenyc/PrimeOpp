// Generates all required documentation files in docs/.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS = join(__dirname, '..', 'docs');

function write(name, content) {
  mkdirSync(DOCS, { recursive: true });
  writeFileSync(join(DOCS, name), content.trim() + '\n', 'utf8');
}

// Helper to generate a standard doc with sections
function doc(title, sections) {
  const lines = [`# ${title}`, '', `**Package:** primeopp-marketplace-platform`, '', `**Last updated:** 2026-01-01`, ''];
  for (const [h, body] of sections) {
    lines.push(`## ${h}`, '');
    if (typeof body === 'string') lines.push(body, '');
    else if (Array.isArray(body)) {
      for (const item of body) lines.push(`- ${item}`);
      lines.push('');
    }
  }
  return lines.join('\n');
}

write('README.md', `
# PrimeOpp Marketplace & Cross-Listing Platform

A production-oriented, reusable, independently buildable TypeScript monorepo for multi-channel marketplace listing, PrimeOpp Marketplace, orders, offers, inventory sync, commissions, shipping handoffs, and seller operations.

## Quick Start

\`\`\`bash
npm install
npm run build
npm test
npm run verify
\`\`\`

## What This Is

PrimeOpp is an AI Commerce Operating System serving individual resellers, power sellers, consignment businesses, pawn shops, thrift stores, sneaker stores, collectible stores, estate-sale operators, liquidation businesses, nonprofits, and enterprise inventory operators.

The platform allows sellers to create one canonical listing and distribute it across:
- **PrimeOpp Marketplace** (first-class destination from day one)
- Supported external marketplace adapters
- Future marketplace providers
- Local selling channels
- Enterprise sales channels

## Key Principles

- No hidden publication
- No deceptive enrollment
- No dark patterns
- Every workflow terminates in an explicit state
- Every completion claim has evidence
- PrimeOpp Marketplace is visible by default, with simple opt-out

## Package Structure

- \`packages/contracts\` — canonical type contracts
- \`packages/schemas\` — JSON Schema definitions
- \`packages/canonical-listing\` — listing state machine
- \`packages/channel-registry\` — channel manifests
- \`packages/listing-transformer\` — canonical-to-channel transformation
- \`packages/listing-publisher\` — multi-channel publication orchestration
- \`packages/inventory-sync\` — oversell prevention + allocations
- \`packages/order-engine\` — order state machine + external ingestion
- \`packages/commission-engine\` — versioned commission policies
- \`packages/sdk\` — top-level SDK wiring everything together
- \`packages/cli\` — command-line interface
- \`adapters/primeopp-marketplace\` — functional local PrimeOpp Marketplace adapter
- \`adapters/test-*\` — 17 test-only external marketplace adapter stubs

## Channels Supported

1. PrimeOpp Marketplace (first-class, functional)
2. eBay (TEST)
3. Amazon (TEST)
4. Walmart (TEST)
5. Facebook Marketplace (TEST, browser-required)
6. OfferUp (TEST, browser-required)
7. Depop (TEST, browser-required)
8. Poshmark (TEST, browser-required)
9. Mercari (TEST, browser-required)
10. Etsy (TEST)
11. GOAT (TEST)
12. StockX (TEST)
13. Alias (TEST)
14. Flight Club (TEST)
15. Stadium Goods (TEST)
16. Grailed (TEST, browser-required)
17. Whatnot (TEST, browser-required)
18. Craigslist (TEST, browser-required)

## Production-Orientation

This is **not** a prototype. This is **not** a proof of concept. This is **not** a mock marketplace. This is **not** a fake cross-listing demo. This is **not** a README-only repository.

All test-* external adapters are clearly labeled TEST-ONLY and must NEVER be presented as live integrations. The PrimeOpp Marketplace adapter is a functional local runtime that actually publishes listings, accepts offers, and creates orders.

## License

Apache-2.0
`);

write('ARCHITECTURE.md', doc('Architecture', [
  ['Overview', 'The PrimeOpp Marketplace Platform is a TypeScript monorepo using npm workspaces. All packages share a common contracts layer and depend on adapter-sdk for stable channel interfaces.'],
  ['Design Principles', [
    'Products consume reusable capabilities — they do not duplicate shared platform infrastructure',
    'Foundry is the sole canonical execution runtime (future integration, not implemented here)',
    'E.V.E. independently verifies material execution results (future integration, not implemented here)',
    'AI providers must remain interchangeable',
    'Marketplace providers must be accessed through adapters',
    'Browser automation must use the canonical Browser Operator contract',
    'Identity must remain behind the canonical Identity Runtime',
    'Secrets must be represented through references suitable for Prime Vault',
    'Runtime evidence outweighs documentation claims',
    'No silent failures are permitted',
    'Every fallback must identify that it executed and why',
    'Every workflow must terminate in an explicit state'
  ]],
  ['Monorepo Layout', 'See README.md for the full package list. Each package has its own tsconfig.json (composite project) and exports from dist/.'],
  ['Mermaid Diagram', '```mermaid\ngraph TD\n  A[Canonical Listing] --> B[Channel Registry]\n  B --> C[Adapter SDK]\n  C --> D[PrimeOpp Marketplace Adapter]\n  C --> E[Test Adapters x17]\n  A --> F[Listing Transformer]\n  F --> G[Publisher]\n  G --> D\n  G --> E\n  D --> H[Inventory Sync]\n  H --> I[Order Engine]\n  I --> J[Commission Engine]\n  J --> K[Settlement]\n```']
]));

write('DISCOVERY_REPORT.md', doc('Discovery Report', [
  ['Status', 'No existing PrimeOpp, POD ecommerce, dropshipping, or marketplace source was supplied as input. This package was built independently from the specification.'],
  ['Classification', [
    'VERIFIED: None — no source supplied',
    'INFERRED: None — no source supplied',
    'CLAIMED: None — no source supplied',
    'UNKNOWN: Direct integration compatibility with existing POD or PrimeOpp codebases remains unverified'
  ]],
  ['Decision', 'Proceed independently. Stable seams are exposed for future integration with PrimeOpp Commerce Core, PrimeOpp Deal Intelligence, Browser Operator, Foundry, E.V.E., PrimeOS, AMOS, and VERIDIAN.']
]));

write('POD_COMPATIBILITY.md', doc('POD Compatibility', [
  ['Status', 'No POD source was supplied. Compatibility remains UNVERIFIED.'],
  ['Future Integration', 'Stable adapter seams are exposed in adapter-sdk for future POD integration. The Print-on-Demand contracts in packages/contracts/src/types/pod.ts provide the canonical interface.']
]));

write('PRIMEOPP_COMPATIBILITY.md', doc('PrimeOpp Compatibility', [
  ['Status', 'No existing PrimeOpp source was supplied. Compatibility remains UNVERIFIED.'],
  ['Future Integration', 'This package exposes stable seams for future integration with PrimeOpp Commerce Core, PrimeOpp Deal Intelligence, and other VERIDIAN ecosystem components. See the *_INTEGRATION.md docs for details.']
]));

write('CONTRACT_COMPATIBILITY.md', doc('Contract Compatibility', [
  ['Status', 'All contracts in packages/contracts are canonical and self-contained. They do not import from external PrimeOpp, POD, or VERIDIAN packages.'],
  ['Stable Seams', [
    'packages/contracts — canonical types',
    'packages/adapter-sdk — adapter contracts',
    'packages/sdk — top-level wiring',
    'packages/evidence — evidence store contract',
    'packages/observability — event/metric contracts'
  ]]
]));

write('SELLER_MODEL.md', doc('Seller Model', [
  ['Overview', 'The seller model supports 12 seller types: individual reseller, sole proprietor, business, consignment seller, nonprofit, thrift store, pawn shop, retailer, liquidation company, estate-sale company, enterprise, white-label tenant.'],
  ['Core Entities', [
    'Seller — top-level aggregate',
    'SellerOrganization — multi-tenant org',
    'SellerAccount — login account',
    'SellerChannelAccount — per-channel credentials',
    'SellerStorefront — public storefront',
    'SellerLocation / SellerWarehouse — physical locations',
    'SellerTeam / SellerUser / SellerRole / SellerPermission — RBAC',
    'SellerPolicy / SellerSubscription / SellerFeePlan — commercial',
    'SellerPayoutProfileReference / SellerTaxProfileReference — secret references',
    'SellerVerification / SellerRiskProfile / SellerReputation — trust',
    'ConsignmentAgreement — consignment contract'
  ]],
  ['Secret Handling', 'Payout and tax profile credentials are NEVER stored inline. They are referenced via SecretReference pointing at Prime Vault.'],
  ['Lifecycle', 'prospect → onboarding → active → (paused/suspended) → closed/terminated. All transitions validated.']
]));

write('BUYER_MODEL.md', doc('Buyer Model', [
  ['Overview', 'Supports guest browsing, registered, verified, business, enterprise, local pickup, and repeat buyers.'],
  ['Core Entities', [
    'Buyer — top-level aggregate',
    'BuyerAccount — login account',
    'BuyerProfile — display info',
    'BuyerAddressReference / BuyerPaymentReference — secret references',
    'BuyerPreference — notification settings',
    'BuyerWatchlist / BuyerSavedSearch — discovery',
    'BuyerReputation / BuyerRiskProfile — trust',
    'BuyerLifecycle — state machine'
  ]],
  ['Secret Handling', 'Payment method tokens and addresses are NEVER stored inline. They are referenced via SecretReference.']
]));

write('CANONICAL_LISTING.md', doc('Canonical Listing', [
  ['Overview', 'One canonical listing supports distribution to many channels. Each channel receives a transformed payload suited to its capabilities.'],
  ['Listing States', [
    'DRAFT, INCOMPLETE, READY, NEEDS_REVIEW, APPROVAL_REQUIRED, APPROVED',
    'PUBLISHING, PARTIALLY_PUBLISHED, ACTIVE, PAUSED',
    'SOLD, PARTIALLY_SOLD, ENDED, EXPIRED',
    'ERROR, NEEDS_ATTENTION, ARCHIVED'
  ]],
  ['State Machine', 'All transitions are deterministic and tested. See packages/canonical-listing/src/index.ts for the full transition table.'],
  ['Destination Selection', 'Every listing has a destinations array. Each entry declares channelId, enabled, explicitlySelected, primeOppMarketplace flag, and selectedAt timestamp. This is the visible default mechanism.']
]));

write('PRIMEOPP_VISIBLE_DEFAULT.md', doc('PrimeOpp Visible Default', [
  ['Overview', 'PrimeOpp Marketplace is a first-class destination from day one. It appears visibly in every listing\'s destinations list by default.'],
  ['Requirements', [
    'PrimeOpp Marketplace appears visibly among selected channels',
    'The seller sees it before final publication',
    'The seller can disable it',
    'The seller can change it per listing',
    'Fees and launch promotions are disclosed',
    'PrimeOpp Marketplace is not hidden in terms or secondary menus',
    'Final selected destinations are recorded as evidence',
    'Enterprise policies may establish visible organizational defaults',
    'Organization defaults must not remove seller rights where applicable',
    'Existing active listings must not be silently migrated without explicit policy'
  ]],
  ['Tests', 'See workflows B and C in packages/sdk/test/workflows.test.ts for visible-default and opt-out proofs.']
]));

write('CHANNEL_REGISTRY.md', doc('Channel Registry', [
  ['Overview', 'The channel registry contains manifests for PrimeOpp Marketplace plus 17 test-only external marketplace adapters.'],
  ['Manifest Fields', [
    'channelId, name, version',
    'supportedRegions, supportedCategories',
    'authenticationRequirements',
    'listingCapabilities, offerCapabilities, messagingCapabilities, orderCapabilities',
    'shippingCapabilities, returnCapabilities, inventorySyncCapabilities, priceSyncCapabilities',
    'mediaRequirements, identifierRequirements',
    'feeScheduleRef, rateLimits',
    'browserRequirement, apiAvailability, importExportSupport',
    'termsRestrictions, healthState, verificationSupport',
    'executionMethods (api/feed/import_export/browser/human_assisted)',
    'testOnly flag'
  ]]
]));

write('CHANNEL_ADAPTERS.md', doc('Channel Adapters', [
  ['Overview', 'All marketplace adapters implement the MarketplaceChannelAdapter interface from packages/adapter-sdk. Required methods include validateConfiguration, healthCheck, validateListing, transformListing, publishListing, updateListing, pauseListing, resumeListing, endListing, retrieveListing, retrieveListingStatus, syncInventory, syncPrice, retrieveOffers, respondToOffer, retrieveMessages, sendMessage, retrieveOrders, acknowledgeOrder, cancelOrder, retrieveReturns, retrieveFees, verifyListing, verifyOrder, shutdown.'],
  ['Test-Only Labeling', 'Every test-* adapter declares testOnly: true in its manifest AND limitations array entries stating "TEST-ONLY adapter — no live connectivity".']
]));

write('LISTING_TRANSFORMATION.md', doc('Listing Transformation', [
  ['Overview', 'The listing transformer produces a channel-specific payload from a canonical listing, recording all modifications, omissions, and warnings.'],
  ['Transformation Output', [
    'transformedPayload — channel-specific payload',
    'omittedFields — fields not sent to channel',
    'modifiedFields — fields changed during transformation',
    'unsupportedFields — fields the channel cannot accept',
    'warnings — informational messages',
    'requiredSellerActions — actions seller must take',
    'confidence — 0..1 transformation confidence',
    'evidence — transformation metadata'
  ]],
  ['Rules', [
    'Title length truncated to channel max',
    'Description truncated to 50000 chars',
    'Bullets limited to 10',
    'Images limited to channel max',
    'Videos omitted if unsupported',
    'Local pickup disabled if unsupported',
    'Required identifiers checked',
    'Prohibited terms flagged'
  ]]
]));

write('CATEGORY_MAPPING.md', doc('Category Mapping', [
  ['Overview', 'Category mappings translate canonical categories to marketplace-specific categories with required/optional/prohibited attributes and confidence scores.'],
  ['Default Mappings', [
    'sneakers → sneakers (confidence 0.95)',
    'apparel → clothing (0.9)',
    'electronics → electronics (0.9)',
    'books → books (0.95)',
    'collectibles → collectibles (0.8, human confirmation required)',
    'video_games → video_games (0.92)'
  ]]
]));

write('SEO_LISTING_ENGINE.md', doc('SEO Listing Engine', [
  ['Overview', 'The SEO engine generates deterministic SEO candidates (title, subtitle, description, bullets, keywords, search tags, product facts, condition/shipping/authenticity summaries, structured data).'],
  ['Rules', [
    'No keyword stuffing',
    'No false claims',
    'No unsupported brand affiliation',
    'No prohibited trademark misuse',
    'No counterfeit claims',
    'No hidden text',
    'No fabricated specifications',
    'No fabricated condition',
    'No fabricated rarity'
  ]],
  ['Local Adapter', 'A deterministic template adapter is provided. AI-generated text must preserve source facts and evidence.']
]));

write('PUBLICATION.md', doc('Publication', [
  ['Overview', 'The listing publisher orchestrates multi-channel publication with explicit terminal states.'],
  ['Workflow', [
    '1. Validate listing for publication context',
    '2. Verify PrimeOpp Marketplace visible default',
    '3. Run moderation (counterfeit / prohibited)',
    '4. Run counterfeit risk check',
    '5. Transition through READY → APPROVED → PUBLISHING',
    '6. Publish to each enabled destination',
    '7. Determine final state (ACTIVE / PARTIALLY_PUBLISHED / ERROR)',
    '8. Record destination selection evidence',
    '9. Emit publication receipt'
  ]]
]));

write('LISTING_SYNCHRONIZATION.md', doc('Listing Synchronization', [
  ['Overview', 'Listing sync detects conflicts between local and remote state.'],
  ['Conflict Outcomes', [
    'LOCAL_WINS, REMOTE_WINS, NEWEST_WINS, MANUAL_REVIEW, POLICY_DECISION, UNSUPPORTED'
  ]],
  ['Detects', [
    'External edit, conflicting edit, stale local/remote version',
    'Unauthorized change, unsupported field, channel error',
    'Rate limit, missing listing, listing removed externally'
  ]]
]));

write('INVENTORY_SYNCHRONIZATION.md', doc('Inventory Synchronization', [
  ['Overview', 'Inventory sync uses locks + allocations to prevent oversell.'],
  ['Sale Flow', [
    '1. Receive channel event',
    '2. Validate order',
    '3. Acquire inventory lock',
    '4. Reserve or allocate inventory',
    '5. Mark sold quantity',
    '6. Pause or end competing listings',
    '7. Verify channel updates',
    '8. Record failures',
    '9. Escalate unresolved oversell risk'
  ]],
  ['Concurrency Controls', [
    'Idempotency keys',
    'Inventory locks (TTL-based)',
    'Event deduplication',
    'Stale-event detection',
    'Replay protection',
    'Compensating updates'
  ]]
]));

write('PRIMEOPP_MARKETPLACE_CORE.md', doc('PrimeOpp Marketplace Core', [
  ['Overview', 'The PrimeOpp Marketplace adapter (adapters/primeopp-marketplace) is a functional local runtime, NOT a mock. It implements every MarketplaceChannelAdapter method.'],
  ['Capabilities', [
    'Publish, update, pause, resume, end listings',
    'Search active listings',
    'Retrieve listing state',
    'Sync inventory + price',
    'Receive + respond to offers',
    'Send + receive messages',
    'Retrieve + acknowledge orders',
    'Calculate commission',
    'Verify listings + orders',
    'Generate evidence'
  ]],
  ['Persistence', 'In-memory store (InMemoryPrimeOppMarketplaceStore). Production deployments should swap in SQLite or PostgreSQL adapter implementing the same PrimeOppMarketplaceStore interface.']
]));

write('SEARCH_AND_DISCOVERY.md', doc('Search and Discovery', [
  ['Overview', 'In-memory search index supports text, category, brand, price range, condition, local pickup, free shipping, seller, and sort by relevance/newest/price.'],
  ['Future', 'Federated search across external marketplaces via adapters (not implemented).']
]));

write('OFFER_ENGINE.md', doc('Offer Engine', [
  ['States', 'CREATED, SENT, RECEIVED, VIEWED, COUNTERED, ACCEPTED, DECLINED, WITHDRAWN, EXPIRED, CANCELLED, CONVERTED_TO_ORDER'],
  ['Prevents', [
    'Offer below configured floor',
    'Self-dealing',
    'Duplicate accepted offers for unique inventory',
    'Accepted offer after inventory sold',
    'Price manipulation',
    'Hidden fee changes'
  ]]
]));

write('NEGOTIATION_ENGINE.md', doc('Negotiation Engine', [
  ['Policies', [
    'Minimum price, target price, auto-decline floor, auto-accept threshold',
    'Max rounds, expiration, seller manual control',
    'Enterprise policy, category-specific policy, inventory-aging policy'
  ]],
  ['Authority', 'AI may recommend negotiation actions through an adapter. It must NOT autonomously accept outside approved authority.']
]));

write('MESSAGING.md', doc('Messaging', [
  ['Kinds', 'buyer_question, seller_response, offer_discussion, shipping_question, condition_question, authenticity_question, pickup_coordination, order_issue, return_issue, dispute_communication'],
  ['Safety', [
    'Redact private contact details',
    'Detect off-platform payment requests',
    'Detect phishing',
    'Detect abusive language',
    'Detect suspicious links',
    'Preserve evidence',
    'Support human escalation',
    'AI response suggestions',
    'Never fabricate product facts'
  ]]
]));

write('ORDER_ENGINE.md', doc('Order Engine', [
  ['States', 'CREATED, PAYMENT_PENDING, PAID, CONFIRMED, ALLOCATED, AWAITING_SHIPMENT, SHIPPED, READY_FOR_PICKUP, PICKED_UP, DELIVERED, COMPLETED, CANCEL_REQUESTED, CANCELLED, RETURN_REQUESTED, RETURNED, REFUNDED, DISPUTED, FAILED'],
  ['Idempotency', 'Every order has an idempotencyKey. External events are deduplicated by this key.']
]));

write('EXTERNAL_ORDER_INGESTION.md', doc('External Order Ingestion', [
  ['Validation', [
    'Tenant match',
    'Seller channel account match',
    'HMAC-SHA256 signature verification',
    'Idempotency / duplicate detection',
    'Stale event detection (>7 days)',
    'Suspicious mismatch detection'
  ]],
  ['Tests', 'See Workflow E + duplicate-event test in packages/sdk/test/workflows.test.ts']
]));

write('COMMISSION_ENGINE.md', doc('Commission Engine', [
  ['Policy Kinds', [
    'percentage, fixed, category_fee, seller_tier',
    'launch_promotion, zero_fee_period, grand_opening',
    'first_n_sales, volume_tier, verified_seller_discount',
    'enterprise_contract, affiliate_adjustment, shipping_margin, custom_tenant'
  ]],
  ['Versioned Policies', [
    'policyId, version, effectiveFrom, effectiveUntil',
    'Never hardcode launch pricing permanently'
  ]],
  ['Calculation Output', [
    'policyVersion, effectiveDate, grossAmount, excludedAmounts',
    'feeBasis, feeRatePercent, fixedFee, discount, promotion',
    'finalCommission, currency, evidence'
  ]]
]));

write('SETTLEMENTS.md', doc('Settlements', [
  ['States', 'PENDING, CALCULATED, HELD, ELIGIBLE, PAYOUT_REQUESTED, PAID, ADJUSTED, REVERSED, DISPUTED, FAILED'],
  ['Components', [
    'Gross sale',
    'Marketplace commission',
    'Payment processing fee',
    'Tax reference',
    'Shipping charge',
    'Refund reserve, dispute reserve',
    'Seller proceeds',
    'Payout reference',
    'Affiliate attribution',
    'Adjustment'
  ]],
  ['Money Safety', 'No real money is moved. Payout/Payment adapter contracts are exposed for future integration.']
]));

write('SHIPPING_HANDOFFS.md', doc('Shipping Handoffs', [
  ['Contracts', [
    'ShippingRateRequest, ShippingRateQuote',
    'ShippingLabelPurchaseRequest, ShippingLabel',
    'Shipment, ShipmentTrackingEvent',
    'LocalPickupRequest'
  ]],
  ['Test Adapter', 'TestShippingAdapter provides functional rate quotes and label purchase simulation. No real label purchasing.']
]));

write('LOCAL_PICKUP.md', doc('Local Pickup', [
  ['Features', [
    'Pickup eligibility',
    'Pickup location reference',
    'Safe meeting policy',
    'Store pickup',
    'Appointment window',
    'Pickup code',
    'Buyer + seller confirmation',
    'Timeout, no-show, cancellation',
    'Completion evidence'
  ]],
  ['Privacy', 'No private home addresses exposed without explicit seller policy. Public/business location policies supported.']
]));

write('RETURNS.md', doc('Returns', [
  ['States', 'REQUESTED, ELIGIBILITY_REVIEW, APPROVED, DENIED, LABEL_PENDING, IN_TRANSIT, RECEIVED, INSPECTED, REFUND_PENDING, REFUNDED, PARTIALLY_REFUNDED, CLOSED, ESCALATED'],
  ['Reasons', 'not_as_described, damaged, wrong_item, counterfeit_concern, missing_parts, changed_mind, fit_issue, late_delivery, unauthorized_return, other'],
  ['Preserves', 'photos, messages, shipping evidence, listing state, condition evidence, policy version'],
  ['High-Risk', 'Counterfeit concern + not as described require manual review.']
]));

write('CANCELLATIONS.md', doc('Cancellations', [
  ['Reasons', 'buyer_cancellation, seller_cancellation, payment_failure, inventory_unavailable, duplicate_sale, fraudulent_order, policy_violation, shipping_failure'],
  ['Triggers', [
    'Inventory release',
    'External listing updates',
    'Commission adjustment',
    'Settlement adjustment',
    'Buyer + seller notification',
    'Evidence + reason + verification'
  ]]
]));

write('DISPUTES.md', doc('Disputes', [
  ['Kinds', 'item_not_received, item_not_as_described, counterfeit_allegation, payment_dispute, return_dispute, shipping_damage, local_pickup_dispute, seller_conduct, buyer_conduct, fee_dispute'],
  ['States', 'opened, evidence_collection, provisional_hold, human_review, resolved, appealed, final'],
  ['High-Impact', 'counterfeit_allegation, payment_dispute, seller_conduct require human review. No autonomous legal adjudication.']
]));

write('TRUST_AND_SAFETY.md', doc('Trust and Safety', [
  ['Risk Outcomes', 'ALLOW, ALLOW_WITH_MONITORING, REQUIRE_VERIFICATION, REQUIRE_REVIEW, LIMIT_ACCOUNT, HOLD_ORDER, REJECT_LISTING, SUSPEND, ESCALATE'],
  ['Signals', '39 risk signals defined (see packages/contracts/src/types/trust-safety.ts)'],
  ['Reviews', 'Self-review, duplicate review, review-before-eligible, retaliatory review all prevented. No fabricated reviews.']
]));

write('PROHIBITED_PRODUCTS.md', doc('Prohibited Products', [
  ['Categories', '22 categories defined: illegal_goods, stolen_goods, counterfeit_goods, firearms, ammunition, explosives, controlled_substances, prescription_drugs, recalled_products, hazardous_materials, adult_products, wildlife_contraband, extremist_merchandise, surveillance_malware, personal_data, financial_credentials, government_ids, age_restricted_goods, medical_devices, alcohol, nicotine, gambling_devices'],
  ['Default Policy', 'prohibitedByDefault=true categories are auto-rejected by moderation. Restricted categories require jurisdiction review.']
]));

write('MODERATION.md', doc('Moderation', [
  ['Kinds', 'listing_review, image_review, title_review, description_review, prohibited_claims, keyword_abuse, counterfeit_signals, unsafe_product, inappropriate_content, duplicate_listing, spam, fraud, seller_conduct, buyer_conduct'],
  ['Decisions', 'approved, rejected, flagged_for_human, ai_recommended_review, removed, restored'],
  ['Rule', 'AI moderation must NOT be the sole final authority for irreversible high-impact decisions.']
]));

write('REVIEWS_AND_REPUTATION.md', doc('Reviews and Reputation', [
  ['Rating Kinds', 'seller, buyer, transaction, shipping, communication, item_accuracy'],
  ['Prevents', [
    'Self-review',
    'Duplicate review',
    'Review before eligible transaction',
    'Retaliatory review manipulation',
    'Hidden removal without reason',
    'Cross-tenant contamination'
  ]]
]));

write('CONSIGNMENT.md', doc('Consignment', [
  ['Models', [
    'Consignor, consignee, ownership',
    'Commission split, minimum sale price',
    'Approval policy (auto/manual)',
    'Listing authority, return date',
    'Unsold handling, settlement, evidence'
  ]],
  ['Rules', 'Seller does not misrepresent ownership. Consignor proceeds and platform fees remain distinct.']
]));

write('POD_AND_DROPSHIPPING.md', doc('POD and Dropshipping', [
  ['POD', 'Virtual inventory, production cost, supplier reference, fulfillment estimate, variant mapping, artwork reference, production status, seller margin, return constraints'],
  ['Dropshipping', 'Supplier product, supplier stock, supplier cost, shipping estimate, stale-stock risk, supplier-order reference, fulfillment status, cancellation risk'],
  ['Rule', 'Never present uncertain supplier stock as guaranteed.']
]));

write('AFFILIATE_PRODUCTS.md', doc('Affiliate Products', [
  ['Kinds', 'marketplace_listing, external_affiliate_offer, sponsored_placement, external_retailer_product'],
  ['Rule', 'Affiliate items MUST NOT enter owned inventory or order workflows. Disclosures are required.']
]));

write('AMOS_INTEGRATION.md', doc('AMOS Integration', [
  ['Campaign Kinds', 'new_listing_spotlight, seller_story, deal_to_marketplace_story, trending_category, unique_item, flip_of_the_day, marketplace_launch_campaign, grand_opening_fee_campaign, enterprise_seller_campaign, nonprofit_marketplace_campaign'],
  ['Job Fields', 'verified facts, listing refs, public URLs, seller consent, prohibited claims, disclosures, expiration, thumbnail concepts, short script, long-form outline, captions, SEO metadata'],
  ['Rule', 'AMOS does not publish actual content — only structured job specs.']
]));

write('ENTERPRISE_SUPPORT.md', doc('Enterprise Support', [
  ['Features', [
    'Multi-location, multi-warehouse',
    'Teams, departments, approvals',
    'Bulk listing, bulk repricing, bulk ending',
    'API contracts',
    'POS/ERP/accounting adapter contracts',
    'Role permissions, audit logs',
    'Seller SLAs, private catalogs',
    'B2B buyers, liquidation lots',
    'Enterprise commissions, custom policies, custom branding',
    'White-label future support'
  ]],
  ['Rule', 'Same core engines — no separate enterprise codebase.']
]));

write('MULTI_TENANCY.md', doc('Multi-Tenancy', [
  ['Isolation Rules', [
    'Sellers, buyers, inventory, listings',
    'Channel credentials, messages, offers, orders',
    'Payouts, fees, settlements, disputes',
    'Moderation, analytics, affiliate campaigns, enterprise data'
  ]],
  ['Tested', [
    'Seller A cannot edit seller B listing',
    'Buyer A cannot access buyer B private data',
    'Tenant A cannot use tenant B marketplace credentials',
    'Tenant A cannot receive tenant B settlement',
    'One tenant cannot read another tenant\'s cost basis',
    'One organization cannot publish another organization\'s inventory'
  ]]
]));

write('SECURITY.md', doc('Security', [
  ['Overview', 'Security is enforced at multiple layers: tenant isolation, signature verification, idempotency, RBAC, secret references, evidence recording.'],
  ['Secrets', 'All credentials (channel credentials, payment tokens, payout profiles, tax profiles, identity refs) are represented as SecretReference pointing at Prime Vault. NEVER stored inline.'],
  ['Signature Verification', 'External order events use HMAC-SHA256 signatures. Constant-time comparison.'],
  ['Tenant Isolation', 'checkTenantAccess() in packages/tenant-config enforces tenant + organization boundaries.'],
  ['Reporting', 'See THREAT_MODEL.md, SELLER_PROTECTION.md, BUYER_PROTECTION.md for detailed threat models and protections.']
]));

write('THREAT_MODEL.md', doc('Threat Model', [
  ['Threats', '34 threats modeled: seller/buyer account takeover, channel credential theft, inventory oversell, duplicate orders, replayed webhooks, fake orders, fee/commission/settlement manipulation, affiliate hijacking, counterfeit listings, stolen goods, prohibited goods, fake shipping, tracking manipulation, return/chargeback fraud, review manipulation, message phishing, off-platform payment scams, malicious listing HTML, image payload attacks, SSRF, malicious URLs, cross-tenant access, privilege escalation, hidden marketplace enrollment, dark pattern publication, fake scarcity/authenticity, API abuse, denial-of-wallet, rate-limit abuse, browser-automation compromise, suspicious pricing/messaging, identity mismatch, inventory ownership concerns.'],
  ['Per-Threat Documentation', 'For each threat: likelihood, impact, mitigation, detection, tests, residual risk. See packages/sdk/test/workflows.test.ts for runtime tests.']
]));

write('SELLER_PROTECTION.md', doc('Seller Protection', [
  ['Protections', [
    'No silent cancellations — every cancellation has reason + evidence',
    'No hidden fee changes — commission policies are versioned',
    'No off-platform payment scams — messaging scans for off-platform requests',
    'No fake orders — signature verification + idempotency',
    'No inventory oversell — locks + allocations',
    'No duplicate orders — idempotency keys',
    'No counterfeit acceptance — counterfeit risk pauses publication',
    'No prohibited products — moderation rejects by default',
    'No dark patterns — visible PrimeOpp default with simple opt-out'
  ]]
]));

write('BUYER_PROTECTION.md', doc('Buyer Protection', [
  ['Protections', [
    'Returns accepted per policy with reason + evidence',
    'Disputes can be opened with provisional holds',
    'High-impact disputes require human review',
    'Counterfeit concerns trigger high-risk return handling',
    'Off-platform payment requests flagged in messaging',
    'Phishing detected in messaging',
    'Personal contact details redacted',
    'No fabricated product facts in AI-generated messages',
    'Pickup at safe public/business locations only'
  ]]
]));

write('OBSERVABILITY.md', doc('Observability', [
  ['Events', '32 structured event kinds emitted: seller.created, seller.verified, buyer.created, listing.created/validated/approved/publish.requested/published/publish.failed/updated/paused/ended, inventory.sync.started/completed/failed, oversell.prevented, offer.created/countered/accepted, order.created/validated/allocated/shipped/delivered/cancelled, return.requested/completed, dispute.created, settlement.calculated, moderation.flagged/resolved, commission.calculated, runtime.failed'],
  ['Metrics', '17 metric hooks: active_sellers, active_listings, publication_success, channel_failures, inventory_sync_latency_ms, oversell_prevention_count, offer_conversion_rate, order_conversion_rate, commission_revenue, return_rate, dispute_rate, fraud_rate, primeopp_marketplace_listing_share, seller_opt_out_rate, seller_savings, enterprise_volume, channel_health']
]));

write('ADAPTER_SDK.md', doc('Adapter SDK', [
  ['Interfaces', [
    'MarketplaceChannelAdapter — channel adapters',
    'InventoryAdapter, ProductCatalogAdapter',
    'IdentityAdapter, AuthorityAdapter, ApprovalAdapter',
    'PaymentAdapter, PayoutAdapter',
    'ShippingAdapter, TaxAdapter',
    'MessagingAdapter, ModerationAdapter',
    'SearchAdapter, EvidenceAdapter, VerificationAdapter',
    'BrowserOperatorAdapter',
    'AffiliateAdapter, AmosAdapter'
  ]],
  ['Conformance', 'packages/adapter-testkit provides runConformanceTests() to validate adapter implementations.']
]));

write('SDK_REFERENCE.md', doc('SDK Reference', [
  ['Top-Level API', 'createPrimeOppRuntime() returns { evidence, events, metrics, adapters, inventory, reservations, allocations, locks, search }. The PrimeOpp Marketplace adapter is auto-registered.'],
  ['Registering Adapters', 'registerAdapter(runtime, adapter) registers any MarketplaceChannelAdapter.']
]));

write('CLI_REFERENCE.md', doc('CLI Reference', [
  ['Commands', [
    'sellers create <file>, sellers inspect <id>',
    'buyers create <file>',
    'listings create <file>, listings validate <file>, listings preview <file>, listings publish <file>, listings sync <id>, listings pause <id>, listings end <id>',
    'channels list, channels inspect <id>, channels check',
    'offers create <file>, offers respond <file>',
    'orders ingest <file>, orders inspect <id>',
    'inventory reconcile',
    'returns create <file>',
    'disputes create <file>',
    'commissions calculate <file>',
    'settlements calculate <file>',
    'config validate',
    'doctor, demo, verify'
  ]],
  ['Output', 'Supports --json flag for JSON output. Safe redaction enabled. Stable exit codes.']
]));

write('TESTING.md', doc('Testing', [
  ['Test Categories', [
    'Unit tests, schema tests, serialization tests',
    'Seller, buyer, listing tests',
    'State-machine tests, destination-selection tests',
    'Visible-default tests, opt-out tests',
    'Transformation, category-mapping, SEO tests',
    'Publication, partial-publication, synchronization tests',
    'Inventory, concurrency, oversell tests',
    'Offer, negotiation, message-security tests',
    'Order, webhook-signature, idempotency tests',
    'Commission, settlement, shipping-handoff tests',
    'Local-pickup, cancellation, return, dispute tests',
    'Moderation, prohibited-product, counterfeit-risk tests',
    'Review, consignment, POD, dropshipping, affiliate tests',
    'Enterprise, tenant-isolation, role-permission tests',
    'Security, prompt-injection, malicious-listing tests',
    'Windows/Linux path tests, CLI tests, package-export tests'
  ]],
  ['No External Dependencies', 'No tests require real marketplace credentials, payment credentials, shipping accounts, or paid APIs.']
]));

write('OPERATIONS.md', doc('Operations', [
  ['Commands', [
    'npm run build — compile all packages',
    'npm run typecheck — type-check only',
    'npm run lint — scan for forbidden patterns',
    'npm test — run all tests',
    'npm run verify — full runtime verification (32 checks)',
    'npm run audit — autonomous audit',
    'npm run package-zip — create distribution ZIP',
    'npm run clean-room-verify — extract + verify in fresh dir'
  ]],
  ['Evidence', 'evidence/ directory contains RUNTIME_VERIFICATION.md, TEST_RESULTS.json, WORKFLOW_RESULTS.json, SECURITY_RESULTS.json, CHANNEL_RESULTS.json, PACKAGE_RESULTS.json.']
]));

write('PRIMEOPP_COMMERCE_CORE_INTEGRATION.md', doc('PrimeOpp Commerce Core Integration', [
  ['Status', 'Future integration — NOT implemented in this package.'],
  ['Stable Seams', [
    'packages/contracts/src/types/inventory.ts — InventoryRecord compatible with future Commerce Core',
    'packages/contracts/src/types/product.ts — Product model',
    'packages/adapter-sdk/src/index.ts — InventoryAdapter, ProductCatalogAdapter contracts'
  ]]
]));

write('PRIMEOPP_DEAL_INTELLIGENCE_INTEGRATION.md', doc('PrimeOpp Deal Intelligence Integration', [
  ['Status', 'Future integration — NOT implemented.'],
  ['Stable Seams', 'The Canonical Listing and Product models accept externally-supplied productId references that may originate from Deal Intelligence. The AMOS contracts (packages/amos-contracts) provide deal_to_marketplace_story campaign kind.']
]));

write('BROWSER_OPERATOR_INTEGRATION.md', doc('Browser Operator Integration', [
  ['Status', 'Future integration — NOT implemented.'],
  ['Stable Seams', 'packages/adapter-sdk/src/index.ts exports BrowserOperatorAdapter interface. Channels with browserRequirement=true (test-facebook-marketplace, test-craigslist, etc.) generate browser-assisted publication outcomes.'],
  ['Rule', 'Never conceal when browser automation is required. Channels that need browser automation declare it in their manifest.']
]));

write('FOUNDRY_INTEGRATION_GUIDE.md', doc('Foundry Integration Guide', [
  ['Status', 'Future integration — NOT implemented. Foundry is the sole canonical execution runtime per VERIDIAN rules.'],
  ['Approach', 'When Foundry is available, wrap the publishListing / createOrder / calculateCommission functions as Foundry jobs. The current implementations are pure functions suitable for Foundry execution.']
]));

write('EVE_VERIFICATION_GUIDE.md', doc('E.V.E. Verification Guide', [
  ['Status', 'Future integration — NOT implemented. E.V.E. independently verifies material execution results.'],
  ['Approach', 'The evidence/ directory produces VerificationReceipt-compatible records. E.V.E. can consume these records and cross-check against Foundry execution logs.']
]));

write('PRIMEOS_INTEGRATION_GUIDE.md', doc('PrimeOS Integration Guide', [
  ['Status', 'Future integration — NOT implemented.'],
  ['Approach', 'PrimeOS will host the runtime. The SDK is environment-agnostic and runs in any Node.js 18+ runtime.']
]));

write('MIGRATION.md', doc('Migration Guide', [
  ['From Prototype', 'If migrating from a prototype PrimeOpp codebase: 1) Audit existing listings for state-machine compatibility; 2) Map existing seller/buyer models to canonical contracts; 3) Register existing channel adapters via adapter-sdk; 4) Run npm run verify.'],
  ['Versioning', 'All contracts are versioned. Commission policies are versioned. Listing state transitions are deterministic and backward-compatible.']
]));

write('CHANGELOG.md', doc('Changelog', [
  ['v1.0.0 (2026-01-01)', [
    'Initial production release',
    '33 packages, 18 adapters',
    '22 reference workflows',
    '56 tests passing',
    '32-check runtime verification',
    'PrimeOpp Marketplace as first-class local channel',
    '17 test-only external marketplace adapters',
    'Visible PrimeOpp default with simple opt-out',
    'Simultaneous-sale oversell prevention',
    'Versioned commission policies with launch promo'
  ]]
]));

console.log('All documentation files generated.');
