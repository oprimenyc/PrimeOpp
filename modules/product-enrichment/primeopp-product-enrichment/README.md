# primeopp-product-enrichment

Provider-neutral product enrichment module for the PrimeOpp commerce-intelligence pipeline.

Accepts a normalized product-intake record and produces a higher-confidence, evidence-backed, conflict-aware enriched product profile.

This is the second module in the pipeline:

```
INTAKE  →  ENRICH  →  RESOLVE  →  SCORE CONFIDENCE  →  PREPARE FOR COMPS
              ▲
              └── this module
```

---

## Module purpose

The enrichment module converts sparse product input — such as a UPC/EAN/GTIN/ISBN, an SKU, a brand+model pair, a partial title, or manual entry — into a normalized profile containing the best available resolved information.

It is:

- **Provider-neutral.** No provider is hardcoded. Fixture, manual, HTTP, and ISBN adapters all share a common `ProductEnrichmentProvider` interface.
- **Framework-light.** Pure TypeScript on Node.js. No React, Next.js, Express, NestJS, or database coupling.
- **Evidence-traceable.** Every field on the final profile carries per-field confidence and provider source attribution.
- **Conflict-aware.** Disagreements between providers are surfaced as structured `EnrichmentConflict` records, not silently erased.
- **Deterministic.** Identical inputs (modulo timestamps and ID generation) produce identical outputs. Tests rely on this.

---

## Input contract

Defined in `src/contracts/input.ts`. Recreated minimum surface compatible with the prior clean-room module `primeopp-product-intake`:

```ts
type ProductIdentifierType =
  | "UPC_A" | "UPC_E" | "EAN_8" | "EAN_13"
  | "GTIN_8" | "GTIN_12" | "GTIN_13" | "GTIN_14"
  | "ISBN_10" | "ISBN_13" | "SKU" | "UNKNOWN";

interface ProductIdentifier {
  rawValue: string;
  normalizedValue: string;
  identifierType: ProductIdentifierType;
  isValidFormat: boolean;
  checksumValid?: boolean;
}

interface ProductEnrichmentInput {
  intakeId?: string;
  identifier?: ProductIdentifier;
  manualProduct?: {
    title?: string;
    brand?: string;
    model?: string;
    category?: string;
    description?: string;
    mpn?: string;
    color?: string;
    size?: string;
  };
  sourceContext?: Record<string, unknown>;
}
```

At least one of `identifier` (with a non-empty `normalizedValue`) or `manualProduct` (with at least one populated field) is required. Inputs that fail this check raise `InvalidInputError`.

---

## Output contract

Defined in `src/contracts/output.ts`. Top-level type is `EnrichedProductProfile`:

```ts
interface EnrichedProductProfile {
  enrichmentId: string;
  intakeId?: string;
  identifiers: { upc?: string[]; ean?: string[]; gtin?: string[]; isbn?: string[]; sku?: string[]; mpn?: string[]; };
  identity: { canonicalTitle?: string; brand?: string; manufacturer?: string; model?: string; };
  classification: { category?: string; subcategory?: string; taxonomyPath?: string[]; };
  attributes: Record<string, NormalizedAttribute>;
  description?: string;
  bullets?: string[];
  media: { images: ProductImage[]; };
  sources: EnrichmentSourceRecord[];
  conflicts: EnrichmentConflict[];
  confidence: { overall: number; fieldScores: Record<string, number>; };
  completeness: { score: number; missingFields: string[]; };
  status: "ENRICHED" | "PARTIAL" | "AMBIGUOUS" | "NOT_FOUND" | "FAILED";
  createdAt: string;
}
```

Status values:

| Status | Meaning |
|---|---|
| `ENRICHED` | All configured important-fields are present and no high-severity identity conflict. |
| `PARTIAL` | Some important fields are missing, but the profile is usable. |
| `AMBIGUOUS` | Two or more providers returned conflicting identity fields (brand, model, manufacturer, title, or identifier). Manual review required. |
| `NOT_FOUND` | No provider returned any data. |
| `FAILED` | All providers failed (timeouts, exceptions, malformed responses). |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  ProductEnrichmentService                     │
│  (validates input → cache lookup → orchestrator → builder)   │
└───────────────┬──────────────────────────────┬───────────────┘
                │                              │
                ▼                              ▼
┌──────────────────────────────┐   ┌────────────────────────────┐
│   ProviderOrchestrator       │   │   InMemoryEnrichmentCache  │
│  (sequential / parallel,     │   │   (or host-supplied cache) │
│   timeout, short-circuit)    │   └────────────────────────────┘
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│  Providers (pluggable):                                      │
│    FixtureProductProvider   ManualInputProvider              │
│    GenericHttpProductProvider (template, disabled by default)│
│    IsbnProductProvider (with IsbnMetadataSource adapter)     │
└──────────┬───────────────────────────────────────────────────┘
           │ returns ProviderEnrichmentResult[]
           ▼
┌──────────────────────────────────────────────────────────────┐
│  ProfileBuilder                                              │
│    1. Normalize every candidate.                             │
│    2. Resolve each field via resolution engine.              │
│    3. Detect conflicts.                                      │
│    4. Compute per-field confidence.                          │
│    5. Compute overall confidence.                            │
│    6. Compute completeness.                                  │
│    7. Determine status.                                      │
│    8. Assemble EnrichedProductProfile.                       │
└──────────────────────────────────────────────────────────────┘
```

---

## Provider system

### Provider interface

```ts
interface ProductEnrichmentProvider {
  readonly id: string;
  readonly capabilities: EnrichmentProviderCapability[];
  canHandle(input): boolean | Promise<boolean>;
  enrich(input, context): Promise<ProviderEnrichmentResult>;
}
```

### Capabilities

```ts
type EnrichmentProviderCapability =
  | "BARCODE_LOOKUP"
  | "ISBN_LOOKUP"
  | "TEXT_SEARCH"
  | "BRAND_MODEL_SEARCH"
  | "CATEGORY_RESOLUTION"
  | "ATTRIBUTE_ENRICHMENT"
  | "IMAGE_DISCOVERY";
```

### Built-in providers

| Provider | Capability | Status | Purpose |
|---|---|---|---|
| `FixtureProductProvider` | All | **Verified** (fixture-backed, deterministic) | Local provider for tests and offline dev. Loads JSON fixtures from `fixtures/`. |
| `ManualInputProvider` | TEXT_SEARCH, BRAND_MODEL_SEARCH, ATTRIBUTE_ENRICHMENT | **Verified** | Converts manual user input into provider-style evidence. |
| `GenericHttpProductProvider` | Configurable | **Integration-dependent** (disabled by default) | Reusable HTTP adapter template for real product data sources. |
| `IsbnProductProvider` | ISBN_LOOKUP, ATTRIBUTE_ENRICHMENT, IMAGE_DISCOVERY | **Adapter contract** (requires host-supplied `IsbnMetadataSource`) | Book metadata adapter boundary. |

See [PROVIDERS.md](./PROVIDERS.md) for full provider documentation including how to add a new provider.

### Provider priority

Each provider is registered with a numeric priority (lower = higher priority). The orchestrator consults providers in priority order. In the resolution engine, when two providers tie on agreement, the lower priority number wins.

Suggested priority convention:

| Priority range | Use |
|---|---|
| 1–9 | Manual user input (when authoritative). |
| 10–19 | Highly-trusted barcode / ISBN sources (exact-match). |
| 20–39 | Reputable text-search providers. |
| 40+ | Lower-confidence fallbacks. |

---

## Resolution strategy

The resolution engine (`src/resolution/engine.ts`) inspects all candidates for each field and picks a winner using these deterministic rules, in order:

1. **Manual-authoritative candidates** — when `EnrichmentOptions.manualTrustLevel === "authoritative"`, manual candidates win ties.
2. **Exact-match evidence** — candidates whose `evidence.exactMatch === true` (e.g. a barcode match) outrank text-search candidates.
3. **Majority agreement** — the value supported by the most providers wins. Ties broken by candidate count.
4. **Provider priority** — within the majority group, the lowest priority number wins.
5. **Source confidence** — within the same priority, the higher source confidence wins.
6. **First-seen** — stable tiebreaker.

Original raw values are preserved on each candidate's `value` field; the `normalizedValue` field holds the post-normalization form used for comparison.

Conflicts are recorded whenever two or more normalized values disagree for the same field. Severity:

- **HIGH** — identity fields (`identity.brand`, `identity.model`, `identity.manufacturer`, `identity.canonicalTitle`) and identifier fields. Triggers `AMBIGUOUS` status when ≥1 such conflict exists.
- **MEDIUM** — measurement fields (`attributes.dimensions`, `attributes.weight`), category, MPN.
- **LOW** — soft fields (`attributes.color`, `description`, `bullets`).

---

## Confidence scoring

The confidence engine (`src/confidence/engine.ts`) computes an **operational confidence score** in the range `0.0`–`1.0`.

> **This is NOT a scientifically calibrated probability.** It is a deterministic, weighted blend of signals that downstream systems can use to gate actions (e.g. require manual review below 0.6).

### Formula

```
base = w.identifierQuality * identifierQuality
     + w.fieldConfidence * avgFieldConfidence
     + identifierAgreementBonus

penalized = max(0, base - conflictPenalty)

overall = clamp01(penalized * (completenessMultiplierBase + completenessMultiplierRange * completeness.score))
```

### Signals

1. **Identifier quality** — 1.0 for valid-checksum barcode/ISBN, 0.6 for invalid-checksum, 0.3 for SKU, 0.1 for unknown.
2. **Identifier agreement bonus** — +0.10 when 2+ providers independently returned the same barcode/ISBN.
3. **Average per-field confidence** — across all resolved fields.
4. **Conflict penalty** — −0.10 per HIGH conflict, −0.05 per MEDIUM, −0.01 per LOW (capped at −0.05 total for LOW).
5. **Completeness multiplier** — `0.5 + 0.5 * completeness.score`. A sparse profile is penalized.

### Defaults

Defined in `DEFAULT_CONFIDENCE_WEIGHTS`:

```ts
{
  identifierQuality: 0.30,
  identifierAgreementBonus: 0.10,
  fieldConfidence: 0.40,
  conflictPenaltyHigh: 0.10,
  conflictPenaltyMedium: 0.05,
  conflictPenaltyLowCap: 0.05,
  completenessMultiplierBase: 0.5,
  completenessMultiplierRange: 0.5,
}
```

Hosts can override any weight by passing `weights` into `computeOverallConfidence()` (advanced; the public service uses defaults).

---

## Completeness scoring

The completeness engine (`src/confidence/completeness.ts`) computes what fraction of the configured important fields are present.

Default important fields:

```ts
[
  "identity.canonicalTitle",
  "identity.brand",
  "identity.modelOrMpn",     // model OR identifiers.mpn
  "classification.category",
  "description",
  "identifiers.any",          // at least one identifier
  "media.images",             // at least one image
]
```

Hosts can override per-call via `EnrichmentOptions.importantFields`, or per-category by wrapping the service.

---

## Caching

The cache interface (`src/cache/index.ts`):

```ts
interface ProductEnrichmentCache {
  get(key: string): Promise<EnrichedProductProfile | null>;
  set(key: string, value: EnrichedProductProfile, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}
```

Built-in implementation: `InMemoryEnrichmentCache` (LRU-like with TTL, default capacity 1000, default TTL 300s).

Cache keys are deterministic: derived from the input identifier (type + normalizedValue) and the manual-product fields (sorted). Two equivalent inputs always produce the same cache key.

Hosts that need Redis or database-backed caching should implement `ProductEnrichmentCache` and pass it to the service constructor.

---

## Build

```bash
npm install
npm run build
```

Build output: `dist/` (CommonJS + TypeScript declarations).

## Test

```bash
npm test
```

The test suite uses a minimal in-tree harness (no Jest/Vitest dependency) and runs ~80+ test cases covering identifier validation, normalization, resolution, confidence, completeness, providers, orchestration, conflicts, caching, security, and end-to-end enrichment.

## Examples

```bash
npm run example:barcode
npm run example:isbn
npm run example:brand-model
npm run example:manual
npm run example:multi-provider
npm run example:conflict
npm run example:cache
npm run example:downstream
# or all at once:
npm run examples:all
```

## Usage

```ts
import {
  ProductEnrichmentService,
  FixtureProductProvider,
  ManualInputProvider,
  InMemoryEnrichmentCache,
  normalizeIdentifier,
} from "primeopp-product-enrichment";

const service = new ProductEnrichmentService({
  cache: new InMemoryEnrichmentCache({ capacity: 1000, defaultTtlSeconds: 300 }),
  maxProviders: 5,
  providers: [
    { provider: new FixtureProductProvider({ id: "fixture", priority: 10, records: [] }), priority: 10 },
    { provider: new ManualInputProvider(), priority: 5 },
  ],
});

const profile = await service.enrich({
  intakeId: "intake-1",
  identifier: normalizeIdentifier("036000291452"),
});

console.log(profile.status, profile.confidence.overall, profile.identity.brand);
```

---

## Limitations

- The module ships NO live product-data integrations. The `GenericHttpProductProvider` is a template; hosts must supply `requestBuilder` and `responseMapper` plus credentials via configuration. See [PROVIDERS.md](./PROVIDERS.md).
- The `IsbnProductProvider` requires a host-supplied `IsbnMetadataSource`. No live book API is wired.
- The module does NOT download image bytes — it only collects image URLs. Hosts are responsible for verifying usage rights and licenses.
- The confidence score is an **operational** heuristic, not a calibrated probability.
- Completeness scoring uses a static field list by default. Hosts must supply a category-aware policy if they need per-category important fields.
- The cache is in-memory by default. Hosts needing distributed caching must supply their own `ProductEnrichmentCache` implementation.
- The module does NOT implement marketplace comps, profitability, listing generation, shipping, or cross-listing logic. See `examples/downstream-handoff.ts` for the boundary contract.
