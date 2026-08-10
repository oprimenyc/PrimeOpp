// GET /channels reports live oauthEnabled/publishEnabled per channel from
// the adapter registry. This mounts routes/channels.ts directly (not the
// full app.ts) since the endpoint under test does no DB work and requires
// no auth -- avoiding the DB dependency the rest of this file's sibling
// integration tests need.
import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import channelsRouter from "../src/routes/channels.js";

const app = express();
let server: ReturnType<typeof app.listen>;
let baseUrl: string;

beforeAll(async () => {
  app.use(express.json());
  app.use("/api", channelsRouter);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const port = (server.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

afterEach(() => {
  delete process.env["EBAY_CLIENT_ID"];
  delete process.env["EBAY_CLIENT_SECRET"];
});

describe("GET /channels -- live capability override", () => {
  it("reports eBay publishEnabled:false while EBAY_CLIENT_ID/SECRET are unset", async () => {
    delete process.env["EBAY_CLIENT_ID"];
    delete process.env["EBAY_CLIENT_SECRET"];

    const res = await fetch(`${baseUrl}/api/channels`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { channels: Array<{ key: string; oauthEnabled: boolean; publishEnabled: boolean }>; publishEnabled: boolean };
    const ebay = body.channels.find((c) => c.key === "ebay");
    expect(ebay?.oauthEnabled).toBe(true); // adapter exists
    expect(ebay?.publishEnabled).toBe(false); // not configured
    expect(body.publishEnabled).toBe(false); // no channel is publish-ready
  });

  it("flips eBay publishEnabled:true the moment EBAY_CLIENT_ID/SECRET are set -- configuration only, no code change", async () => {
    process.env["EBAY_CLIENT_ID"] = "test-id";
    process.env["EBAY_CLIENT_SECRET"] = "test-secret";

    const res = await fetch(`${baseUrl}/api/channels`);
    const body = (await res.json()) as { channels: Array<{ key: string; publishEnabled: boolean }>; publishEnabled: boolean };
    const ebay = body.channels.find((c) => c.key === "ebay");
    expect(ebay?.publishEnabled).toBe(true);
    expect(body.publishEnabled).toBe(true);
  });

  it("leaves non-adapter channels at their static drafts/exports-only defaults regardless of env", async () => {
    process.env["EBAY_CLIENT_ID"] = "test-id";
    process.env["EBAY_CLIENT_SECRET"] = "test-secret";

    const res = await fetch(`${baseUrl}/api/channels`);
    const body = (await res.json()) as { channels: Array<{ key: string; publishEnabled: boolean; oauthEnabled: boolean }> };
    const generalResale = body.channels.find((c) => c.key === "general-resale");
    expect(generalResale?.publishEnabled).toBe(false);
    expect(generalResale?.oauthEnabled).toBe(false);
  });
});
