# PROVIDERS.md

This document describes the provider system in detail.

---

## Provider adapter interface

```ts
interface ProductEnrichmentProvider {
  readonly id: string;
  readonly capabilities: EnrichmentProviderCapability[];

  canHandle(input: ProductEnrichmentInput): boolean | Promise<boolean>;

  enrich(
    input: ProductEnrichmentInput,
    context: EnrichmentContext
  ): Promise<ProviderEnrichmentResult>;
}
```

### `EnrichmentContext`

Passed by the orchestrator to every provider call:

```ts
interface EnrichmentContext {
  timeoutMs: number;
  includeImages: boolean;
  hints?: Record<string, unknown>;
  log?: (level, message, meta?) => void;
}
```

### `ProviderEnrichmentResult`

```ts
interface ProviderEnrichmentResult {
  providerId: string;
  found: boolean;
  confidence: number;                    // 0.0 - 1.0
  candidates: FieldCandidate[];
  images?: ImageCandidate[];
  externalReference?: string;            // e.g. provider's product ID
  rawReferenceId?: string;               // bounded to 256 chars
  error?: { code: string; message: string; retryable: boolean };
  retrievedAt: string;                   // ISO-8601
}
```

### `FieldCandidate`

```ts
interface FieldCandidate<T = unknown> {
  field: string;                         // dotted path, e.g. "identity.brand"
  value: T;
  normalizedValue?: unknown;
  providerId: string;
  sourceConfidence: number;              // 0.0 - 1.0
  providerPriority: number;              // lower = higher priority
  evidence?: Record<string, unknown>;    // optional bag (e.g. { exactMatch: true })
}
```

---

## Capability model

Capabilities advertise what a provider can do. The orchestrator uses them for transparency, but actual eligibility is determined by `canHandle()`.

```ts
type EnrichmentProviderCapability =
  | "BARCODE_LOOKUP"          // lookup by UPC/EAN/GTIN
  | "ISBN_LOOKUP"             // lookup by ISBN
  | "TEXT_SEARCH"             // lookup by title / description
  | "BRAND_MODEL_SEARCH"      // lookup by brand + model
  | "CATEGORY_RESOLUTION"     // resolves category from text
  | "ATTRIBUTE_ENRICHMENT"    // contributes attributes (color, size, weight)
  | "IMAGE_DISCOVERY";        // contributes image URLs
```

---

## Built-in providers

### 1. `FixtureProductProvider`

**Status:** Verified, deterministic, local.

Backed by JSON fixture files in `fixtures/`. Used by tests and offline development.

```ts
const provider = new FixtureProductProvider({
  id: "fixture",
  priority: 10,
  records: loadAllFixtures(),
});
```

Fixture record format:

```ts
interface FixtureRecord {
  id: string;
  matchBy: {
    gtin?: string;
    upc?: string;
    ean?: string;
    isbn?: string;
    sku?: string;
    brand?: string;
    model?: string;
    title?: string;
  };
  confidence: number;
  exactMatch?: boolean;
  fields: Record<string, unknown>;
  images?: ImageCandidate[];
  externalReference?: string;
  rawReferenceId?: string;
}
```

Match order:
1. Exact identifier match (gtin/upc/ean/isbn/sku).
2. Brand + model match (case-insensitive).
3. Loose title-contains match.

### 2. `ManualInputProvider`

**Status:** Verified.

Converts manual user input into provider-style evidence. Each populated manual field becomes a candidate with `providerId: "manual"`, `providerPriority: 5`, `sourceConfidence: 0.6`.

Field mapping:

| Manual field | Field path |
|---|---|
| `title` | `identity.canonicalTitle` |
| `brand` | `identity.brand` |
| `model` | `identity.model` |
| `category` | `classification.category` |
| `description` | `description` |
| `mpn` | `identifiers.mpn` |
| `color` | `attributes.color` |
| `size` | `attributes.size` |

By default, manual evidence competes with other providers on equal footing. To promote manual input to win ties, set `EnrichmentOptions.manualTrustLevel = "authoritative"`.

### 3. `GenericHttpProductProvider`

**Status:** Integration-dependent. Disabled by default.

A reusable HTTP adapter template. Hosts must supply:

- `requestBuilder` — maps `ProductEnrichmentInput` → HTTP request (URL, method, headers, body).
- `responseMapper` — maps HTTP response (status + body) → `HttpResponseMapperResult` (candidates, images, confidence).
- `enabled: true` — opt-in.
- Optional: `apiKey`, `timeoutMs`, `maxBodyBytes`, `bodyValidator`, custom `fetchImpl`.

Features:
- Enforces per-call timeout via `AbortController`.
- Rejects oversized response bodies (`maxBodyBytes`).
- Never embeds API keys in URLs.
- Returns structured `error` entries instead of throwing on provider-side failures.
- Supports custom `fetchImpl` for testing.

See `tests/test-http-provider.ts` for a complete usage example.

### 4. `IsbnProductProvider`

**Status:** Adapter contract. Requires host-supplied `IsbnMetadataSource`.

```ts
interface IsbnMetadataSource {
  lookup(isbn: string): Promise<IsbnMetadataRecord | null>;
}

interface IsbnMetadataRecord {
  isbn: string;
  title?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  categories?: string[];
  description?: string;
  pageCount?: number;
  coverImage?: string;
  confidence?: number;
}

const provider = new IsbnProductProvider({
  source: new OpenLibraryIsbnSource(), // host-supplied
  priority: 15,
});
```

The provider converts the `IsbnMetadataRecord` into structured candidates (title, publisher, description, category, authors, pageCount, ISBN identifier, cover image).

---

## Provider priority

Priority is a positive integer. Lower number = higher priority. The orchestrator consults providers in priority order. The resolution engine uses priority as a tiebreaker when agreement and source confidence are equal.

Suggested priority convention:

| Priority | Use |
|---|---|
| 1–9 | Manual user input (when authoritative). |
| 10–19 | Highly-trusted barcode / ISBN sources. |
| 20–39 | Reputable text-search providers. |
| 40+ | Lower-confidence fallbacks. |

---

## Reliability weight

The current implementation uses **provider priority** as the reliability signal. There is no separate "reliability weight" scalar; instead, source confidence on each candidate and agreement across multiple providers together produce the final field confidence.

Hosts that want to model provider reliability more explicitly can wrap providers and override `sourceConfidence` on emitted candidates based on historical reliability metrics.

---

## Timeout handling

- The orchestrator passes `EnrichmentContext.timeoutMs` (derived from `EnrichmentOptions.timeoutMs`) to each provider.
- `GenericHttpProductProvider` enforces this via `AbortController`.
- `FixtureProductProvider` and `ManualInputProvider` are synchronous-ish and always complete well within the timeout.
- If a provider exceeds the timeout, the orchestrator logs a warning but does NOT discard the result (some providers may still return a usable response after the deadline).
- If a provider throws `ProviderTimeoutError`, the orchestrator records it as a structured error result.

---

## Adding a new provider

1. **Implement `ProductEnrichmentProvider`** in a new file under `src/providers/`.
2. **Register it** with the service at construction time, or via `service.registerProvider()`:
   ```ts
   service.registerProvider(new MyProvider(), priority: 25);
   ```
3. **Write tests** under `tests/test-my-provider.ts` covering:
   - `canHandle()` returns true/false correctly.
   - `enrich()` returns well-formed `ProviderEnrichmentResult`.
   - Error paths (timeouts, malformed responses, source failures).
4. **Document** the provider in this file and in `module.manifest.json`.

### Provider checklist

- [ ] `id` is unique across all registered providers.
- [ ] `capabilities` accurately reflects what the provider can do.
- [ ] `canHandle()` is fast (no I/O) and deterministic.
- [ ] `enrich()` never throws — wrap all failures in `error` field of the result.
- [ ] `enrich()` respects `context.timeoutMs`.
- [ ] `enrich()` honors `context.includeImages`.
- [ ] Candidates use dotted field paths (`identity.brand`, `attributes.color`, etc.).
- [ ] `sourceConfidence` is honest (0.0–1.0).
- [ ] No secrets are logged or embedded in URLs.
- [ ] No raw provider payloads are stored on the result (use `rawReferenceId` instead).

---

## Secret handling

- The core module NEVER reads from `process.env`. Secrets are passed via constructor config.
- `GenericHttpProductProvider` accepts `apiKey` and forwards it to the host-supplied `requestBuilder`. The builder is responsible for placing it in a header (e.g. `Authorization: Bearer ...`) — never in the URL.
- The orchestrator and builder do NOT log `apiKey` values.
- Errors surfaced to callers include only the provider ID and a generic error code; never the secret.

---

## Rate-limit considerations

- The orchestrator does NOT implement rate limiting. Hosts that need it should:
  - Wrap their provider's `enrich()` method with a rate-limiter (e.g. `bottleneck`, `p-limit`).
  - OR implement a custom fetch in `GenericHttpProductProvider` that enforces rate limits.
- For parallel execution against rate-limited providers, set `EnrichmentOptions.executionMode = "SEQUENTIAL"` to avoid concurrent calls.

---

## Mock vs live provider behavior

| Provider | Mock / Live | Notes |
|---|---|---|
| `FixtureProductProvider` | **Mock** (local fixtures) | Deterministic. Use for tests and offline dev. |
| `ManualInputProvider` | **Neither** — converts user input | Always produces evidence from manual fields. |
| `GenericHttpProductProvider` | **Live when configured** | Disabled by default. Host must supply `requestBuilder`, `responseMapper`, `apiKey`, `enabled: true`. |
| `IsbnProductProvider` | **Adapter contract** | Behavior depends on the host-supplied `IsbnMetadataSource`. A fixture-backed source behaves like a mock; a real HTTP-backed source behaves like a live provider. |

### How to tell if a provider is mock or live

1. Check `module.manifest.json` → `verifiedCapabilities` vs `mockedCapabilities` vs `integrationDependencies`.
2. Check `VERIFICATION.md` → "What was genuinely verified" vs "What used fixtures/mocks" vs "What remains integration-dependent".
3. Inspect the provider's constructor config. If `enabled: false` (HTTP) or no `source` (ISBN), it is not live.

---

## Provider isolation

The orchestrator guarantees:

- One provider's failure does NOT fail the entire enrichment run.
- One provider's timeout does NOT block other providers (in `PARALLEL` mode).
- Provider errors are captured as structured `ProviderEnrichmentResult.error` entries, visible on the final profile's `sources` array (omitted from `sources` when `found: false`).

When all eligible providers fail, the profile status is `FAILED`. When all eligible providers return `not-found`, the status is `NOT_FOUND`.

---

## Field path conventions

Providers should use these dotted paths in their candidates:

| Path | Meaning |
|---|---|
| `identity.canonicalTitle` | Resolved canonical title. |
| `identity.brand` | Resolved brand. |
| `identity.manufacturer` | Resolved manufacturer. |
| `identity.model` | Resolved model. |
| `identifiers.upc` / `ean` / `gtin` / `isbn` / `sku` / `mpn` | Identifier buckets. |
| `classification.category` | Resolved category. |
| `classification.subcategory` | Resolved subcategory. |
| `classification.taxonomyPath` | Ordered taxonomy path (array). |
| `description` | Long-form description. |
| `bullets` | Bullet list (array of strings). |
| `attributes.<name>` | Arbitrary attribute (color, size, weight, dimensions, etc.). |

Unknown field paths are tolerated but will not appear on the final profile unless the profile builder is extended to recognize them.
