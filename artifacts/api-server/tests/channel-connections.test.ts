import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CHANNELS, normalizeChannelKey } from "../src/lib/channels.js";

describe("OAuth-ready channel connection foundation", () => {
  const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");

  it("returns provider-neutral channels with publish disabled", () => {
    expect(CHANNELS.length).toBeGreaterThan(0);
    expect(CHANNELS.every((channel) => channel.draftsAvailable)).toBe(true);
    expect(CHANNELS.every((channel) => channel.exportsAvailable)).toBe(true);
    expect(CHANNELS.every((channel) => channel.oauthEnabled === false)).toBe(true);
    expect(CHANNELS.every((channel) => channel.publishEnabled === false)).toBe(true);
  });

  it("normalizes configurable channel keys", () => {
    expect(normalizeChannelKey("General Resale")).toBe("general-resale");
    expect(normalizeChannelKey(" custom_channel ")).toBe("custom_channel");
  });

  it("adds an additive shell table with monitoring-only and publish disabled defaults", () => {
    const migration = readFileSync(
      path.join(repoRoot, "lib/db/migrations/0009_channel_account_connections.sql"),
      "utf8",
    );

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS channel_account_connections");
    expect(migration).toContain("connection_status IN");
    expect(migration).toContain("'AUTH_REQUIRED'");
    expect(migration).toContain("token_storage_status TEXT NOT NULL DEFAULT 'NOT_IMPLEMENTED'");
    expect(migration).toContain("monitoring_only BOOLEAN NOT NULL DEFAULT TRUE");
    expect(migration).toContain("publish_authorized BOOLEAN NOT NULL DEFAULT FALSE");
  });

  it("keeps the route implementation honest about OAuth and provider calls", () => {
    const route = readFileSync(
      path.join(repoRoot, "artifacts/api-server/src/routes/channels.ts"),
      "utf8",
    );

    expect(route).toContain("Provider OAuth credentials not configured");
    expect(route).toContain("oauthEnabled: false");
    expect(route).toContain("providerCalls: false");
    expect(route).toContain("publishEnabled: false");
    expect(route).not.toMatch(/access_token|refresh_token|token_secret/i);
  });
});
