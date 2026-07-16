/**
 * GenericHttpProductProvider — reusable HTTP adapter template.
 *
 * This adapter demonstrates how a real product-data source (e.g. UPCitemdb,
 * Barcode Lookup, Open Food Facts, a host's internal PIM) could be wired
 * into the module. It is INTEGRATION-DEPENDENT and DISABLED by default.
 *
 * Design constraints:
 *   - Never reads secrets from process.env. Secrets are passed in via
 *     `HttpProviderConfig.apiKey` at construction time by the host.
 *   - Never logs request URLs with embedded credentials.
 *   - Enforces a per-call timeout via AbortController.
 *   - Validates response shape; rejects oversized payloads.
 *   - Maps provider-specific response shapes to `FieldCandidate[]` via
 *     a user-supplied `responseMapper` function.
 *   - Returns a structured `error` rather than throwing on provider-side
 *     failures, so the orchestrator can isolate the failure.
 *
 * The default `requestBuilder` and `responseMapper` are no-ops. Hosts MUST
 * supply these when constructing the adapter. Without them, the adapter
 * returns `found: false` with a `provider-disabled` error code.
 */

import type { ProductEnrichmentInput } from "../contracts/input";
import type {
  EnrichmentContext,
  EnrichmentProviderCapability,
  ProductEnrichmentProvider,
  ProviderEnrichmentResult,
  FieldCandidate,
  ImageCandidate,
} from "../contracts/provider";
import { isBarcodeIdentifier, isIsbnIdentifier } from "../domain/identifier";

export interface HttpRequestBuilderResult {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
}

export interface HttpResponseMapperResult {
  found: boolean;
  confidence: number;
  candidates: FieldCandidate[];
  images?: ImageCandidate[];
  externalReference?: string;
  rawReferenceId?: string;
}

export interface HttpProviderConfig {
  id: string;
  /** Static priority (lower = higher priority). */
  priority?: number;
  /** Base URL e.g. "https://api.example.com". */
  baseUrl: string;
  /** API key / bearer token. NEVER read from process.env by the core module. */
  apiKey?: string;
  /** Default timeout ms. */
  timeoutMs?: number;
  /** Capabilities this adapter supports. */
  capabilities?: EnrichmentProviderCapability[];
  /**
   * Builds the HTTP request from input. Return `null` to signal
   * "cannot handle this input".
   */
  requestBuilder: (
    input: ProductEnrichmentInput,
    baseUrl: string,
    apiKey: string | undefined
  ) => HttpRequestBuilderResult | null;
  /** Maps the raw HTTP response body into structured candidates. */
  responseMapper: (
    status: number,
    body: unknown,
    input: ProductEnrichmentInput
  ) => HttpResponseMapperResult;
  /** Optional: validate the parsed body before mapping. */
  bodyValidator?: (body: unknown) => boolean;
  /** Maximum response body size in bytes (default 1 MiB). */
  maxBodyBytes?: number;
  /** Whether the adapter is enabled. When false, returns `provider-disabled`. */
  enabled?: boolean;
  /** Custom fetch implementation (for testing). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

interface HttpAdapterDefaults {
  priority: number;
  timeoutMs: number;
  maxBodyBytes: number;
  enabled: boolean;
}

const DEFAULTS: HttpAdapterDefaults = {
  priority: 20,
  timeoutMs: 5000,
  maxBodyBytes: 1024 * 1024,
  enabled: false,
};

export class GenericHttpProductProvider implements ProductEnrichmentProvider {
  readonly id: string;
  readonly capabilities: EnrichmentProviderCapability[];
  private readonly priority: number;
  private readonly timeoutMs: number;
  private readonly maxBodyBytes: number;
  private readonly enabled: boolean;
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly requestBuilder: HttpProviderConfig["requestBuilder"];
  private readonly responseMapper: HttpProviderConfig["responseMapper"];
  private readonly bodyValidator?: HttpProviderConfig["bodyValidator"];
  private readonly fetchImpl: typeof fetch;

  constructor(config: HttpProviderConfig) {
    this.id = config.id;
    this.priority = config.priority ?? DEFAULTS.priority;
    this.timeoutMs = config.timeoutMs ?? DEFAULTS.timeoutMs;
    this.maxBodyBytes = config.maxBodyBytes ?? DEFAULTS.maxBodyBytes;
    this.enabled = config.enabled ?? DEFAULTS.enabled;
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.capabilities =
      config.capabilities ?? (["BARCODE_LOOKUP", "TEXT_SEARCH"] as EnrichmentProviderCapability[]);
    this.requestBuilder = config.requestBuilder;
    this.responseMapper = config.responseMapper;
    this.bodyValidator = config.bodyValidator;
    this.fetchImpl = config.fetchImpl ?? (globalThis.fetch as typeof fetch);
  }

  async canHandle(input: ProductEnrichmentInput): Promise<boolean> {
    if (!this.enabled) return false;
    if (input.identifier && input.identifier.isValidFormat) {
      return (
        isBarcodeIdentifier(input.identifier.identifierType) ||
        isIsbnIdentifier(input.identifier.identifierType) ||
        input.identifier.identifierType === "SKU"
      );
    }
    const mp = input.manualProduct;
    return Boolean(mp && (mp.title || (mp.brand && mp.model)));
  }

  async enrich(
    input: ProductEnrichmentInput,
    context: EnrichmentContext
  ): Promise<ProviderEnrichmentResult> {
    const retrievedAt = new Date().toISOString();
    if (!this.enabled) {
      return {
        providerId: this.id,
        found: false,
        confidence: 0,
        candidates: [],
        retrievedAt,
        error: {
          code: "provider-disabled",
          message: `HTTP provider ${this.id} is not enabled.`,
          retryable: false,
        },
      };
    }

    let req: HttpRequestBuilderResult | null;
    try {
      req = this.requestBuilder(input, this.baseUrl, this.apiKey);
    } catch (err) {
      return this.errorResult("request-build-failed", safeMsg(err), false, retrievedAt);
    }
    if (!req) {
      return {
        providerId: this.id,
        found: false,
        confidence: 0,
        candidates: [],
        retrievedAt,
        error: { code: "not-applicable", message: "Request builder declined input.", retryable: false },
      };
    }

    const timeout = Math.min(context.timeoutMs || this.timeoutMs, this.timeoutMs);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const headers: Record<string, string> = { ...(req.headers ?? {}) };
      // Never log Authorization header value.
      const fetchOpts: RequestInit = {
        method: req.method ?? "GET",
        headers,
        signal: controller.signal,
      };
      if (req.body !== undefined) {
        fetchOpts.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
        if (!headers["Content-Type"] && !headers["content-type"]) {
          headers["Content-Type"] = "application/json";
        }
      }

      const resp = await this.fetchImpl(req.url, fetchOpts);
      const contentLength = Number(resp.headers?.get?.("content-length") ?? 0);
      if (contentLength && contentLength > this.maxBodyBytes) {
        return this.errorResult(
          "oversized-response",
          `Response exceeds max body size (${this.maxBodyBytes} bytes).`,
          false,
          retrievedAt
        );
      }

      const text = await resp.text();
      if (text.length > this.maxBodyBytes) {
        return this.errorResult(
          "oversized-response",
          `Response body exceeds max body size (${this.maxBodyBytes} bytes).`,
          false,
          retrievedAt
        );
      }

      let body: unknown;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        // Non-JSON response — let the mapper decide.
        body = text;
      }

      if (this.bodyValidator && !this.bodyValidator(body)) {
        return this.errorResult(
          "malformed-response",
          "Response failed body validation.",
          false,
          retrievedAt
        );
      }

      let mapped: HttpResponseMapperResult;
      try {
        mapped = this.responseMapper(resp.status, body, input);
      } catch (err) {
        return this.errorResult("mapper-failed", safeMsg(err), false, retrievedAt);
      }

      // Apply provider priority to all candidates.
      for (const c of mapped.candidates) {
        c.providerId = this.id;
        c.providerPriority = this.priority;
      }
      if (mapped.images) {
        for (const img of mapped.images) {
          img.confidence = img.confidence ?? mapped.confidence;
        }
      }

      return {
        providerId: this.id,
        found: mapped.found,
        confidence: mapped.confidence,
        candidates: mapped.candidates,
        images: mapped.images,
        externalReference: mapped.externalReference,
        rawReferenceId: mapped.rawReferenceId,
        retrievedAt,
        error: mapped.found
          ? undefined
          : { code: "not-found", message: "Provider returned no match.", retryable: false },
      };
    } catch (err) {
      if (isAbortError(err)) {
        return this.errorResult(
          "timeout",
          `Request timed out after ${timeout}ms.`,
          true,
          retrievedAt
        );
      }
      return this.errorResult("fetch-failed", safeMsg(err), true, retrievedAt);
    } finally {
      clearTimeout(timer);
    }
  }

  private errorResult(
    code: string,
    message: string,
    retryable: boolean,
    retrievedAt: string
  ): ProviderEnrichmentResult {
    return {
      providerId: this.id,
      found: false,
      confidence: 0,
      candidates: [],
      retrievedAt,
      error: { code, message, retryable },
    };
  }
}

function isAbortError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof Error) {
    return err.name === "AbortError";
  }
  return false;
}

function safeMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
