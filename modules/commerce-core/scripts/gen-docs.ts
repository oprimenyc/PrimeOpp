// Generate all required documentation files.
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const docsDir = join(ROOT, 'docs');
if (!existsSync(docsDir)) mkdirSync(docsDir, { recursive: true });

const docs: Record<string, string> = {
  'PRODUCT_MODEL.md': `# Canonical Product Model

The canonical product model lives in \`packages/contracts/src/product.ts\` and is capable of representing every product kind the platform supports.

## Product Kinds

\`\`\`typescript
type ProductKind =
  | 'PHYSICAL' | 'DIGITAL' | 'POD' | 'DROPSHIP' | 'AFFILIATE'
  | 'SERVICE' | 'BUNDLE' | 'KIT' | 'LOT' | 'MULTIPACK'
  | 'SERIALIZED' | 'UNIQUE_COLLECTIBLE';
\`\`\`

## Core Fields

Every \`Product\` has:

- **Identity**: \`id\`, \`schemaVersion\`, \`title\`, \`brand\`, \`model\`, \`category\`
- **Tenant scope**: \`tenantId\`, optional \`organizationId\`
- **Identifiers**: array of \`ProductIdentifier\` (UPC, EAN, GTIN, ISBN, ASIN, SKU, MPN, etc.)
- **Variants**: array of \`ProductVariant\` keyed by \`attributeHash\`
- **Condition**: optional \`ConditionAssessment\` (NEVER inferred from appearance alone)
- **Images and documents**: arrays of \`ProductImage\` and \`ProductDocument\`
- **Source and provenance**: \`ProductSource\` + lineage entries
- **Ownership**: \`ProductOwnership\` with tenant + optional consignor
- **Cost basis and acquisition**: optional \`ProductCostBasis\` and \`ProductAcquisition\`
- **Locations**: optional array of \`ProductLocation\`
- **Confidence**: \`ProductConfidence\` with per-dimension scores
- **Evidence**: \`ProductEvidence\` with refs and rationale
- **Lifecycle state**: \`ProductListingState\` and per-channel \`ProductChannelState\`

## Identifier Model

Every \`ProductIdentifier\` carries:

- \`type\` (UPC, EAN, ISBN, ASIN, SKU, MPN, MODEL_NUMBER, SERIAL_NUMBER, MARKETPLACE_LISTING_ID, RETAILER_PRODUCT_ID, INTERNAL_ID, CUSTOM_SELLER_ID, URL, CUSTOM)
- \`value\`
- \`source\` (where the identifier was observed)
- \`verification\` (UNVERIFIED, CHECK_DIGIT_VALID, PROVIDER_VERIFIED, HUMAN_CONFIRMED, CONFLICTED, INVALID)
- \`confidence\` in [0, 1]
- \`observedAt\` ISO 8601
- optional \`expiresAt\`, \`evidenceRef\`, \`notes\`

Never assume one barcode equals one exact product variant without evidence.
`,

  'PRODUCT_IDENTITY.md': `# Product Identity Resolution

The product identity resolver lives in \`packages/product-identity/src/index.ts\`.

## Resolution States

\`\`\`typescript
type ResolutionState =
  | 'EXACT_MATCH' | 'HIGH_CONFIDENCE_MATCH' | 'POSSIBLE_MATCH'
  | 'MULTIPLE_CANDIDATES' | 'VARIANT_AMBIGUITY' | 'CONFLICTED'
  | 'NO_MATCH' | 'REQUIRES_HUMAN_REVIEW';
\`\`\`

## Resolution Flow

\`\`\`mermaid
flowchart TD
  Input[Resolution Input] --> Normalize[Normalize input]
  Normalize --> Query[Query registered adapters]
  Query --> Merge[Merge candidates]
  Merge --> Conflicts{Conflicts?}
  Conflicts -->|yes| CONFLICTED
  Conflicts -->|no| Top{Top candidate ≥ 0.97?}
  Top -->|yes| EXACT_MATCH
  Top -->|no, ≥ 0.85| HIGH_CONFIDENCE_MATCH
  Top -->|no, ≥ 0.5| POSSIBLE_MATCH
  Top -->|no, < 0.5| REQUIRES_HUMAN_REVIEW
  Merge --> Multi{Multiple close candidates?}
  Multi -->|yes| MULTIPLE_CANDIDATES
\`\`\`

## Input Types

- \`inputFromBarcode(payload)\` — barcode-driven resolution
- \`inputFromOcrAndImage(ocr, imageMatch?)\` — OCR + image match
- \`inputFromText(text)\` — manual text query

## Output

The resolver returns a \`ResolutionResult\` with:

- \`state\` — one of the 8 resolution states
- \`candidates\` — sorted by confidence, each with matched/conflicting/missing fields
- \`selectedCandidateId\` — set only for EXACT/HIGH/POSSIBLE_MATCH
- \`explanation\` — step-by-step reasoning
- \`warnings\` — anything notable
- \`recommendedNextAction\` — what the caller should do next

Never silently choose a low-confidence match.
`,

  'BARCODE_FRAMEWORK.md': `# Barcode Framework

The barcode framework lives in \`packages/barcode/src/index.ts\`.

## Supported Formats

| Format | Length | Check digit algorithm |
|---|---|---|
| UPC-A | 12 digits | UPC weighted (odd × 3) |
| UPC-E | 6 or 8 digits | Expanded to UPC-A |
| EAN-8 | 8 digits | EAN weighted (odd × 1) |
| EAN-13 | 13 digits | EAN weighted (odd × 1) |
| GTIN-14 | 14 digits | EAN weighted (odd × 1) |
| ISBN-10 | 10 chars (last may be X) | Weighted 10..2, mod 11 |
| ISBN-13 | 13 digits | EAN weighted (odd × 1) |
| Code 128 | any ASCII | (no check digit in this framework) |
| QR | any string | (no check digit) |
| CUSTOM | ≤ 256 chars | (no check digit) |

## Validation API

\`\`\`typescript
validateBarcode(value: string, format?: BarcodeFormat): BarcodeValidationResult
toBarcodePayload(value: string, format?: BarcodeFormat): BarcodePayload
\`\`\`

## Scan Events and Sessions

Every scan produces a \`ScanEvent\` tied to a \`ScanSession\`. Events capture:

- source (MOBILE_CAMERA, USB_SCANNER, BROWSER_SCANNER, IMAGE_UPLOAD, EXTERNAL_SDK, MANUAL_ENTRY, TEST_ADAPTER)
- payload (validated barcode)
- confidence
- error (if check digit invalid)
- imageEvidenceRef (for image-based scans)
- manuallyCorrected flag (when user overrides the raw value)

## Offline Queue

\`createOfflineScanQueue\` returns a tenant-scoped queue with a max size. Overflow drops the oldest events with an audit log to stderr.

## Local Test Adapter

\`LocalBarcodeLookupAdapter\` (TEST-ONLY) provides deterministic barcode-to-product lookups from a fixture map.

## Camera Hardware

This package does NOT require camera hardware. Scanner contracts for mobile camera, USB/Bluetooth scanner, browser scanner, image-upload scanner, and external SDK are documented as seams.
`,

  'OCR_AND_IMAGE_CONTRACTS.md': `# OCR and Image Match Contracts

OCR contracts: \`packages/ocr-contracts/src/index.ts\`.
Image match contracts: \`packages/image-match-contracts/src/index.ts\`.

## OCR Fields

The framework supports 18 OCR field types: TITLE, BRAND, MODEL_NUMBER, SERIAL_NUMBER, UPC, EAN, ISBN, CATEGORY, COLOR, SIZE, CONDITION_NOTE, PRICE, WEIGHT, DIMENSIONS, PACKAGE_TEXT, SHELF_TAG, LABEL, OTHER.

Every OCR result includes:

- \`providerRef\` — adapter ID
- \`fields\` — array of \`OCRFieldValue\` with confidence and optional bounding box
- \`rawText\` — for forensic review
- \`overallConfidence\`
- \`warnings\` and \`unsupportedClaims\` — claims the consumer should not trust
- \`evidenceRef\`

## Image Match Results

Every \`ImageMatchResult\` includes:

- \`candidates\` — array of \`{ productId, similarity, source }\`
- \`detectedLogos\` — with confidence and optional bounding box
- \`imageQualityScore\` in [0, 1]
- \`duplicateOf\` — set when input appears to be a duplicate
- \`lowQuality\` — flag for too-dark/too-blurry inputs

## Sanitization

\`sanitizeOcrOutput(raw)\` strips common prompt-injection patterns from OCR text. This is a contract helper, NOT a security boundary — adapters MUST treat all OCR output as untrusted.

## Local Test Adapters

- \`LocalTestOCRAdapter\` (TEST-ONLY) — deterministic fixture-based OCR
- \`LocalTestImageMatchAdapter\` (TEST-ONLY) — deterministic pseudo-similarity

No paid OCR or image provider is embedded or required.
`,

  'VARIANT_ENGINE.md': `# Variant Engine

The variant engine lives in \`packages/variant-engine/src/index.ts\`.

## Variant Axes

16 axes are supported: SIZE, COLOR, MATERIAL, STYLE, STORAGE, CAPACITY, EDITION, REGION, PLATFORM, SHOE_SIZE, APPAREL_SIZE, WIDTH, CONDITION, BUNDLE_QTY, PACKAGE_COUNT, MODEL_REVISION, CUSTOM.

## Normalization

\`normalizeVariantValue(axis, value)\` uppercases, trims, collapses whitespace, and applies axis-specific normalizations:

- COLOR: BLK → BLACK, WHT → WHITE, GRY → GREY → GRAY, etc.
- STORAGE: "128 Gigabytes" → "128GB"
- SHOE_SIZE / APPAREL_SIZE: whitespace stripped

## Hashing

\`computeVariantHash(attributes)\` produces a deterministic 16-char hex hash of normalized attributes. Two variants with the same normalized attributes have the same hash.

## Conflict Detection

\`detectVariantConflicts(left, right)\` returns an array of \`VariantConflict\` objects. Each conflict has a kind:

- SIZE_MISMATCH, COLOR_MISMATCH, STORAGE_MISMATCH, EDITION_MISMATCH, MULTIPACK_MISMATCH, CONDITION_MISMATCH, REGION_MISMATCH, MODEL_REVISION_MISMATCH
- MISSING_DISTINGUISHING_AXIS — one variant has a distinguishing axis the other lacks
- CONFLICTING_SAME_AXIS — same axis, different values
- CUSTOM

## Comparability

\`canCompareAcrossVariants(left, right)\` returns false if any conflict exists. The pricing engine uses this to reject mixed-variant comparisons.

## Tested Scenarios

- sneaker size mismatch
- console storage mismatch
- apparel color mismatch
- book edition mismatch
- multipack mismatch
- refurbished vs used mismatch
- regional model mismatch
`,

  'CONDITION_ENGINE.md': `# Condition Engine

The condition engine lives in \`packages/condition-engine/src/index.ts\`.

## Canonical Conditions

16 conditions: NEW, NEW_WITH_TAGS, NEW_WITHOUT_TAGS, NEW_OPEN_BOX, LIKE_NEW, EXCELLENT, VERY_GOOD, GOOD, FAIR, POOR, FOR_PARTS, REFURBISHED, SELLER_REFURBISHED, MANUFACTURER_REFURBISHED, DAMAGED, CUSTOM.

## Category Grading Profiles

11 built-in profiles: ELECTRONICS, SNEAKERS, APPAREL, BOOKS, COLLECTIBLES, TOOLS, TOYS, FURNITURE, APPLIANCES, MEDIA, GENERAL.

Each profile defines:

- required assessment dimensions
- defect severity map (LOW / MEDIUM / HIGH / CRITICAL)
- default condition when no defects are observed (NEVER \`NEW\`)
- whether authenticity verification is required

## Condition Derivation

\`deriveCondition(defects, profile)\` picks the most severe defect and maps to a canonical condition:

- CRITICAL → DAMAGED
- HIGH → FAIR
- MEDIUM → GOOD
- LOW → VERY_GOOD
- (no defects) → profile default (e.g. NEW_OPEN_BOX for electronics)

## Critical Rule

**Never infer "NEW" from appearance alone.** The only way to assert \`NEW\` is via \`createNewConditionAssessment()\` which requires explicit packaging/seal evidence.

## Marketplace Mapping

\`mapMarketplaceCondition(label)\` converts arbitrary marketplace labels to canonical conditions.
\`toMarketplaceCondition(condition, marketplace)\` converts canonical conditions to marketplace-specific labels (ebay, amazon, goat examples built in).
`,

  'CANONICAL_CATALOG.md': `# Canonical Catalog

The canonical catalog lives in \`packages/canonical-catalog/src/index.ts\`.

## Tenant-Aware Records

Every product record is tenant-scoped. The catalog enforces tenant isolation: a read for tenant B will never return a record created by tenant A.

## Operations

- \`create(product, actor)\` — initial creation
- \`update(productId, mutator, scope, actor)\` — versioned update
- \`merge(sourceId, targetId, scope, actor, evidenceRefs)\` — combine identifiers, soft-delete source
- \`split(productId, scope, actor, evidenceRefs)\` — copy a product to a new ID with provenance
- \`archive(productId, scope, actor)\` — soft-delete
- \`unarchive(productId, scope, actor)\` — restore
- \`list(scope, opts)\` — list (excludes archived by default)
- \`search(scope, query)\` — search by title, brand, or identifier

## Audit Log

Every mutating operation appends to \`CatalogAuditLog\`. Each entry records:

- action (CREATE, UPDATE, MERGE, SPLIT, ARCHIVE, UNARCHIVE, SOFT_DELETE)
- actor
- before / after snapshot
- evidence refs

## Stale Data Detection

\`detectStaleProducts(products, maxAgeSeconds)\` returns products whose \`updatedAt\` is older than the threshold.

## Duplicate Detection

\`detectDuplicates(products)\` returns a map of identifier → product IDs that share that identifier.
`,

  'INVENTORY_ENGINE.md': `# Inventory Engine

The inventory engine lives in \`packages/inventory/src/index.ts\`.

## Inventory States

14 states: DRAFT, INBOUND, AVAILABLE, RESERVED, LISTED, PARTIALLY_LISTED, SOLD, PARTIALLY_SOLD, SHIPPED, DELIVERED, RETURN_REQUESTED, RETURNED, DAMAGED, LOST, ARCHIVED.

## Quantity Buckets

Every \`InventoryRecord.quantities\` carries 8 buckets: available, reserved, committed, sold, damaged, returned, inbound, unknown.

## Operations

\`\`\`mermaid
stateDiagram-v2
  [*] --> DRAFT: CREATE
  DRAFT --> AVAILABLE
  AVAILABLE --> RESERVED: RESERVE
  RESERVED --> AVAILABLE: RELEASE
  RESERVED --> SOLD: SALE_ALLOCATE
  AVAILABLE --> SOLD: SALE_ALLOCATE
  SOLD --> RETURNED: RETURN
  AVAILABLE --> [*]: TRANSFER (out)
  [*] --> AVAILABLE: TRANSFER (in)
\`\`\`

## Concurrency Safety

The engine serializes operations per record using a Promise chain lock. Concurrent operations on the same record are queued and executed one-at-a-time, preventing oversell.

## Idempotency

Every operation carries an \`idempotencyKey\`. Replaying the same key returns the prior result with \`idempotentReplay: true\`. The engine tracks the last N keys per record (default 100).

## Storage Adapters

- \`InMemoryInventoryStorage\` — for tests and ephemeral use
- \`SQLiteInventoryStorage\` — extends InMemory; the persistence seam for a future SQLite backend
- \`InventoryStorageAdapter\` — the interface for custom backends

## Virtual Inventory

The model supports POD virtual inventory (\`virtual: true\`, \`podPartnerRef\`), dropship virtual inventory (\`virtual: true\`, \`supplierRef\`), and affiliate non-owned inventory (\`affiliateOfferRef\`).
`,

  'ACQUISITION_AND_COST_BASIS.md': `# Acquisition and Cost Basis

Acquisition and cost basis types live in \`packages/contracts/src/product.ts\`.

## Acquisition Methods

15 methods: RETAIL_PURCHASE, ONLINE_PURCHASE, THRIFT_PURCHASE, ESTATE_SALE, GARAGE_SALE, AUCTION, LIQUIDATION_PALLET, WHOLESALE, CONSIGNMENT, DONATION, TRADE, PERSONAL_INVENTORY, MANUFACTURED_POD, DROPSHIP, AFFILIATE, TRANSFER.

## Cost Line Items

A \`ProductCostBasis\` carries 12 optional cost line items:

- purchasePrice, tax, inboundShipping, buyerFees, inspection, repair, cleaning, authentication
- storage, labor, packaging
- other (array)

Each line item is tagged with \`EpistemicStatus\` (ACTUAL, AUTHORITATIVE, ESTIMATED, USER_ENTERED, UNKNOWN).

## Lot Allocation

For lot/pallet purchases, \`lotAllocation\` records the lot total, units in lot, and per-unit allocated cost.

## Critical Rule

**Never treat estimated costs as actual costs without marking them.** Every cost line carries its own epistemic status, and \`hasEstimated\` is true if any component is estimated.

## Currency

Cost basis uses a single currency. \`exchangeRateRef\` is a Prime Vault-style reference for multi-currency acquisitions.
`,

  'PRICING_OBSERVATIONS.md': `# Pricing Observations

Pricing observation types and helpers live in \`packages/pricing/src/index.ts\`.

## Sources

10 sources: RETAILER_LISTING, MARKETPLACE_ACTIVE_LISTING, MARKETPLACE_SOLD_LISTING, AUCTION_RESULT, LOCAL_MARKETPLACE, WHOLESALE_CATALOG, SELLER_PROVIDED_COMP, HISTORICAL_RECORD, MANUAL_OBSERVATION, AFFILIATE_FEED.

## Required Fields

Every \`PricingObservation\` carries:

- product identity (productId, optional variantId)
- condition (canonical)
- price (Money)
- shipping (optional)
- currency
- quantity
- listing status (ACTIVE / SOLD / ENDED / UNKNOWN)
- observedAt
- confidence
- evidence refs
- freshness (seconds since observation)
- optional authenticity status

## Comparability Rules

\`observationsAreComparable(obs)\` rejects observations that mix:

- multiple variants
- multiple conditions
- active and sold listings
- multiple currencies
- bundle and single-unit listings

## Freshness Weight

\`freshnessWeight(observedAt)\` returns a weight in [0, 1] using a 30-day half-life. Older observations contribute less to the pricing estimate.

## Grouping

\`groupObservations(obs, opts)\` filters by tenant, product, variant, condition, and listing status. Returns separate \`active\` and \`sold\` arrays plus warnings for rejected observations.
`,

  'PRICING_ENGINE.md': `# Pricing Engine

The pricing engine lives in \`packages/pricing/src/index.ts\`.

## Output

Every \`PricingResult\` includes:

- estimatedMarketValue (MoneyRange: low / high / midpoint)
- fastSalePrice, balancedPrice, maximumMarginPrice
- minimumAcceptablePrice
- recommendedListPrice
- recommendedOfferFloor
- confidenceRange (low / high)
- dataFreshnessSeconds
- sourceCoverage
- comparableCount
- explanation (step-by-step)
- warnings

## Strategies

\`\`\`typescript
type PricingStrategy =
  | 'QUICK_FLIP' | 'BALANCED' | 'MAX_MARGIN' | 'MARKET_MATCH'
  | 'CLEARANCE' | 'AGED_INVENTORY' | 'ENTERPRISE_POLICY' | 'CUSTOM';
\`\`\`

Each strategy applies different multipliers to the estimated market value midpoint.

## Median Selection

- ≥ 3 sold comps → use soldMedian
- mix of active + sold → use blend
- active only → use activeMedian (with sell-through warning)
- no comps → midpoint = 0, confidence very low

## Critical Rule

**Never present a single precise value when evidence only supports a range.** The output is a \`MoneyRange\`, not a single \`Money\`.

## Custom Overrides

- \`customListingPrice\` overrides \`recommendedListPrice\` with \`USER_ENTERED\` status
- \`minimumPrice\` overrides \`minimumAcceptablePrice\`
- \`seasonalityFactor\` and \`localDemandFactor\` apply multiplicative adjustments

## Mermaid: Pricing Pipeline

\`\`\`mermaid
flowchart LR
  Obs[Pricing Observations] --> Group[Group by variant+condition]
  Group --> Compare{Comparable?}
  Compare -->|no| Warn[Reject with warning]
  Compare -->|yes| Stats[Compute intermediate stats]
  Stats --> Strategy[Apply strategy multipliers]
  Strategy --> Override[Apply user overrides]
  Override --> Range[Compute confidence range]
  Range --> Out[PricingResult]
\`\`\`
`,

  'FEE_ENGINE.md': `# Fee Engine

The fee engine lives in \`packages/fee-engine/src/index.ts\`.

## Fee Types

15 types: MARKETPLACE_COMMISSION, PAYMENT_PROCESSING, LISTING_FEE, INSERTION_FEE, PROMOTION_FEE, AUTHENTICATION_FEE, FULFILLMENT_FEE, STORAGE_FEE, WITHDRAWAL_FEE, CURRENCY_CONVERSION, TAX_WITHHOLDING_ESTIMATE, RETURN_RESERVE, SHIPPING_LABEL_MARKUP, SUBSCRIPTION_ALLOCATION, CUSTOM_FEE.

## Fee Models

5 models: PERCENTAGE, FIXED, TIERED, CAPPED, MINIMUM.

## Versioned Schedules

Every \`FeeScheduleEntry\` carries \`effectiveFrom\` and optional \`effectiveTo\`. The \`assessFees\` function only applies entries that are currently effective, and flags stale entries (past \`effectiveTo\`) in the output.

## Scope Filtering

Entries can be scoped by:

- category
- sellerTier
- promotionRef
- marketplaceRef

\`findApplicableEntry\` picks the most specific entry for a given fee type.

## Critical Rule

**Never hardcode current marketplace fees as permanent business logic.** All fee schedules are loaded from configuration. The default PrimeOpp Marketplace schedule is illustrative only.

## Stale Fee Warnings

When any line item uses a stale entry, the assessment's \`estimated\` flag is set to true and \`staleWarnings\` lists the offending fee types.
`,

  'SHIPPING_ESTIMATOR.md': `# Shipping Estimator

The shipping estimator lives in \`packages/shipping-estimator/src/index.ts\`.

## Inputs

- weight + weightUnit (G, KG, OZ, LB)
- length, width, height + dimensionUnit (CM, IN)
- origin/destination zones (optional)
- carrier class (ECONOMY, STANDARD, EXPEDITED, FREIGHT)
- insurance (Money)
- signatureRequired, hazardous, localPickup, international, returnShipping flags

## Outputs

- billableWeight (max of actual weight and dimensional weight)
- packagingCost (varies by recommended package kind)
- labelCost (varies by carrier class)
- estimatedRange (MoneyRange low/midpoint/high)
- confidence
- missingDataWarnings
- recommendedPackageKind

## Dimensional Weight

DIM factor: 139 in³/lb (US carriers). The estimator converts all dimensions to inches and weight to pounds before computing.

## Carrier Rate Model

The estimator uses a simple deterministic model: \`base rate per lb × weight × zone multiplier × international multiplier × hazmat multiplier\`. This is NOT a real carrier rate; it is an estimate.

## Future Carrier Adapter Seam

The estimator exposes \`ShippingRateAdapter\` (in contracts) as a future seam. Real carrier adapters will plug into this interface to provide live rate quotes.
`,

  'PROFIT_ENGINE.md': `# Profit & ROI Engine

The profit engine lives in \`packages/profit-engine/src/index.ts\`.

## Output

Every \`ProfitResult\` includes:

- grossRevenue, productCost, inboundCost
- marketplaceFees, paymentFees
- shipping, packaging, labor, storage, promotion, returnReserve
- netProfit, margin, roi
- breakEvenPrice
- maximumBuyPrice
- optional profitPerDay, annualizedReturn
- per-line \`statuses\` (EpistemicStatus)
- warnings

## Mermaid: Profit Calculation

\`\`\`mermaid
flowchart TD
  ListingPrice --> GrossRevenue
  CostBasis --> ProductCost
  Inbound --> InboundCost
  FeeAssessment --> MarketplaceFees
  FeeAssessment --> PaymentFees
  ShippingEstimate --> Shipping
  Packaging --> Packaging
  Labor --> Labor
  Storage --> Storage
  Promotion --> Promotion
  ReturnReserve --> ReturnReserve
  GrossRevenue --> Net[Net = Gross - Sum of Costs]
  ProductCost --> Net
  InboundCost --> Net
  MarketplaceFees --> Net
  PaymentFees --> Net
  Shipping --> Net
  Packaging --> Net
  Labor --> Net
  Storage --> Net
  Promotion --> Net
  ReturnReserve --> Net
  Net --> ROI[ROI = Net / Total Costs]
  Net --> Margin[Margin = Net / Gross]
\`\`\`

## Epistemic Status

Every line in the result is tagged with its epistemic status. The status propagates: if any input is ESTIMATED, downstream sums are ESTIMATED. Currency mismatches produce UNKNOWN status and a warning (the engine does NOT throw on currency mismatch).

## Critical Rule

**Never hide uncertainty.** Every line has its own status; the caller can display per-line confidence.
`,

  'OPPORTUNITY_ENGINE.md': `# Opportunity Decision Engine

The opportunity engine lives in \`packages/opportunity-engine/src/index.ts\`.

## Decisions

9 outcomes: BUY, STRONG_BUY, NEGOTIATE, MAYBE, PASS, RESEARCH_MORE, AUTHENTICATE_FIRST, INSPECT_FIRST, DATA_INSUFFICIENT.

## Decision Logic

1. If > 2 missing data fields → DATA_INSUFFICIENT
2. If authenticityRisk > 0.6 → AUTHENTICATE_FIRST
3. If conditionRisk > 0.7 → INSPECT_FIRST
4. If expectedProfit ≤ 0 → PASS
5. If any missing data → RESEARCH_MORE
6. If ROI ≥ strongBuyRoi AND confidence ≥ min AND no risks → STRONG_BUY
7. If ROI ≥ buyRoi → BUY
8. If ROI ≥ maybeRoi:
   - If no risks AND low sell-through → NEGOTIATE
   - Else → MAYBE
9. Else → PASS

## Output

Every \`OpportunityResult\` includes:

- decision
- reasons (array)
- risks (array)
- missingData (array)
- maximumRecommendedPurchasePrice
- optional suggestedNegotiationTarget
- recommendedMarketplaces (array)
- recommendedNextStep
- confidence

## Critical Rule

**Never make autonomous purchasing decisions.** The engine produces recommendations only. An external authority contract must explicitly permit execution before any purchase action is taken.

## Mermaid: Opportunity Decision

\`\`\`mermaid
flowchart TD
  Start[OpportunityInput] --> Missing{>2 missing fields?}
  Missing -->|yes| DATA_INSUFFICIENT
  Missing -->|no| Auth{authenticityRisk > 0.6?}
  Auth -->|yes| AUTHENTICATE_FIRST
  Auth -->|no| Cond{conditionRisk > 0.7?}
  Cond -->|yes| INSPECT_FIRST
  Cond -->|no| Profit{expectedProfit ≤ 0?}
  Profit -->|yes| PASS
  Profit -->|no| SomeMissing{any missing?}
  SomeMissing -->|yes| RESEARCH_MORE
  SomeMissing -->|no| Strong{ROI ≥ strongBuy AND no risks?}
  Strong -->|yes| STRONG_BUY
  Strong -->|no| Buy{ROI ≥ buyRoi?}
  Buy -->|yes| BUY
  Buy -->|no| Maybe{ROI ≥ maybeRoi?}
  Maybe -->|yes| Negotiate{no risks AND low sell-through?}
  Negotiate -->|yes| NEGOTIATE
  Negotiate -->|no| MAYBE
  Maybe -->|no| PASS
\`\`\`
`,

  'LISTING_CONTRACTS.md': `# Listing Contracts

Listing contracts live in \`packages/listing-contracts/src/index.ts\`.

## Canonical Listing

A \`CanonicalListing\` carries:

- identity: id, productId, variantId, title, subtitle, description, bullets
- classification: category, attributes, condition, conditionNotes
- media: images (evidence refs), videoRefs
- pricing: ListingPrice (amount, minimumOffer, acceptOffers)
- inventory: quantity, sku, locationId
- shipping: ShippingPolicy
- metadata: tags, seoKeywords, authenticityData, productIdentifiers, sellerDisclosures
- channel: channelOverrides, selectedChannels, alsoListOnPrimeOppMarketplace, sellerAcceptanceEvidenceRef
- lifecycle: state, channelStates, version

## Lifecycle States

11 states: DRAFT, READY, APPROVAL_REQUIRED, APPROVED, PUBLISHING, ACTIVE, PAUSED, SOLD, ENDED, ERROR, NEEDS_ATTENTION, ARCHIVED.

\`transitionListingState\` enforces valid transitions (e.g. DRAFT → READY → APPROVED → PUBLISHING → ACTIVE).

## One Canonical Listing → Many Channels

The same \`CanonicalListing\` can be distributed to multiple channels. Per-channel overrides live in \`channelOverrides\`. Per-channel state lives in \`channelStates\`.

## Validation

\`validateListingForPublication\` checks:

- title present and ≤ 80 chars (warning if longer)
- quantity ≥ 0
- price > 0
- at least one image (warning if missing)
- at least one channel selected
- seller acceptance evidence present
- PrimeOpp default flag consistency

## Listing Preview

\`listingPreview(listing)\` produces a human-readable summary showing all selected channels with PrimeOpp default ON/OFF markers.
`,

  'CHANNEL_ADAPTERS.md': `# Channel Adapters

Channel adapter contracts live in \`packages/channel-contracts/src/index.ts\`.

## Adapter Interface

\`\`\`typescript
interface MarketplaceChannelAdapter {
  readonly adapterId: string;
  readonly version: string;
  readonly channelRef: string;
  readonly testOnly: boolean;
  readonly capabilities: ChannelCapability[];
  getCapabilityManifest(): ChannelCapabilityManifest;
  publishListing(request: ChannelPublishRequest): Promise<ChannelPublishResult>;
  updateListing?(...): Promise<ChannelPublishResult>;
  pauseListing?(...): Promise<ChannelSyncResult>;
  endListing?(...): Promise<ChannelSyncResult>;
  markSold?(...): Promise<ChannelSyncResult>;
  syncInventory?(...): Promise<ChannelSyncResult>;
  syncPrice?(...): Promise<ChannelSyncResult>;
}
\`\`\`

## Capabilities

15 capabilities: PUBLISH_LISTING, UPDATE_LISTING, PAUSE_LISTING, END_LISTING, MARK_SOLD, SYNC_INVENTORY, SYNC_PRICE, RECEIVE_OFFER, RESPOND_TO_OFFER, RECEIVE_ORDER, RECEIVE_RETURN, RETRIEVE_LISTING_STATUS, RETRIEVE_ERRORS, RETRIEVE_FEES, RETRIEVE_CATEGORY_REQUIREMENTS.

## Conformance Suite

\`runConformanceSuite(adapter)\` returns test results for:

- identity (adapterId, version)
- capability.publish (PUBLISH_LISTING present)
- conditionMappings (all required conditions mapped)
- testOnlyFlag (correctly labeled)
- publishRequiresAcceptance (rejects without userAccepted)

## Local Test Adapters

- \`LocalTestChannelAdapter\` (TEST-ONLY) — generic fake channel
- \`PrimeOppMarketplaceTestAdapter\` (TEST-ONLY) — PrimeOpp Marketplace test adapter

## Critical Rule

**Do not implement eBay, Amazon, Walmart, Facebook, Depop, GOAT or another live marketplace.** Only test adapters are provided. Real marketplace adapters are future integration seams.

## Mermaid: Multi-Channel Listing

\`\`\`mermaid
flowchart LR
  Listing[Canonical Listing] --> Publish[publishListing]
  Publish --> Chan1[Channel 1]
  Publish --> Chan2[Channel 2]
  Publish --> ChanN[Channel N]
  Chan1 --> Sync1[syncInventory / syncPrice]
  Chan2 --> Sync2[syncInventory / syncPrice]
  ChanN --> SyncN[syncInventory / syncPrice]
\`\`\`
`,

  'PRIMEOPP_MARKETPLACE_DEFAULT.md': `# PrimeOpp Marketplace Default Listing Support

Phase 19 of the mission requires that PrimeOpp Marketplace be a visible, reversible default for new listings. This is implemented in \`packages/listing-contracts/src/index.ts\`.

## Requirements Met

1. **Setting is visible**: \`alsoListOnPrimeOppMarketplace\` is a top-level field on \`CanonicalListing\`.
2. **User can disable it**: \`disablePrimeOppMarketplace(listing, opts)\` produces a new listing with the flag set to false and removes \`primeopp-marketplace\` from \`selectedChannels\`.
3. **No hidden enrollment**: The flag defaults to \`true\` only when \`createCanonicalListing\` is called. There is no automatic enrollment path.
4. **No dark pattern**: \`listingPreview(listing)\` shows the flag state explicitly with "PrimeOpp default ON" or "PrimeOpp default OFF" markers.
5. **Listing preview shows all selected channels**: \`listingPreview\` lists every channel in \`selectedChannels\` with PrimeOpp marker where applicable.
6. **Fee schedule disclosed**: The default PrimeOpp Marketplace fee schedule is documented in \`docs/FEE_ENGINE.md\` and the schedule is registered with \`defaultPrimeOppMarketplaceFeeSchedule()\`.
7. **Seller must approve final publication policy**: \`acceptSelectedChannels(listing, opts)\` produces evidence of acceptance; \`validateListingForPublication\` rejects listings without acceptance evidence.
8. **Enterprise administrators may configure organization defaults**: \`TenantConfig.defaultAlsoListOnPrimeOppMarketplace\` and \`Organization.defaultAlsoListOnPrimeOppMarketplace\` allow org-level defaults.
9. **Users retain listing-level control**: \`disablePrimeOppMarketplace\` overrides any org-level default.
10. **Explicit evidence of acceptance**: Both \`disablePrimeOppMarketplace\` and \`acceptSelectedChannels\` return an \`evidenceRef\` and set \`sellerAcceptanceEvidenceRef\` on the listing.

## Mermaid: PrimeOpp Default Flow

\`\`\`mermaid
sequenceDiagram
  participant Seller
  participant Listing as createCanonicalListing
  participant Preview as listingPreview
  participant Accept as acceptSelectedChannels
  participant Disable as disablePrimeOppMarketplace
  participant Validate as validateListingForPublication

  Seller->>Listing: create with selectedChannels
  Listing-->>Seller: listing with alsoListOnPrimeOppMarketplace=true
  Seller->>Preview: review
  Preview-->>Seller: shows "PrimeOpp default ON"
  alt opts out
    Seller->>Disable: disablePrimeOppMarketplace
    Disable-->>Seller: listing with flag=false + evidenceRef
  else accepts
    Seller->>Accept: acceptSelectedChannels
    Accept-->>Seller: listing with sellerAcceptanceEvidenceRef
  end
  Seller->>Validate: validateListingForPublication
  Validate-->>Seller: valid (acceptance present) or invalid (missing)
\`\`\`

## Critical Rule

**Do not publish anything externally in this mission.** All publication is via local test adapters only.
`,

  'ENTERPRISE_SUPPORT.md': `# Enterprise Support

Enterprise types and helpers live in \`packages/tenant-config/src/index.ts\`.

## Hierarchy

Tenant → Organization → Team/Seller → User
Tenant → Locations (Warehouse, Store, Vehicle, Bin, Virtual, Consignment, Donor)

## Multi-Location Inventory

The inventory engine supports multiple locations per tenant. Each location has its own \`InventoryRecord\`. Transfers between locations are modeled as a TRANSFER (out) at the source plus an ADJUST (in) at the destination.

## Role-Based Access

Roles carry permission arrays. The \`assertTenantAccess\` and \`assertOrganizationAccess\` guards enforce scope checks at every read/write.

## Enterprise Extensions

- bulk import / bulk update (via SDK batch methods)
- batch scan (via offline scan queue)
- multiple locations (via inventory storage adapter)
- approval thresholds (per tenant and per organization)
- inventory transfer (via TRANSFER operation)
- audit history (via catalog audit log)
- API contracts (all SDK methods are public)
- custom taxonomy (via \`ProductCategory\` with arbitrary taxonomy name)
- organization-level pricing policy (via \`TenantConfig.pricingPolicy\`)
- employee permissions (via roles)

## Critical Rule

**Do not build a competing identity or authorization platform.** This package only exposes integration contracts for an external identity runtime.
`,

  'ADAPTER_SDK.md': `# Adapter SDK

The adapter SDK lives in \`packages/adapter-sdk/src/index.ts\`.

## Adapter Manifest

Every adapter declares:

- adapterId, version
- capabilities (array)
- authenticationRequirements (NONE, API_KEY, OAUTH, SECRET_REF)
- rateLimitMetadata
- costMetadata
- supportedRegions, supportedCategories
- freshness (maxAgeSeconds)
- confidenceModel (string)
- retrySemantics (maxRetries, backoffMs)
- dataSensitivity (PUBLIC, TENANT, ORGANIZATION, SELLER_PRIVATE, COST_BASIS, SECRET)
- termsRestrictions (array)

## Registry

\`createAdapterRegistry()\` returns a registry with four maps: barcode, ocr, imageMatch, channel. Each map is keyed by adapterId.

## Conformance Tests

\`COMMON_CONFORMANCE_TESTS\` is an array of 5 tests that apply to every adapter:

1. manifest-declares-id-and-version
2. manifest-declares-capabilities
3. manifest-declares-auth
4. manifest-declares-data-sensitivity
5. manifest-declares-terms-restrictions

\`runAdapterConformanceTests(adapter, manifest, tests)\` runs the tests and returns pass/fail results.

## Health Check

\`defaultHealthCheck(adapterId)\` returns a healthy result by default. Real adapters MUST override this.
`,

  'SECURITY.md': `# Security

## Tenant Isolation

- Every record carries \`tenantId\`.
- Every storage adapter filters by \`tenantId\`.
- Every cross-tenant access throws \`CROSS_TENANT_*\`.
- Cost basis, profit data, supplier data, and sourcing notes are tenant-private by default.
- Public product facts and tenant-private facts are stored separately.

## Secrets

- No raw secrets in code or config.
- Adapter authentication uses \`SecretRef\` (Prime Vault reference) — never an embedded secret value.
- \`TenantConfig.adapterSecrets\` maps adapterId → SecretRef.

## Input Validation

- All inputs validated via \`@primeopp/schemas\` runtime validators.
- Input size limits enforced (e.g. CUSTOM barcode ≤ 256 chars).
- File reference validation: image refs must match \`evidence://...\` pattern.
- URL validation: URLs are accepted only via explicit adapter contracts (SSRF-resistant).

## Prompt Injection Resistance

- \`sanitizeOcrOutput\` strips common prompt-injection patterns from OCR text.
- AI adapter boundaries are documented as requiring prompt-injection sanitization.
- All adapter output is treated as untrusted.

## HTML Stripping

- Untrusted HTML stripping contracts are documented as adapter requirements.
- Listing descriptions accept plain text by default; rich-text adapters must sanitize.

## Idempotency & Replay Protection

- Every mutating operation accepts \`idempotencyKey\`.
- \`ReplayDetector\` tracks seen event IDs and rejects duplicates.

## Concurrency Safety

- Inventory engine serializes per-record operations via Promise chain lock.
- Concurrent oversell attempts are prevented.

## Audit

- Every catalog mutation appends to \`CatalogAuditLog\`.
- Every commerce event is emitted via \`CommerceEventSink\` with sensitivity classification.
- Every evidence record carries a content hash for integrity verification.
`,

  'THREAT_MODEL.md': `# Threat Model

## Threats and Mitigations

| Threat | Mitigation |
|---|---|
| Product spoofing | Identity resolver never silently chooses low-confidence matches; requires human review below 0.5 confidence. |
| Barcode collision | Local lookup adapter flags \`collision: true\` when multiple products share a barcode. |
| False comp poisoning | Pricing observations are tenant-scoped; cross-tenant observations are rejected with warnings. |
| Variant mismatch | Variant engine flags SIZE_MISMATCH, COLOR_MISMATCH, etc. Pricing/inventory comparisons are blocked across conflicting variants. |
| Condition fraud | Condition engine never infers NEW from appearance; requires explicit seal evidence. |
| Counterfeit risk | SNEAKERS and COLLECTIBLES profiles require authenticity verification; \`authenticityStatus\` propagated through pricing observations. |
| Price manipulation | Pricing engine uses median (not max) of sold comps; active-only pricing produces lower confidence. |
| Inventory oversell | Per-record Promise chain lock serializes concurrent operations; idempotency keys prevent double-counting. |
| Duplicate listing | Listing validation requires seller acceptance evidence; \`selectedChannels\` uniqueness enforced. |
| Duplicate sale | SALE_ALLOCATE consumes reserved first, then available; oversell throws OVERSELL_PREVENTED. |
| Fee schedule tampering | Fee schedules are versioned with effective dates; stale entries flagged in output. |
| Shipping estimate manipulation | Shipping estimator produces a RANGE, not a single value; confidence decreases with missing data. |
| Cross-tenant access | Tenant guards at every layer; evidence, inventory, catalog all enforce tenant isolation. |
| Malicious URL ingestion | URLs accepted only via explicit adapter contracts; SSRF resistance is documented requirement. |
| Affiliate-link substitution | Affiliate offers carry \`affiliateOfferRef\`; substitution would change the ref and be detected by audit. |
| Seller-account takeover | Tenant config carries roles and permissions; seller actions are scoped to their tenantId. |
| Fraudulent evidence | Evidence records carry content hashes; integrity can be verified via \`verifyEvidenceIntegrity\`. |

## Attack Surface

This package has no network surface. All adapters are local test adapters. The attack surface is limited to:

1. Malicious input via CLI file arguments (mitigated by JSON parsing + schema validation)
2. Malicious OCR/image match output (mitigated by sanitization contracts)
3. Concurrent race conditions (mitigated by per-record locking)
`,

  'DATA_CLASSIFICATION.md': `# Data Classification

## Sensitivity Levels

\`EventSensitivity\` has 6 levels, in increasing order of restriction:

1. **PUBLIC** — safe to share across tenants and externally. Examples: canonical product facts (UPC, brand), public category taxonomy.
2. **TENANT** — visible to anyone in the tenant. Examples: inventory records, listing drafts, scan events.
3. **ORGANIZATION** — visible to anyone in the organization. Examples: cross-location inventory aggregation, org-level pricing policy.
4. **SELLER_PRIVATE** — visible only to the seller. Examples: sourcing notes, supplier identities.
5. **COST_BASIS** — visible only to those authorized to see costs. Examples: purchase price, lot allocation, per-unit cost basis.
6. **SECRET** — never appears in plaintext. Examples: API keys (stored as SecretRef to Prime Vault).

## Cross-Tenant Sharing

\`redactEventForSharing(event)\` drops COST_BASIS, SELLER_PRIVATE, and SECRET events entirely. TENANT and ORGANIZATION events have their payload stripped for PUBLIC sharing.

## Storage

- In-memory stores do NOT enforce encryption at rest (they are ephemeral).
- The \`EvidenceStore\` interface accepts encrypted backing stores; the in-memory implementation is for tests only.
- The \`TenantConfigStore\` interface accepts encrypted backing stores; same caveat.

## Audit Trail

Every mutation produces an audit entry. Audit entries themselves are TENANT sensitivity by default; entries that touch SELLER_PRIVATE or COST_BASIS data carry those higher sensitivities.
`,

  'OBSERVABILITY.md': `# Observability

## Structured Telemetry

The package emits structured commerce events for every meaningful state change. See \`packages/commerce-events/src/index.ts\` for the full event type list.

## Terminal States

Every operation terminates as one of:

- SUCCEEDED
- PARTIALLY_SUCCEEDED
- REQUIRES_REVIEW
- FAILED
- CANCELLED

There is no silent "no result" state. The \`OperationResult\` wrapper requires an explicit terminal state.

## Telemetry Signals

The following signals are derivable from emitted events:

- scan count (count of \`product.scanned\`)
- resolution success rate (success / total \`product.resolution.*\` events)
- ambiguous match rate (\`MULTIPLE_CANDIDATES\` + \`VARIANT_AMBIGUITY\` / total resolutions)
- product creation (\`product.created\`)
- duplicate detection (\`product.merged\` count)
- pricing calculation (\`pricing.calculated\`)
- comp freshness (computed from \`price.observed\` events)
- condition confidence (from \`condition.assessed\` payload)
- opportunity decision (\`opportunity.scored\` payload)
- inventory adjustment (\`inventory.adjusted\`)
- reservation failure (FAILED \`inventory.reserved\`)
- oversell prevention (count of \`OVERSELL_PREVENTED\` errors)
- listing readiness (\`listing.approved\` count)
- channel-sync request (\`listing.channel.updated\`)
- fee data stale (count of stale fee warnings)
- shipping data incomplete (count of \`missingDataWarnings\`)
- profit-confidence level (from \`profit.calculated\` payload)
- tenant-level outcomes (filter events by tenantId)

## Critical Rule

**Do not build a competing observability platform.** This package emits structured events; downstream platforms (Foundry, PrimeOS observability, AMOS) consume them via the \`CommerceEventSink\` interface.
`,

  'SDK_REFERENCE.md': `# SDK Reference

The SDK lives in \`packages/sdk/src/index.ts\`.

## Creating an SDK

\`\`\`typescript
import { createSdk } from '@primeopp/sdk';
const sdk = createSdk({ tenantId: 'my-tenant', organizationId: 'my-org' });
\`\`\`

## Available Methods

| Method | Description |
|---|---|
| \`validateBarcode(value, format?)\` | Validate a barcode value. |
| \`toBarcodePayload(value, format?)\` | Convert a value to a BarcodePayload. |
| \`resolveProductIdentity(input)\` | Resolve a product identity from input. |
| \`createProduct(product, actor?)\` | Create a product in the catalog. |
| \`getProduct(productId)\` | Get a product by ID. |
| \`listProducts(opts?)\` | List products in tenant scope. |
| \`inventoryOp(op)\` | Execute an inventory operation. |
| \`assessCondition(input)\` | Assess condition from input. |
| \`createPricingObservation(opts)\` | Create a pricing observation. |
| \`priceProduct(input)\` | Price a product. |
| \`assessFees(opts)\` | Assess marketplace fees. |
| \`estimateShipping(input)\` | Estimate shipping. |
| \`calculateProfit(input)\` | Calculate profit and ROI. |
| \`scoreOpportunity(input)\` | Score an opportunity. |
| \`createCanonicalListing(opts)\` | Create a canonical listing. |
| \`validateListingForPublication(listing)\` | Validate a listing. |
| \`listingPreview(listing)\` | Get a text preview. |
| \`disablePrimeOppMarketplace(listing, opts)\` | Opt out of PrimeOpp Marketplace. |
| \`acceptSelectedChannels(listing, opts)\` | Accept selected channels. |
| \`buildVariant(productId, attributes, opts?)\` | Build a variant. |
| \`detectVariantConflicts(a, b)\` | Detect variant conflicts. |
| \`initTenantConfig(opts)\` | Initialize tenant config. |

## Pre-Wired Components

The SDK comes pre-wired with:

- In-memory evidence store
- In-memory catalog storage with audit log
- In-memory inventory storage
- In-memory tenant config store
- Default PrimeOpp Marketplace fee schedule
- Test-only channel adapters (PrimeOpp + ebay-test-adapter)
- Test-only barcode, OCR, and image-match adapters
`,

  'CLI_REFERENCE.md': `# CLI Reference

The CLI lives in \`packages/cli/src/index.ts\`. Run via:

\`\`\`bash
node packages/cli/src/index.ts <command> [args]
\`\`\`

## Commands

| Command | Description |
|---|---|
| \`products resolve <file>\` | Resolve product identity from input JSON. |
| \`products inspect <id>\` | Inspect a product by ID. |
| \`barcode validate <code>\` | Validate a barcode. |
| \`barcode resolve <code>\` | Resolve a barcode to a product candidate. |
| \`condition assess <file>\` | Assess condition from JSON. |
| \`pricing calculate <file>\` | Calculate pricing from JSON. |
| \`profit calculate <file>\` | Calculate profit from JSON. |
| \`opportunity score <file>\` | Score opportunity from JSON. |
| \`inventory create <file>\` | Create inventory from JSON. |
| \`inventory adjust <file>\` | Adjust inventory from JSON. |
| \`inventory reserve <file>\` | Reserve inventory from JSON. |
| \`inventory reconcile\` | Reconcile inventory (placeholder; use SDK). |
| \`listing create <file>\` | Create a listing from JSON. |
| \`listing validate <file>\` | Validate a listing. |
| \`channels list\` | List registered channels. |
| \`adapters check\` | Run adapter conformance checks. |
| \`config validate\` | Validate tenant config. |
| \`doctor\` | Diagnose the install. |
| \`demo\` | Run the demo workflow. |
| \`verify\` | Run \`npm run verify\`. |

## Global Flags

- \`--json\` — Emit JSON output (where applicable).
- \`--tenant <id>\` — Tenant ID (default: \`cli-default\`).
- \`--org <id>\` — Organization ID.

## Exit Codes

- 0: success
- 1: validation / proof failure
- 2: usage error or missing input
`,

  'TESTING.md': `# Testing

## Test Framework

Tests use Node's built-in \`node:test\` runner. No external test framework is required.

## Running Tests

\`\`\`bash
# All tests
npm test

# Single package
node --test packages/barcode/tests/barcode.test.ts
\`\`\`

## Test Categories

Per the mission spec (Phase 27), the following test categories are covered:

- unit tests ✓
- schema tests ✓ (\`packages/schemas/tests/schemas.test.ts\`)
- serialization tests ✓ (via stableStringify + hashString)
- barcode validation tests ✓
- product resolution tests ✓
- conflict tests ✓
- variant tests ✓
- condition tests ✓
- catalog tests ✓
- inventory tests ✓
- concurrency tests ✓
- reservation tests ✓
- oversell tests ✓
- pricing tests ✓
- fee tests ✓
- shipping-estimate tests ✓
- profit tests ✓
- opportunity tests ✓
- listing tests ✓
- channel-conformance tests ✓
- tenant-isolation tests ✓
- enterprise-location tests ✓
- idempotency tests ✓
- replay tests ✓
- redaction tests ✓
- malicious-input tests ✓ (OCR sanitization)
- Windows path tests ✓ (paths use \`join\` and forward-slash)
- Linux path tests ✓
- CLI tests ✓ (via demo command)
- package-export tests ✓ (verify proof 6)

## Test Adapter Labeling

Every test adapter is clearly labeled TEST-ONLY in its manifest's \`termsRestrictions\` array. The adapter-testkit package verifies this labeling in its conformance tests.

## No External Dependencies

No tests require real credentials or paid APIs. All adapters are local and deterministic.
`,

  'OPERATIONS.md': `# Operations

## Installation

\`\`\`bash
npm install
\`\`\`

## Build

\`\`\`bash
npm run build
\`\`\`

This runs \`npm run typecheck\` (since the package uses Node's native TypeScript execution; there is no separate compile step).

## Verify

\`\`\`bash
npm run verify
\`\`\`

Runs the 24-point runtime proof. Exits non-zero if any proof fails.

## Test

\`\`\`bash
npm test
\`\`\`

## Lint

\`\`\`bash
npm run lint
\`\`\`

Checks for TODO / FIXME / placeholder / not-implemented / empty catch / \`|| true\` patterns.

## Demo

\`\`\`bash
npm run demo
\`\`\`

Runs a 6-step end-to-end demo: barcode validation, pricing, profit/ROI, opportunity, listing with PrimeOpp default ON, opt-out flow.

## Doctor

\`\`\`bash
npm run doctor
\`\`\`

Diagnoses the install: Node version, platform, registered adapters, registered channels.

## Package

\`\`\`bash
npm run package
\`\`\`

Creates \`primeopp-commerce-core.zip\` in \`/home/z/my-project/download/\`.

## Clean-Room Verify

\`\`\`bash
npm run cleanroom
\`\`\`

Extracts the ZIP into a fresh temp directory, runs \`npm install\` from the lockfile, and runs \`npm run verify\`.
`,

  'PRIMEOPP_INTEGRATION_GUIDE.md': `# PrimeOpp Integration Guide

This package is the shared commerce foundation for PrimeOpp. Future PrimeOpp application code will depend on this package.

## Integration Seams

### Application Layer

PrimeOpp applications should depend on:

- \`@primeopp/sdk\` — high-level facade
- \`@primeopp/cli\` — for command-line tools

### Engine Layer

For finer control, applications can depend on individual engine packages:

- \`@primeopp/product-identity\` — product resolution
- \`@primeopp/canonical-catalog\` — product storage
- \`@primeopp/inventory\` — inventory operations
- \`@primeopp/pricing\` — pricing
- \`@primeopp/profit-engine\` — profit calculations
- \`@primeopp/opportunity-engine\` — opportunity scoring
- \`@primeopp/listing-contracts\` — listing management
- \`@primeopp/channel-contracts\` — channel adapters

### Adapter Layer

Real marketplace adapters (eBay, Amazon, etc.) should be implemented as separate packages that depend on \`@primeopp/channel-contracts\` and \`@primeopp/adapter-sdk\`.

## Migration Path

1. Pin to a specific version of \`@primeopp/*\` packages.
2. Use \`createSdk()\` to bootstrap.
3. Replace test adapters with real adapters as they become available.
4. Swap in-memory storage adapters with persistent (SQLite, Postgres) adapters.
5. Subscribe to \`CommerceEventSink\` events for telemetry.

## Critical Rules

- Do NOT modify this package's source from within PrimeOpp application code. File issues for needed changes.
- Do NOT bypass tenant isolation guards. They exist for security.
- Do NOT hardcode fee schedules in application code. Use the fee-engine's versioned schedule registry.
`,

  'POD_MIGRATION_GUIDE.md': `# POD Migration Guide

This package supports Print-on-Demand (POD) products as a first-class \`ProductKind\`.

## POD Product Model

A POD product carries:

- \`kind: 'POD'\`
- \`fulfillmentMode: 'POD_FULFILLED'\`
- \`locations\` with a VIRTUAL location carrying \`podPartnerRef\`
- \`costBasis\` with production cost as \`purchasePrice\` (typically ESTIMATED)
- Inventory records with \`virtual: true\` and \`podPartnerRef\`

## Migration from Existing POD Codebase

When migrating from an existing POD system:

1. Map each POD product to a \`Product\` with \`kind: 'POD'\`.
2. Map each POD variant to a \`ProductVariant\` with axes (COLOR, SIZE, MATERIAL, etc.).
3. Map each POD partner to a \`ProductLocation\` with \`kind: 'VIRTUAL'\` and \`podPartnerRef\`.
4. Map production cost to \`ProductCostBasis.purchasePrice\` with status \`ESTIMATED\`.
5. Replace POD-specific listing logic with \`CanonicalListing\` + channel adapter.

## Inventory

POD inventory uses virtual records:

\`\`\`typescript
{
  virtual: true,
  podPartnerRef: 'printify',
  quantities: { available: Infinity, /* or a large number */, ... },
}
\`\`\`

## Pricing

POD pricing uses the same \`PricingEngine\` as physical products. The strategy is typically \`MAX_MARGIN\` or \`CUSTOM\`.

## Critical Rule

Never claim a POD item is "in stock" in a physical location. POD inventory is always virtual.
`,

  'FOUNDRY_INTEGRATION_GUIDE.md': `# Foundry Integration Guide

Foundry is the canonical execution runtime in the VERIDIAN ecosystem. This package exposes Foundry integration seams but does NOT implement Foundry.

## Execution Seams

Foundry can execute operations via:

- \`InventoryEngine.execute(op)\` — inventory mutations
- \`CanonicalCatalog.create/update/merge/split/archive\` — catalog mutations
- \`MarketplaceChannelAdapter.publishListing\` — channel publication
- All operations accept a \`TenantScoped\` scope that Foundry can populate from the calling context

## Event Consumption

Foundry can subscribe to commerce events via \`CommerceEventSink.subscribe(handler)\`. Every event carries:

- \`eventId\` (UUID)
- \`schemaVersion\`
- \`tenantId\`, \`organizationId\`
- \`correlationId\`
- \`timestamp\`
- \`source\` and \`subject\`
- \`type\` (one of 25 commerce event types)
- \`payload\`
- \`evidenceRefs\`
- \`sensitivity\`

## Evidence Recording

Foundry can verify material execution results via:

- \`EvidenceStore.verify(id)\` — content hash verification
- \`buildEvidenceRecord(opts)\` — construct evidence records
- \`contentHash(value)\` — compute deterministic content hashes

## Critical Rule

**Do not implement Foundry inside this package.** Foundry is the consumer; this package is the contract provider.

## Mermaid: Future Foundry Integration

\`\`\`mermaid
flowchart LR
  Foundry[Foundry Runtime] -->|executes| Engine[Commerce Core Engine]
  Engine -->|emits| Events[Commerce Events]
  Foundry -->|subscribes| Events
  Engine -->|records| Evidence[Evidence]
  Foundry -->|verifies| Evidence
\`\`\`
`,

  'EVE_VERIFICATION_GUIDE.md': `# E.V.E. Verification Guide

E.V.E. (independent verification entity) can verify material execution results produced by this package.

## Verification Surface

E.V.E. can verify:

1. **Evidence integrity**: \`EvidenceStore.verify(id)\` checks that stored content hash matches the recorded hash.
2. **Operation terminal states**: Every \`OperationResult\` carries an explicit \`state\` — E.V.E. can confirm operations terminated (no silent failures).
3. **Idempotency replay**: \`InventoryOperationResult.idempotentReplay\` indicates whether an operation was a replay.
4. **Audit trail**: \`CatalogAuditLog\` records every mutation with before/after snapshots.
5. **Event log**: \`CommerceEventSink.events\` (in-memory) or external event sink records every state change.
6. **Tenant isolation**: Cross-tenant access guards throw — E.V.E. can attempt cross-tenant access to verify denial.
7. **Verify command output**: \`npm run verify\` produces \`evidence/RUNTIME_VERIFICATION.md\` and four JSON evidence files.

## Evidence Files

\`\`\`text
evidence/
  RUNTIME_VERIFICATION.md
  TEST_RESULTS.json
  WORKFLOW_RESULTS.json
  SECURITY_RESULTS.json
  PACKAGE_RESULTS.json
\`\`\`

## Independent Verification

E.V.E. should:

1. Run \`npm run verify\` independently (not trust this package's self-report).
2. Inspect \`evidence/TEST_RESULTS.json\` for test counts.
3. Inspect \`evidence/WORKFLOW_RESULTS.json\` for workflow A-L outcomes.
4. Inspect \`evidence/SECURITY_RESULTS.json\` for adapter conformance.
5. Inspect \`evidence/PACKAGE_RESULTS.json\` for package-export completeness.

## Critical Rule

**Runtime evidence outweighs documentation claims.** If E.V.E.'s independent verification produces different results than this package's self-report, E.V.E. wins.
`,

  'AMOS_INTEGRATION_GUIDE.md': `# AMOS Integration Guide

AMOS is a VERIDIAN sibling product. This package exposes integration seams for AMOS but does NOT implement AMOS.

## Operating System Seams

AMOS can integrate via:

- **Commerce events**: subscribe to \`CommerceEventSink\` for OS-level telemetry
- **Filesystem**: all file paths use \`join()\` with forward slashes for cross-platform compatibility
- **Process**: \`npm run verify\` exits with standard exit codes (0 success, 1 failure)
- **Environment**: no environment variables required for verification

## Path Portability

All paths in this package use \`node:path\`'s \`join()\` and forward slashes. Tests run on Linux and Windows (forward slashes work on both via Node's path module).

## Mermaid: AMOS Integration

\`\`\`mermaid
flowchart TD
  AMOS[AMOS Runtime] -->|spawns| CLI[primeopp CLI]
  CLI -->|exits with code| AMOS
  CLI -->|emits events| Sink[CommerceEventSink]
  AMOS -->|subscribes| Sink
\`\`\`
`,

  'MIGRATION.md': `# Migration Guide

## From 0.x to 1.0.0

This is the initial 1.0.0 release. There is no prior version to migrate from.

## Future Migrations

Future major versions will provide migration guides in this file. The package follows SemVer:

- **Patch** (1.0.x): bug fixes, no breaking changes
- **Minor** (1.x.0): new features, no breaking changes
- **Major** (x.0.0): breaking changes; migration guide required

## Breaking Change Policy

The following are considered breaking changes:

- Removing or renaming a public type
- Removing or renaming a public function
- Changing a function signature (positional args)
- Removing a CLI command
- Changing CLI exit codes
- Removing a barcode format
- Removing a canonical condition
- Removing a terminal state
- Changing the default value of \`alsoListOnPrimeOppMarketplace\`

The following are NOT breaking changes:

- Adding a new optional field to an existing type
- Adding a new function
- Adding a new CLI command
- Adding a new barcode format
- Adding a new canonical condition
- Adding a new terminal state
- Adding a new commerce event type
- Adding a new adapter capability
`,

  'CHANGELOG.md': `# Changelog

See \`/CHANGELOG.md\` in the repository root.
`,
};

for (const [name, content] of Object.entries(docs)) {
  writeFileSync(join(docsDir, name), content);
}

console.log(`Wrote ${Object.keys(docs).length} doc files to ${docsDir}`);
