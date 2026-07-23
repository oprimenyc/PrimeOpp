// oauth.ts — OAuth authorization-code + PKCE implementation for seller-owned
// marketplace accounts.
//
// This module implements the full flow shape: provider registry, authorization
// URL construction, CSRF state + PKCE verifier generation and hashing, and
// AES-256-GCM token encryption/decryption. It NEVER prints tokens, never stores
// plaintext tokens, and never fabricates a connection. When a provider's
// credentials are absent it reports NOT_CONFIGURED with the exact required
// environment variable names.
//
// Connection defaults enforced elsewhere: monitoring_only = true,
// publish_authorized = false. Publishing stays disabled in this build.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type OAuthProvider = {
  key: string;
  label: string;
  // Whether this provider has a documented OAuth 2.0 authorization-code flow we
  // can safely target once credentials are configured.
  supportsOAuth: boolean;
  supportsPkce: boolean;
  supportsRefresh: boolean;
  authorizeUrl: string | null;
  tokenUrl: string | null;
  defaultScopes: string[];
  // Exact env var names required for a live flow.
  clientIdEnv: string | null;
  clientSecretEnv: string | null;
};

// Providers with documented OAuth support are marked supportsOAuth=true. Others
// are listed as UNSUPPORTED so the UI can be honest rather than implying a flow
// that does not exist.
export const OAUTH_PROVIDERS: OAuthProvider[] = [
  {
    key: "ebay",
    label: "eBay",
    supportsOAuth: true,
    supportsPkce: false,
    supportsRefresh: true,
    authorizeUrl: "https://auth.ebay.com/oauth2/authorize",
    tokenUrl: "https://api.ebay.com/identity/v1/oauth2/token",
    defaultScopes: ["https://api.ebay.com/oauth/api_scope"],
    clientIdEnv: "EBAY_CLIENT_ID",
    clientSecretEnv: "EBAY_CLIENT_SECRET",
  },
  {
    key: "etsy",
    label: "Etsy",
    supportsOAuth: true,
    supportsPkce: true,
    supportsRefresh: true,
    authorizeUrl: "https://www.etsy.com/oauth/connect",
    tokenUrl: "https://api.etsy.com/v3/public/oauth/token",
    defaultScopes: ["listings_r"],
    clientIdEnv: "ETSY_CLIENT_ID",
    clientSecretEnv: "ETSY_CLIENT_SECRET",
  },
  {
    key: "amazon",
    label: "Amazon",
    supportsOAuth: true,
    supportsPkce: false,
    supportsRefresh: true,
    authorizeUrl: "https://sellercentral.amazon.com/apps/authorize/consent",
    tokenUrl: "https://api.amazon.com/auth/o2/token",
    defaultScopes: [],
    clientIdEnv: "AMAZON_LWA_CLIENT_ID",
    clientSecretEnv: "AMAZON_LWA_CLIENT_SECRET",
  },
  // Providers without a documented seller-owned OAuth publish flow we can safely
  // target are marked UNSUPPORTED rather than faked.
  { key: "mercari", label: "Mercari", supportsOAuth: false, supportsPkce: false, supportsRefresh: false, authorizeUrl: null, tokenUrl: null, defaultScopes: [], clientIdEnv: null, clientSecretEnv: null },
  { key: "poshmark", label: "Poshmark", supportsOAuth: false, supportsPkce: false, supportsRefresh: false, authorizeUrl: null, tokenUrl: null, defaultScopes: [], clientIdEnv: null, clientSecretEnv: null },
  { key: "facebook-marketplace", label: "Facebook Marketplace", supportsOAuth: false, supportsPkce: false, supportsRefresh: false, authorizeUrl: null, tokenUrl: null, defaultScopes: [], clientIdEnv: null, clientSecretEnv: null },
];

export function getOAuthProvider(key: string): OAuthProvider | undefined {
  return OAUTH_PROVIDERS.find((provider) => provider.key === key);
}

export type OAuthConfigStatus =
  | { status: "READY"; missingEnv: [] }
  | { status: "NOT_CONFIGURED"; missingEnv: string[] }
  | { status: "UNSUPPORTED"; missingEnv: [] };

export function oauthConfigStatus(provider: OAuthProvider): OAuthConfigStatus {
  if (!provider.supportsOAuth) return { status: "UNSUPPORTED", missingEnv: [] };

  const required = [provider.clientIdEnv, provider.clientSecretEnv, "OAUTH_REDIRECT_BASE_URL", "OAUTH_TOKEN_ENCRYPTION_KEY"].filter(
    (name): name is string => Boolean(name),
  );
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) return { status: "NOT_CONFIGURED", missingEnv: missing };
  return { status: "READY", missingEnv: [] };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function base64url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

// Generate a single-use CSRF state and (when supported) a PKCE verifier +
// challenge. Only the hashes are persisted; the raw verifier is returned to the
// caller for the token-exchange step and is never logged.
export function generateAuthorizationHandshake(provider: OAuthProvider): {
  state: string;
  stateHash: string;
  pkceVerifier: string | null;
  pkceChallenge: string | null;
  pkceVerifierHash: string | null;
} {
  const state = base64url(randomBytes(32));
  const stateHash = sha256(state);

  if (!provider.supportsPkce) {
    return { state, stateHash, pkceVerifier: null, pkceChallenge: null, pkceVerifierHash: null };
  }

  const pkceVerifier = base64url(randomBytes(64));
  const pkceChallenge = base64url(createHash("sha256").update(pkceVerifier).digest());
  return { state, stateHash, pkceVerifier, pkceChallenge, pkceVerifierHash: sha256(pkceVerifier) };
}

export function buildAuthorizationUrl(
  provider: OAuthProvider,
  params: { clientId: string; redirectUri: string; state: string; scopes: string[]; pkceChallenge: string | null },
): string {
  if (!provider.authorizeUrl) throw new Error("provider_has_no_authorize_url");
  const url = new URL(provider.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  if (params.scopes.length > 0) url.searchParams.set("scope", params.scopes.join(" "));
  if (params.pkceChallenge) {
    url.searchParams.set("code_challenge", params.pkceChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }
  return url.toString();
}

// Validate a returned state against the stored hash (constant-work compare via
// hash equality). Also enforces expiry.
export function validateState(returnedState: string, storedStateHash: string, expiresAt: Date | string | null): boolean {
  if (!returnedState || !storedStateHash) return false;
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) return false;
  return sha256(returnedState) === storedStateHash;
}

// ── Token encryption (AES-256-GCM) ──────────────────────────────────────────
// The key comes from OAUTH_TOKEN_ENCRYPTION_KEY (64 hex chars = 32 bytes). We
// never store a plaintext token; only ciphertext + iv + auth tag.
export type EncryptedToken = { ciphertext: string; iv: string; authTag: string };

function getEncryptionKey(): Buffer | null {
  const raw = process.env["OAUTH_TOKEN_ENCRYPTION_KEY"];
  if (!raw || !/^[0-9a-fA-F]{64}$/.test(raw)) return null;
  return Buffer.from(raw, "hex");
}

export function encryptionAvailable(): boolean {
  return getEncryptionKey() !== null;
}

export function encryptToken(plaintext: string): EncryptedToken {
  const key = getEncryptionKey();
  if (!key) throw new Error("OAUTH_TOKEN_ENCRYPTION_KEY_missing_or_invalid");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptToken(token: EncryptedToken): string {
  const key = getEncryptionKey();
  if (!key) throw new Error("OAUTH_TOKEN_ENCRYPTION_KEY_missing_or_invalid");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(token.iv, "base64"));
  decipher.setAuthTag(Buffer.from(token.authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(token.ciphertext, "base64")), decipher.final()]).toString("utf8");
}
