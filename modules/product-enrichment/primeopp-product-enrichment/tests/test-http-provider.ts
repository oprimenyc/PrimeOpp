import {
  describe,
  it,
  assertEqual,
  assertTruthy,
  assertFalsy,
  assertApprox,
} from "./harness";
import { GenericHttpProductProvider } from "../src/providers/http-provider";
import type {
  HttpProviderConfig,
  HttpRequestBuilderResult,
  HttpResponseMapperResult,
} from "../src/providers/http-provider";
import type { ProductEnrichmentInput } from "../src/contracts/input";
import { normalizeIdentifier } from "../src/domain/identifier";

function makeMockFetch(
  responses: Record<string, { status: number; body: unknown }>
): typeof fetch {
  return (async (url: string | URL | Request, _init?: RequestInit) => {
    const u = typeof url === "string" ? url : url.toString();
    const key = Object.keys(responses).find((k) => u.includes(k));
    if (!key) {
      return new Response(JSON.stringify({ error: "no mock" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    const r = responses[key];
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

describe("GenericHttpProductProvider", () => {
  it("is disabled by default and returns provider-disabled", async () => {
    const provider = new GenericHttpProductProvider({
      id: "test-http",
      baseUrl: "https://example.com",
      requestBuilder: () => ({ url: "https://example.com/x" }),
      responseMapper: () => ({ found: false, confidence: 0, candidates: [] }),
    });
    const canHandle = await provider.canHandle({
      identifier: normalizeIdentifier("036000291452"),
    });
    assertFalsy(canHandle);

    // Even if we call enrich directly, the disabled provider returns an error.
    const result = await provider.enrich(
      { identifier: normalizeIdentifier("036000291452") },
      { timeoutMs: 1000, includeImages: true }
    );
    assertEqual(result.found, false);
    assertEqual(result.error?.code, "provider-disabled");
  });

  it("returns not-found for unknown barcode when enabled", async () => {
    const fetchImpl = makeMockFetch({
      "/api/barcode/": { status: 404, body: { error: "not found" } },
    });
    const provider = new GenericHttpProductProvider({
      id: "test-http",
      baseUrl: "https://example.com",
      enabled: true,
      fetchImpl,
      requestBuilder: (input, baseUrl) => {
        const gtin = input.identifier?.normalizedValue;
        if (!gtin) return null;
        return { url: `${baseUrl}/api/barcode/${gtin}` };
      },
      responseMapper: (status, _body) => {
        if (status === 404) return { found: false, confidence: 0, candidates: [] };
        return { found: true, confidence: 0.9, candidates: [] };
      },
    });
    const result = await provider.enrich(
      { identifier: normalizeIdentifier("036000291452") },
      { timeoutMs: 1000, includeImages: true }
    );
    assertEqual(result.found, false);
    assertEqual(result.error?.code, "not-found");
  });

  it("maps a successful response to candidates", async () => {
    const fetchImpl = makeMockFetch({
      "/api/barcode/": {
        status: 200,
        body: {
          product: {
            brand: "MockBrand",
            title: "Mock Product",
            gtin: "036000291452",
          },
        },
      },
    });
    const provider = new GenericHttpProductProvider({
      id: "test-http",
      baseUrl: "https://example.com",
      enabled: true,
      fetchImpl,
      requestBuilder: (input, baseUrl) => {
        const gtin = input.identifier?.normalizedValue;
        if (!gtin) return null;
        return { url: `${baseUrl}/api/barcode/${gtin}` };
      },
      responseMapper: (_status, body) => {
        const b = body as { product: { brand: string; title: string; gtin: string } };
        return {
          found: true,
          confidence: 0.85,
          candidates: [
            {
              field: "identity.brand",
              value: b.product.brand,
              providerId: "test-http",
              sourceConfidence: 0.85,
              providerPriority: 20,
            },
            {
              field: "identity.canonicalTitle",
              value: b.product.title,
              providerId: "test-http",
              sourceConfidence: 0.85,
              providerPriority: 20,
            },
          ],
        };
      },
    });
    const result = await provider.enrich(
      { identifier: normalizeIdentifier("036000291452") },
      { timeoutMs: 1000, includeImages: true }
    );
    assertEqual(result.found, true);
    assertEqual(result.candidates.length, 2);
    assertEqual(result.candidates[0].value, "MockBrand");
  });

  it("enforces timeout via AbortController", async () => {
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      // Wait long enough to be aborted.
      await new Promise((r) => setTimeout(r, 500));
      // If aborted, this won't fire — but we want to ensure AbortController is wired.
      if (init?.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    const provider = new GenericHttpProductProvider({
      id: "slow-http",
      baseUrl: "https://example.com",
      enabled: true,
      fetchImpl,
      timeoutMs: 50,
      requestBuilder: (_input, baseUrl) => ({ url: `${baseUrl}/api/x` }),
      responseMapper: () => ({ found: false, confidence: 0, candidates: [] }),
    });
    const result = await provider.enrich(
      { identifier: normalizeIdentifier("036000291452") },
      { timeoutMs: 50, includeImages: true }
    );
    assertEqual(result.found, false);
    // Either timeout or fetch-failed is acceptable depending on Node version.
    assertTruthy(result.error?.code === "timeout" || result.error?.code === "fetch-failed");
  });

  it("rejects oversized response bodies", async () => {
    const hugeBody = "x".repeat(2 * 1024 * 1024); // 2 MiB
    const fetchImpl = (async () => {
      return new Response(hugeBody, { status: 200, headers: { "content-type": "text/plain" } });
    }) as typeof fetch;
    const provider = new GenericHttpProductProvider({
      id: "huge-http",
      baseUrl: "https://example.com",
      enabled: true,
      fetchImpl,
      maxBodyBytes: 1024,
      requestBuilder: (_input, baseUrl) => ({ url: `${baseUrl}/api/x` }),
      responseMapper: () => ({ found: false, confidence: 0, candidates: [] }),
    });
    const result = await provider.enrich(
      { identifier: normalizeIdentifier("036000291452") },
      { timeoutMs: 1000, includeImages: true }
    );
    assertEqual(result.found, false);
    assertEqual(result.error?.code, "oversized-response");
  });

  it("never embeds API key in URL", async () => {
    let capturedUrl = "";
    const fetchImpl = (async (url: string | URL | Request) => {
      capturedUrl = typeof url === "string" ? url : url.toString();
      return new Response("{}", { status: 404 });
    }) as typeof fetch;
    const provider = new GenericHttpProductProvider({
      id: "secret-http",
      baseUrl: "https://example.com",
      enabled: true,
      apiKey: "sk-secret-123",
      fetchImpl,
      requestBuilder: (_input, baseUrl, apiKey) => ({
        url: `${baseUrl}/api/barcode/x`,
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
      responseMapper: () => ({ found: false, confidence: 0, candidates: [] }),
    });
    await provider.enrich(
      { identifier: normalizeIdentifier("036000291452") },
      { timeoutMs: 1000, includeImages: true }
    );
    assertFalsy(capturedUrl.includes("sk-secret-123"));
  });
});
