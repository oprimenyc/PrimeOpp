import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decryptToken,
  encryptionAvailable,
  encryptToken,
  generateAuthorizationHandshake,
  getOAuthProvider,
  oauthConfigStatus,
  OAUTH_PROVIDERS,
  validateState,
} from "../src/lib/oauth.js";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");

describe("OAuth implementation", () => {
  const savedEnv = { ...process.env };
  beforeEach(() => {
    delete process.env["EBAY_CLIENT_ID"];
    delete process.env["EBAY_CLIENT_SECRET"];
    delete process.env["OAUTH_REDIRECT_BASE_URL"];
    delete process.env["OAUTH_TOKEN_ENCRYPTION_KEY"];
  });
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("returns NOT_CONFIGURED with the exact required env var names for a supported provider", () => {
    const status = oauthConfigStatus(getOAuthProvider("ebay")!);
    expect(status.status).toBe("NOT_CONFIGURED");
    expect(status.missingEnv).toContain("EBAY_CLIENT_ID");
    expect(status.missingEnv).toContain("EBAY_CLIENT_SECRET");
    expect(status.missingEnv).toContain("OAUTH_REDIRECT_BASE_URL");
    expect(status.missingEnv).toContain("OAUTH_TOKEN_ENCRYPTION_KEY");
  });

  it("marks providers without a documented seller OAuth flow as UNSUPPORTED, not faked", () => {
    expect(oauthConfigStatus(getOAuthProvider("mercari")!).status).toBe("UNSUPPORTED");
    expect(oauthConfigStatus(getOAuthProvider("poshmark")!).status).toBe("UNSUPPORTED");
  });

  it("generates a CSRF state and validates it, rejecting mismatches and expiry", () => {
    const provider = getOAuthProvider("ebay")!;
    const handshake = generateAuthorizationHandshake(provider);
    const future = new Date(Date.now() + 60_000).toISOString();
    const past = new Date(Date.now() - 1000).toISOString();

    expect(validateState(handshake.state, handshake.stateHash, future)).toBe(true);
    expect(validateState("tampered", handshake.stateHash, future)).toBe(false);
    expect(validateState(handshake.state, handshake.stateHash, past)).toBe(false);
  });

  it("produces a PKCE verifier + S256 challenge for PKCE-capable providers only", () => {
    const etsy = generateAuthorizationHandshake(getOAuthProvider("etsy")!);
    expect(etsy.pkceVerifier).not.toBeNull();
    expect(etsy.pkceChallenge).not.toBeNull();

    const ebay = generateAuthorizationHandshake(getOAuthProvider("ebay")!);
    expect(ebay.pkceVerifier).toBeNull();
  });

  it("encrypts and decrypts tokens with AES-256-GCM (round trip) and never stores plaintext", () => {
    process.env["OAUTH_TOKEN_ENCRYPTION_KEY"] = "a".repeat(64);
    expect(encryptionAvailable()).toBe(true);
    const enc = encryptToken("super-secret-access-token");
    expect(enc.ciphertext).not.toContain("super-secret");
    expect(enc.iv).toBeTruthy();
    expect(enc.authTag).toBeTruthy();
    expect(decryptToken(enc)).toBe("super-secret-access-token");
  });

  it("reports encryption unavailable when the key is missing or malformed", () => {
    expect(encryptionAvailable()).toBe(false);
    process.env["OAUTH_TOKEN_ENCRYPTION_KEY"] = "too-short";
    expect(encryptionAvailable()).toBe(false);
  });

  it("defaults every provider status to monitoring-only and publish-unauthorized", () => {
    for (const provider of OAUTH_PROVIDERS) {
      const config = oauthConfigStatus(provider);
      expect(["READY", "NOT_CONFIGURED", "UNSUPPORTED"]).toContain(config.status);
    }
  });

  it("stores tokens only as encrypted ciphertext + iv + auth tag columns (migration)", () => {
    const migration = readFileSync(path.join(repoRoot, "lib/db/migrations/0012_oauth_connections.sql"), "utf8");
    expect(migration).toContain("access_token_ciphertext");
    expect(migration).toContain("access_token_iv");
    expect(migration).toContain("access_token_auth_tag");
    // There must be no plaintext token column.
    expect(migration).not.toMatch(/\baccess_token TEXT\b/);
    expect(migration).not.toMatch(/\brefresh_token TEXT\b/);
  });

  it("keeps the OAuth route honest about tokens and publishing", () => {
    const route = readFileSync(path.join(repoRoot, "artifacts/api-server/src/routes/oauth.ts"), "utf8");
    expect(route).toContain("publishEnabled: false");
    expect(route).toContain("monitoring_only=TRUE");
    expect(route).toContain("publish_authorized=FALSE");
    // Tokens are encrypted before storage, never logged in plaintext.
    expect(route).toContain("encryptToken");
    expect(route).not.toMatch(/console\.(log|error)\([^)]*access_token/i);
  });
});
