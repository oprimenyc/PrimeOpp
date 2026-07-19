# INTEGRATION.md

This document explains how another coding agent with real PrimeOpp repository access can later integrate this clean-room module.

> **Important:** This module was built without access to the real PrimeOpp codebase. The contracts below are the **minimum stable surface** the integration host must satisfy. Anywhere the real PrimeOpp architecture differs, the host must write a thin adapter — never modify this module's internals.

---

## 1. Public exports

The full public API is exported from `src/index.ts`. Key exports:

```ts
import {
  // Service
  ProductEnrichmentService,
  // Providers
  FixtureProductProvider,
  ManualInputProvider,
  GenericHttpProductProvider,
  IsbnProductProvider,
  // Cache
  InMemoryEnrichmentCache,
  computeCacheKey,
  // Domain utilities
  normalizeIdentifier,
  detectIdentifierType,
  isValidGs1Identifier,
  isValidIsbn10,
  isValidIsbn13,
  // Confidence / completeness
  computeOverallConfidence,
  computeCompleteness,
  DEFAULT_IMPORTANT_FIELDS,
  // Errors
  ProductEnrichmentError,
  InvalidInputError,
  NoProviderError,
  // Types (type-only)
  // ...ProductEnrichmentInput, EnrichedProductProfile, EnrichmentOptions, etc.
} from "primeopp-product-enrichment";
```

See `src/index.ts` for the complete list.

---

## 2. Shared contract mapping (intake handoff)

The prior module `primeopp-product-intake` is responsible for producing `ProductEnrichmentInput`. `src/adapters/intake-handoff.ts` implements this mapping (`toEnrichmentInput()` / `isEnrichmentEligible()`) against a structural `IntakeHandoffRecord` type that mirrors `ProductIntakeRecord`, so this package still does not depend on the intake module's source. If the real intake module's shape diverges from `ProductIntakeRecord`, adapt at the call site before invoking `toEnrichmentInput()`. The mapping table below documents the field-level correspondence this adapter implements.

| Enrichment input field | Intake source | Notes |
|---|---|---|
| `intakeId` | intake record ID | Pass-through for end-to-end tracing. |
| `identifier.rawValue` | intake raw identifier string | As captured from user / scanner. |
| `identifier.normalizedValue` | intake normalized identifier | Strip non-alphanumeric, uppercase X. |
| `identifier.identifierType` | intake classified type | Use `normalizeIdentifier()` to (re)detect if missing. |
| `identifier.isValidFormat` | intake format check | Re-validated defensively. |
| `identifier.checksumValid` | intake checksum check | Re-validated defensively. |
| `manualProduct.*` | intake manual-entry form fields | Each populated field becomes a candidate. |
| `sourceContext` | intake context bag | Forwarded to providers as `EnrichmentContext.hints`. |

If the real intake module emits a different shape, write a host-side adapter:

```ts
function toEnrichmentInput(intakeRecord: RealIntakeRecord): ProductEnrichmentInput {
  return {
    intakeId: intakeRecord.id,
    identifier: intakeRecord.barcode
      ? normalizeIdentifier(intakeRecord.barcode)
      : undefined,
    manualProduct: intakeRecord.manualEntry
      ? {
          title: intakeRecord.manualEntry.productName,
          brand: intakeRecord.manualEntry.brandName,
          // ...etc
        }
      : undefined,
    sourceContext: { marketplace: intakeRecord.sourceMarketplace },
  };
}
```

---

## 3. Provider registration

```ts
const service = new ProductEnrichmentService({
  cache: hostCache,                          // optional, defaults to in-memory
  maxProviders: 5,                           // optional, default 5
  providers: [
    { provider: new ManualInputProvider(), priority: 5 },
    { provider: new FixtureProductProvider({ id: "fixture", records: [] }), priority: 10 },
    // Register a real HTTP provider (see PROVIDERS.md):
    {
      provider: new GenericHttpProductProvider({
        id: "upcitemdb",
        baseUrl: "https://api.upcitemdb.com",
        apiKey: process.env.UPCITEMDB_KEY,    // loaded by host, not by core module
        enabled: true,
        requestBuilder: (input, baseUrl, apiKey) => {
          if (!input.identifier?.normalizedValue) return null;
          return {
            url: `${baseUrl}/prod/trial/lookup?gtin=${input.identifier.normalizedValue}`,
            headers: { "user_key": apiKey ?? "" },
          };
        },
        responseMapper: (status, body) => {
          if (status !== 200 || !body || typeof body !== "object") {
            return { found: false, confidence: 0, candidates: [] };
          }
          const b = body as { title?: string; brand?: string; category?: string };
          return {
            found: true,
            confidence: 0.85,
            candidates: [
              { field: "identity.canonicalTitle", value: b.title ?? "", providerId: "upcitemdb", sourceConfidence: 0.85, providerPriority: 15 },
              { field: "identity.brand", value: b.brand ?? "", providerId: "upcitemdb", sourceConfidence: 0.85, providerPriority: 15 },
              { field: "classification.category", value: b.category ?? "", providerId: "upcitemdb", sourceConfidence: 0.85, providerPriority: 15 },
            ],
          };
        },
      }),
      priority: 15,
    },
  ],
});
```

### Adding a custom provider

Implement `ProductEnrichmentProvider`:

```ts
class MyPimProvider implements ProductEnrichmentProvider {
  readonly id = "pim";
  readonly capabilities = ["BARCODE_LOOKUP", "ATTRIBUTE_ENRICHMENT"];

  async canHandle(input: ProductEnrichmentInput): Promise<boolean> {
    return Boolean(input.identifier?.isValidFormat);
  }

  async enrich(input, ctx): Promise<ProviderEnrichmentResult> {
    // ... call your PIM, map response, return ProviderEnrichmentResult
  }
}

service.registerProvider(new MyPimProvider(), priority: 12);
```

---

## 4. Database / cache options

The default cache is `InMemoryEnrichmentCache`. For distributed caching, implement `ProductEnrichmentCache`:

```ts
class RedisEnrichmentCache implements ProductEnrichmentCache {
  constructor(private readonly redis: RedisClient) {}

  async get(key: string): Promise<EnrichedProductProfile | null> {
    const raw = await this.redis.get(`enrich:${key}`);
    return raw ? JSON.parse(raw) : null;
  }

  async set(key: string, value: EnrichedProductProfile, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? 300;
    await this.redis.set(`enrich:${key}`, JSON.stringify(value), "EX", ttl);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(`enrich:${key}`);
  }

  async clear(): Promise<void> {
    // Implement carefully — typically a no-op or scoped flush in production.
  }
}

const service = new ProductEnrichmentService({
  cache: new RedisEnrichmentCache(redisClient),
  providers: [/* ... */],
});
```

---

## 5. API endpoint example

A typical host integration exposes enrichment via an HTTP endpoint:

```ts
// Pseudocode — adapt to your host framework (Express, Fastify, Next.js API route, etc.)
app.post("/api/enrich", async (req, res) => {
  try {
    const input = toEnrichmentInput(req.body);
    const profile = await service.enrich(input);
    res.json(profile);
  } catch (err) {
    if (err instanceof ProductEnrichmentError) {
      res.status(errorStatusCode(err.code)).json(err.toRedactedJSON());
      return;
    }
    res.status(500).json({ code: "INTERNAL_FAILURE", message: "Unexpected error" });
  }
});

function errorStatusCode(code: EnrichmentErrorCode): number {
  switch (code) {
    case "INVALID_INPUT": return 400;
    case "NO_PROVIDER": return 422;
    case "NOT_FOUND": return 404;
    case "PROVIDER_TIMEOUT":
    case "PROVIDER_FAILURE":
    case "MALFORMED_PROVIDER_RESPONSE":
      return 502;
    case "IDENTITY_AMBIGUITY": return 409;
    default: return 500;
  }
}
```

---

## 6. Background job example

For batch enrichment (e.g. processing an intake backlog):

```ts
async function enrichBatch(intakeRecords: RealIntakeRecord[]): Promise<void> {
  for (const record of intakeRecords) {
    try {
      const profile = await service.enrich(toEnrichmentInput(record), {
        executionMode: "PARALLEL",
        timeoutMs: 5000,
        useCache: true,
        log: (level, msg, meta) => logger.log(level, msg, { intakeId: record.id, ...meta }),
      });

      // Persist profile to your database:
      await profilesRepo.save(profile);

      // Emit event for downstream pipeline:
      await eventBus.emit("product.enriched", { enrichmentId: profile.enrichmentId, status: profile.status });
    } catch (err) {
      logger.error("enrichment failed", { intakeId: record.id, err });
      // Continue with next record — one failure must not abort the batch.
    }
  }
}
```

---

## 7. Retry considerations

- **Cache-first.** Always check cache before invoking providers. The service does this automatically.
- **Provider-level retries.** The orchestrator does NOT retry providers. Hosts that want retries should wrap their provider's `enrich()` method (e.g. with exponential backoff) or use a retry-capable HTTP client in their `GenericHttpProductProvider` config.
- **Ambiguity retries.** When `status === "AMBIGUOUS"`, do NOT blindly retry — the same input will likely produce the same conflict. Instead, route to manual review or consult an additional provider.
- **Timeout retries.** Provider timeouts (`error.code === "timeout"`) are safe to retry. Use exponential backoff.
- **Not-found.** `status === "NOT_FOUND"` should NOT be retried with the same providers — cache the negative result and skip.

---

## 8. Observability hooks

The service accepts an optional `log` callback in `EnrichmentOptions`:

```ts
await service.enrich(input, {
  log: (level, message, meta) => {
    logger.log(level, `[enrich] ${message}`, meta);
  },
});
```

This is called for cache hits/misses, short-circuits, timeouts, and orchestrator-level events.

For finer-grained tracing, wrap individual providers:

```ts
class TracingProvider implements ProductEnrichmentProvider {
  constructor(private readonly inner: ProductEnrichmentProvider, private readonly tracer: Tracer) {}
  readonly id = this.inner.id;
  readonly capabilities = this.inner.capabilities;
  async canHandle(input) { return this.inner.canHandle(input); }
  async enrich(input, ctx) {
    const span = this.tracer.startSpan(`provider.${this.id}.enrich`);
    try {
      const result = await this.inner.enrich(input, ctx);
      span.setAttributes({ "provider.found": result.found, "provider.confidence": result.confidence });
      return result;
    } catch (err) {
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  }
}
```

---

## 9. Downstream marketplace comps handoff

The enrichment module produces an `EnrichedProductProfile`. The next module in the pipeline (`primeopp-marketplace-comps`) consumes a `CompsRequest`. The boundary contract is defined in `examples/downstream-handoff.ts`:

```ts
interface CompsRequest {
  enrichmentId: string;
  intakeId?: string;
  primaryIdentifier?: { type: "GTIN" | "UPC" | "EAN" | "ISBN" | "MPN" | "SKU"; value: string };
  brand?: string;
  model?: string;
  title?: string;
  category?: string;
  condition?: "NEW" | "USED" | "REFURBISHED";
  enrichmentConfidence: number;
  knownConflicts: Array<{ field: string; severity: "LOW" | "MEDIUM" | "HIGH" }>;
}
```

Use the `toCompsRequest()` adapter from `examples/downstream-handoff.ts` (or copy it into your host) to convert:

```ts
import { toCompsRequest } from "./examples/downstream-handoff";

const profile = await service.enrich(input);
const compsRequest = toCompsRequest(profile);
const comps = await compsModule.findComps(compsRequest);
```

The enrichment module does NOT implement comps logic.

---

## 10. Decisions that must be made using the real PrimeOpp architecture

The following decisions are deliberately left to the integrating host because they depend on real PrimeOpp infrastructure that this clean-room build cannot inspect:

1. **Cache backend.** In-memory vs Redis vs database. Depends on PrimeOpp's existing caching strategy.
2. **Persistence schema.** How `EnrichedProductProfile` is stored (relational, document, hybrid). A schema migration is required.
3. **Provider credentials.** Which real product-data providers (UPCitemdb, Barcode Lookup, Open Food Facts, Google Books, Open Library, internal PIM) to wire up, with what priority.
4. **Manual-input trust level.** Whether manual user input is `evidence` (default) or `authoritative` for your workflows.
5. **Important-fields policy.** Whether to use the default completeness field list or a per-category policy.
6. **Confidence thresholds.** What `overall` confidence triggers auto-approval vs manual review.
7. **Retry & circuit-breaker policy.** How to wrap providers for retries, circuit breaking, and rate limiting.
8. **Observability stack.** How to wire `EnrichmentOptions.log` into PrimeOpp's logger (Winston, Pino, CloudWatch, Datadog, etc.).
9. **API surface.** Whether to expose enrichment via REST, gRPC, GraphQL, message consumer, or background job.
10. **Comps module contract.** The exact shape of `CompsRequest` — the version in this module is a reasonable starting point but may need adjustment once the real comps module exists.

---

## 11. What NOT to do

- **Do NOT** modify the public exports in `src/index.ts` — downstream modules depend on them.
- **Do NOT** bypass the service and call providers directly — you lose caching, conflict detection, confidence scoring, and completeness.
- **Do NOT** hardcode provider credentials in source. Pass them via `GenericHttpProductProvider` config loaded from your host's secret manager.
- **Do NOT** store raw provider payloads on the profile. Use `rawReferenceId` (bounded to 256 chars) for traceability; stash full payloads in your own data store if needed.
- **Do NOT** assume the confidence score is a probability. It is an operational heuristic.
- **Do NOT** silently resolve `AMBIGUOUS` profiles to `ENRICHED`. Route them to manual review.
