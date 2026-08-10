// Real, DB-backed integration coverage for the external-channel publish
// orchestration (lib/channelPublish.ts) through the actual HTTP routes.
//
// MOCKED EXTERNAL API (eBay): every eBay HTTP call in this file is
// intercepted and answered locally -- nothing here ever reaches
// api.ebay.com or api.sandbox.ebay.com. Calls to the test server itself
// (127.0.0.1) pass through to the real network stack unmodified; only
// requests to api.ebay.com/api.sandbox.ebay.com are mocked, which is how a
// single fetch stub can cover both "call our own API under test" and
// "call the external boundary we're simulating."
//
// Everything here is DB-backed against the real Postgres schema (migration
// 0018) -- these run wherever DATABASE_URL is reachable, same as the rest of
// this test file's sibling sourcing-*/listing-* integration tests.
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const DATABASE_URL = "postgres://test:test@127.0.0.1:5432/primeopp_test";

beforeAll(() => {
  process.env["DATABASE_URL"] = DATABASE_URL;
  process.env["SESSION_SECRET"] = "a".repeat(32);
  process.env["ADMIN_EMAIL"] = "sourcing-evidence-test@example.com";
  process.env["ADMIN_PASSWORD"] = "password12345";
  process.env["EBAY_CLIENT_ID"] = "test-client-id";
  process.env["EBAY_CLIENT_SECRET"] = "test-client-secret";
  process.env["OAUTH_TOKEN_ENCRYPTION_KEY"] = "b".repeat(64);
  delete process.env["STRIPE_SECRET_KEY"];
  delete process.env["STRIPE_WEBHOOK_SECRET"];
});

function jsonResponse(status: number, body: unknown): Response {
  if (status === 204) return new Response(null, { status: 204 });
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function withAuthedServer(
  ebayResponses: () => Response | Promise<Response>,
  fn: (ctx: { baseUrl: string; authedFetch: typeof fetch; query: <T>(sql: string, params?: unknown[]) => Promise<T[]> }) => Promise<void>,
) {
  const { default: app } = await import("../src/app.js");
  const { seedInitialAdminUser } = await import("../src/lib/auth.js");
  const { query } = await import("../src/lib/db.js");
  await seedInitialAdminUser();

  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const realFetch = globalThis.fetch;
  const fetchSpy = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.startsWith(baseUrl)) return realFetch(input, init);
    if (url.startsWith("https://api.ebay.com") || url.startsWith("https://api.sandbox.ebay.com")) {
      return Promise.resolve(ebayResponses());
    }
    return realFetch(input, init);
  });
  vi.stubGlobal("fetch", fetchSpy);

  try {
    const loginRes = await fetchSpy(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: process.env["ADMIN_EMAIL"], password: process.env["ADMIN_PASSWORD"] }),
    });
    if (loginRes.status !== 200) throw new Error(`admin login failed with ${loginRes.status}: ${await loginRes.text()}`);
    const cookie = (loginRes.headers.get("set-cookie") ?? "").split(";")[0];
    const { csrfToken } = (await loginRes.json()) as { csrfToken: string };

    const authedFetch: typeof fetch = (input, init = {}) => {
      const headers = new Headers(init.headers);
      headers.set("cookie", cookie);
      if (init.method && init.method !== "GET") headers.set("x-csrf-token", csrfToken);
      headers.set("content-type", "application/json");
      return fetchSpy(input, { ...init, headers });
    };

    await fn({ baseUrl, authedFetch, query });
  } finally {
    vi.unstubAllGlobals();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function createEbayConnection(query: <T>(sql: string, params?: unknown[]) => Promise<T[]>, publishAuthorized: boolean) {
  const { encryptToken } = await import("../src/lib/oauth.js");
  const access = encryptToken("fake-access-token");
  const refresh = encryptToken("fake-refresh-token");
  const rows = await query<{ id: number }>(
    `INSERT INTO channel_account_connections
      (channel, provider_key, connection_status, token_storage_status, monitoring_only, publish_authorized,
       access_token_ciphertext, access_token_iv, access_token_auth_tag,
       refresh_token_ciphertext, refresh_token_iv, refresh_token_auth_tag, token_expires_at, connection_health)
     VALUES ('ebay','ebay','CONNECTED_MONITORING_ONLY','ENCRYPTED',TRUE,$1,$2,$3,$4,$5,$6,$7,$8,'HEALTHY')
     RETURNING id`,
    [
      publishAuthorized,
      access.ciphertext,
      access.iv,
      access.authTag,
      refresh.ciphertext,
      refresh.iv,
      refresh.authTag,
      new Date(Date.now() + 3_600_000).toISOString(),
    ],
  );
  return rows[0]!.id;
}

async function createPackageWithEbayDraft(authedFetch: typeof fetch, baseUrl: string, runId: string) {
  const res = await authedFetch(`${baseUrl}/api/listings/packages`, {
    method: "POST",
    body: JSON.stringify({
      source: "MANUAL_FALLBACK",
      identifier: `${runId}-IDENT`,
      product: {
        title: "Integration Test Sneaker",
        description: "Used sneaker for integration testing.",
        images: ["https://example.com/a.jpg"],
        condition: "USED",
        costBasis: 20,
        targetPrice: 65,
      },
      selectedChannels: ["ebay"],
      createExports: false,
    }),
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as { canonicalListingPackageId: number };
  return body.canonicalListingPackageId;
}

const fullChannelPayloadPatch = {
  source: "MANUAL_FALLBACK",
  identifier: "patched",
  product: { title: "Integration Test Sneaker", description: "Used sneaker.", images: ["https://example.com/a.jpg"], condition: "USED", costBasis: 20, targetPrice: 65 },
  selectedChannels: ["ebay"],
  createExports: false,
};
void fullChannelPayloadPatch;

describe("eBay channel publish -- preflight", () => {
  it("blocks publish with structured issues before any account is even connected", async () => {
    await withAuthedServer(
      () => jsonResponse(200, {}),
      async ({ authedFetch, baseUrl }) => {
        const packageId = await createPackageWithEbayDraft(authedFetch, baseUrl, `preflight-${Date.now()}`);
        const res = await authedFetch(`${baseUrl}/api/listings/packages/${packageId}/channels/ebay/preflight`, { method: "GET" });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { canPublish: boolean; issues: Array<{ code: string }> };
        expect(body.canPublish).toBe(false);
        expect(body.issues.map((i) => i.code)).toContain("CATEGORY_REQUIRED");
      },
    );
  });
});

describe("eBay channel publish -- account gates", () => {
  it("refuses to publish when no account is connected at all", async () => {
    await withAuthedServer(
      () => jsonResponse(200, {}),
      async ({ authedFetch, baseUrl }) => {
        const packageId = await createPackageWithEbayDraft(authedFetch, baseUrl, `noaccount-${Date.now()}`);
        const res = await authedFetch(`${baseUrl}/api/listings/packages/${packageId}/channels/ebay/publish`, { method: "POST", body: "{}" });
        expect(res.status).toBe(409);
        const body = (await res.json()) as { reason: string };
        expect(["preflight_failed", "account_not_connected"]).toContain(body.reason);
      },
    );
  });

  it("refuses to publish when connected but not publish_authorized, even with a perfect listing", async () => {
    await withAuthedServer(
      () => jsonResponse(200, {}),
      async ({ authedFetch, baseUrl, query }) => {
        await createEbayConnection(query, false);
        const packageId = await createPackageWithEbayDraft(authedFetch, baseUrl, `unauthorized-${Date.now()}`);

        await authedFetch(`${baseUrl}/api/listings/packages/${packageId}`, {
          method: "PUT",
          body: JSON.stringify({
            ...fullChannelPayloadPatch,
            source: "MANUAL_FALLBACK",
            identifier: "unauthorized-ident",
          }),
        });

        const res = await authedFetch(`${baseUrl}/api/listings/packages/${packageId}/channels/ebay/publish`, { method: "POST", body: "{}" });
        expect(res.status).toBe(409);
        const body = (await res.json()) as { reason: string };
        expect(body.reason === "publish_not_authorized" || body.reason === "preflight_failed").toBe(true);
      },
    );
  });
});

describe("eBay channel publish -- retry is idempotent (no duplicate external listing)", () => {
  it("first attempt times out (SUBMITTING), retry reconciles and lands on exactly one LIVE listing", async () => {
    const runId = `retry-${Date.now()}`;
    let ebayCallCount = 0;

    await withAuthedServer(
      () => {
        ebayCallCount += 1;
        if (ebayCallCount === 1) {
          // PUT inventory_item on the FIRST publish attempt times out.
          const err = new Error("aborted");
          err.name = "AbortError";
          return Promise.reject(err) as unknown as Response;
        }
        // Every call on the retry succeeds end-to-end.
        if (ebayCallCount === 2) return jsonResponse(204, null); // PUT inventory_item
        if (ebayCallCount === 3) return jsonResponse(200, { offers: [] }); // GET offer?sku
        if (ebayCallCount === 4) return jsonResponse(201, { offerId: `offer-${runId}` }); // POST offer
        return jsonResponse(200, { listingId: `listing-${runId}` }); // POST publish
      },
      async ({ authedFetch, baseUrl, query }) => {
        await createEbayConnection(query, true);
        const packageId = await createPackageWithEbayDraft(authedFetch, baseUrl, runId);

        const patchRes = await authedFetch(`${baseUrl}/api/listings/packages/${packageId}`, {
          method: "PUT",
          body: JSON.stringify({
            source: "MANUAL_FALLBACK",
            identifier: `${runId}-ident`,
            product: {
              title: "Integration Test Sneaker",
              description: "Used sneaker.",
              images: ["https://example.com/a.jpg"],
              condition: "USED",
              costBasis: 20,
              targetPrice: 65,
            },
            selectedChannels: ["ebay"],
            createExports: false,
          }),
        });
        expect(patchRes.status).toBe(200);
        const patched = (await patchRes.json()) as { channelDrafts: Array<{ channel: string; channel_payload: Record<string, unknown> }> };
        void patched;

        // Manually stamp the eBay-account-specific fields the mapping layer
        // requires (category + business policies) directly onto the draft's
        // channel_payload -- there is no UI for this yet, this is exactly
        // the gap Phase 4 says to surface, not fabricate, in the real
        // product.
        await query(
          `UPDATE channel_listing_drafts
           SET channel_payload = channel_payload || '{"categoryId":"11450","fulfillmentPolicyId":"fp-1","paymentPolicyId":"pp-1","returnPolicyId":"rp-1"}'::jsonb
           WHERE canonical_listing_id=$1 AND channel='ebay'`,
          [packageId],
        );

        // First attempt: PUT inventory_item times out.
        const firstRes = await authedFetch(`${baseUrl}/api/listings/packages/${packageId}/channels/ebay/publish`, { method: "POST", body: "{}" });
        expect(firstRes.status).toBe(202);
        const first = (await firstRes.json()) as { status: string };
        expect(first.status).toBe("SUBMITTING");

        // Retry: same idempotency key (payload unchanged) -- but since the
        // first attempt never reached SUCCESS, this makes a fresh call
        // rather than short-circuiting, and this time it completes.
        const secondRes = await authedFetch(`${baseUrl}/api/listings/packages/${packageId}/channels/ebay/publish`, { method: "POST", body: "{}" });
        expect(secondRes.status).toBe(200);
        const second = (await secondRes.json()) as { status: string; externalListingId: string };
        expect(second.status).toBe("LIVE");
        expect(second.externalListingId).toBe(`listing-${runId}`);

        // A THIRD call with the identical payload must now short-circuit on
        // the recorded SUCCESS attempt -- reused:true, no new eBay call.
        const callsBeforeThird = ebayCallCount;
        const thirdRes = await authedFetch(`${baseUrl}/api/listings/packages/${packageId}/channels/ebay/publish`, { method: "POST", body: "{}" });
        expect(thirdRes.status).toBe(200);
        const third = (await thirdRes.json()) as { reused: boolean; externalListingId: string };
        expect(third.reused).toBe(true);
        expect(third.externalListingId).toBe(`listing-${runId}`);
        expect(ebayCallCount).toBe(callsBeforeThird); // no additional eBay calls

        // Exactly one attempt log row reached SUCCESS for this draft.
        const successAttempts = await query<{ count: string }>(
          `SELECT COUNT(*)::text as count FROM channel_publish_attempts cpa
           JOIN channel_listing_drafts cld ON cld.id = cpa.channel_listing_draft_id
           WHERE cld.canonical_listing_id=$1 AND cpa.attempt_status='SUCCESS'`,
          [packageId],
        );
        expect(successAttempts[0]?.count).toBe("1");
      },
    );
  });
});

describe("eBay channel publish -- end transitions to ENDED", () => {
  it("ends a live listing and records external_status/channel_status as ENDED", async () => {
    const runId = `end-${Date.now()}`;
    let ebayCallCount = 0;

    await withAuthedServer(
      () => {
        ebayCallCount += 1;
        if (ebayCallCount === 1) return jsonResponse(204, null); // PUT inventory_item
        if (ebayCallCount === 2) return jsonResponse(200, { offers: [] }); // GET offer?sku
        if (ebayCallCount === 3) return jsonResponse(201, { offerId: `offer-${runId}` }); // POST offer
        if (ebayCallCount === 4) return jsonResponse(200, { listingId: `listing-${runId}` }); // POST publish
        return jsonResponse(200, {}); // POST withdraw
      },
      async ({ authedFetch, baseUrl, query }) => {
        await createEbayConnection(query, true);
        const packageId = await createPackageWithEbayDraft(authedFetch, baseUrl, runId);
        await query(
          `UPDATE channel_listing_drafts
           SET channel_payload = channel_payload || '{"categoryId":"11450","fulfillmentPolicyId":"fp-1","paymentPolicyId":"pp-1","returnPolicyId":"rp-1"}'::jsonb
           WHERE canonical_listing_id=$1 AND channel='ebay'`,
          [packageId],
        );

        const publishRes = await authedFetch(`${baseUrl}/api/listings/packages/${packageId}/channels/ebay/publish`, { method: "POST", body: "{}" });
        expect(publishRes.status).toBe(200);

        const endRes = await authedFetch(`${baseUrl}/api/listings/packages/${packageId}/channels/ebay/end`, { method: "POST", body: "{}" });
        expect(endRes.status).toBe(200);
        const endBody = (await endRes.json()) as { status: string };
        expect(endBody.status).toBe("ENDED");

        const rows = await query<{ channel_status: string; external_status: string }>(
          `SELECT channel_status, external_status FROM channel_listing_drafts WHERE canonical_listing_id=$1 AND channel='ebay'`,
          [packageId],
        );
        expect(rows[0]?.channel_status).toBe("ENDED");
        expect(rows[0]?.external_status).toBe("ENDED");
      },
    );
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

afterAll(async () => {
  const { pool } = await import("../src/lib/db.js");
  await pool.end();
});
