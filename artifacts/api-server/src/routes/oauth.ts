import { Router } from "express";
import { createHash } from "node:crypto";
import { requirePermission } from "../lib/auth.js";
import { createAuditLog } from "../lib/audit.js";
import { query } from "../lib/db.js";
import {
  buildAuthorizationUrl,
  encryptToken,
  generateAuthorizationHandshake,
  getOAuthProvider,
  oauthConfigStatus,
  OAUTH_PROVIDERS,
  validateState,
} from "../lib/oauth.js";
import { oauthStartSchema, validateBody } from "../lib/validation.js";

const router = Router();

const STATE_TTL_MS = 10 * 60 * 1000;

function providerPublicStatus() {
  return OAUTH_PROVIDERS.map((provider) => {
    const config = oauthConfigStatus(provider);
    return {
      key: provider.key,
      label: provider.label,
      supportsOAuth: provider.supportsOAuth,
      supportsPkce: provider.supportsPkce,
      supportsRefresh: provider.supportsRefresh,
      status: config.status,
      requiredEnv: config.status === "NOT_CONFIGURED" ? config.missingEnv : [],
      monitoringOnly: true,
      publishAuthorized: false,
    };
  });
}

// Public-safe: OAuth provider registry + honest configuration status.
router.get("/oauth/providers", (_req, res) => {
  res.json({
    providers: providerPublicStatus(),
    publishEnabled: false,
    externalPublish: "DISABLED",
  });
});

// Begin an OAuth authorization for a seller-owned account. Creates/refreshes a
// connection shell, generates a single-use state (+ PKCE where supported),
// persists only their hashes, and returns an authorization URL. When the
// provider's credentials are absent it returns NOT_CONFIGURED with the exact
// required env var names and never fabricates a connection.
router.post("/oauth/:provider/start", requirePermission("products:write"), validateBody(oauthStartSchema), async (req, res) => {
  const providerKey = String(req.params.provider);
  const provider = getOAuthProvider(providerKey);

  if (!provider) {
    res.status(404).json({ oauthEnabled: false, status: "UNKNOWN_PROVIDER", publishEnabled: false });
    return;
  }

  const config = oauthConfigStatus(provider);
  if (config.status === "UNSUPPORTED") {
    res.status(409).json({
      provider: provider.key,
      oauthEnabled: false,
      status: "UNSUPPORTED",
      reason: "This provider does not expose a documented seller-owned OAuth flow we can safely target.",
      publishEnabled: false,
    });
    return;
  }

  if (config.status === "NOT_CONFIGURED") {
    res.status(409).json({
      provider: provider.key,
      oauthEnabled: false,
      status: "NOT_CONFIGURED",
      requiredEnv: config.missingEnv,
      reason: "OAuth credentials not configured. Set the required environment variables to enable the flow.",
      monitoringOnly: true,
      publishAuthorized: false,
      publishEnabled: false,
    });
    return;
  }

  // READY: build the real authorization handshake. (Reached only when all
  // required env vars — including the redirect base and encryption key — exist.)
  try {
    const handshake = generateAuthorizationHandshake(provider);
    const redirectUri = `${process.env["OAUTH_REDIRECT_BASE_URL"]}/api/oauth/${provider.key}/callback`;
    const scopes = req.body.scopes ?? provider.defaultScopes;
    const expiresAt = new Date(Date.now() + STATE_TTL_MS).toISOString();

    const rows = await query<{ id: number }>(
      `INSERT INTO channel_account_connections
        (user_id, channel, provider_key, display_name, connection_status, scopes_requested, scopes_granted,
         token_storage_status, monitoring_only, publish_authorized,
         oauth_state_hash, pkce_verifier_hash, oauth_state_expires_at, redirect_uri, connection_health)
       VALUES ($1,$2,$3,$4,'AUTH_REQUIRED',$5::jsonb,'[]'::jsonb,'ENCRYPTED',TRUE,FALSE,$6,$7,$8,$9,'NOT_CONNECTED')
       RETURNING id`,
      [
        req.adminUser?.id ?? null,
        provider.key,
        provider.key,
        req.body.displayName ?? null,
        JSON.stringify(scopes),
        handshake.stateHash,
        handshake.pkceVerifierHash,
        expiresAt,
        redirectUri,
      ],
    );

    const authorizationUrl = buildAuthorizationUrl(provider, {
      clientId: process.env[provider.clientIdEnv as string] as string,
      redirectUri,
      state: handshake.state,
      scopes,
      pkceChallenge: handshake.pkceChallenge,
    });

    await createAuditLog({
      req,
      action: "oauth_start",
      entityType: "channel_account_connection",
      entityId: rows[0]?.id,
      after: { provider: provider.key, connection_status: "AUTH_REQUIRED", monitoring_only: true, publish_authorized: false },
    });

    res.status(200).json({
      provider: provider.key,
      connectionId: rows[0]?.id,
      oauthEnabled: true,
      status: "READY",
      authorizationUrl,
      monitoringOnly: true,
      publishAuthorized: false,
      publishEnabled: false,
    });
  } catch (err) {
    console.error("POST /oauth/:provider/start error:", err);
    res.status(500).json({ oauthEnabled: false, status: "FAILED", publishEnabled: false });
  }
});

// OAuth redirect callback. Validates the returned state against the stored
// single-use hash, then (only when configured) exchanges the code and stores
// ENCRYPTED tokens. Connections stay monitoring-only and publish-unauthorized.
router.get("/oauth/:provider/callback", async (req, res) => {
  const providerKey = String(req.params.provider);
  const provider = getOAuthProvider(providerKey);
  if (!provider) {
    res.status(404).json({ status: "UNKNOWN_PROVIDER", publishEnabled: false });
    return;
  }

  const config = oauthConfigStatus(provider);
  if (config.status !== "READY") {
    res.status(409).json({
      provider: provider.key,
      status: config.status,
      requiredEnv: config.status === "NOT_CONFIGURED" ? config.missingEnv : [],
      reason: "OAuth is not configured for this provider; no token exchange was attempted.",
      publishEnabled: false,
    });
    return;
  }

  const state = typeof req.query.state === "string" ? req.query.state : "";
  const code = typeof req.query.code === "string" ? req.query.code : "";

  try {
    const rows = await query<{ id: number; oauth_state_hash: string; oauth_state_expires_at: string }>(
      `SELECT id, oauth_state_hash, oauth_state_expires_at
       FROM channel_account_connections
       WHERE provider_key = $1 AND oauth_state_hash = $2
       ORDER BY created_at DESC LIMIT 1`,
      [provider.key, createHash("sha256").update(state).digest("hex")],
    );
    const connection = rows[0];

    if (!connection || !validateState(state, connection.oauth_state_hash, connection.oauth_state_expires_at)) {
      res.status(400).json({ provider: provider.key, status: "STATE_INVALID", publishEnabled: false });
      return;
    }

    if (!code) {
      res.status(400).json({ provider: provider.key, status: "MISSING_CODE", publishEnabled: false });
      return;
    }

    // Live token exchange (reached only when fully configured). Tokens are
    // encrypted with AES-256-GCM before storage; plaintext is never persisted
    // or logged.
    const tokenResponse = await fetch(provider.tokenUrl as string, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${process.env["OAUTH_REDIRECT_BASE_URL"]}/api/oauth/${provider.key}/callback`,
        client_id: process.env[provider.clientIdEnv as string] as string,
        client_secret: process.env[provider.clientSecretEnv as string] as string,
      }),
    });

    if (!tokenResponse.ok) {
      await query(
        `UPDATE channel_account_connections
         SET connection_status='ERROR', connection_health='ERROR', last_error='token_exchange_failed',
             oauth_state_hash=NULL, pkce_verifier_hash=NULL, updated_at=NOW()
         WHERE id=$1`,
        [connection.id],
      );
      res.status(502).json({ provider: provider.key, status: "TOKEN_EXCHANGE_FAILED", publishEnabled: false });
      return;
    }

    const tokenJson = (await tokenResponse.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
    const accessEnc = tokenJson.access_token ? encryptToken(tokenJson.access_token) : null;
    const refreshEnc = tokenJson.refresh_token ? encryptToken(tokenJson.refresh_token) : null;
    const tokenExpiresAt = tokenJson.expires_in ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString() : null;

    await query(
      `UPDATE channel_account_connections
       SET connection_status='CONNECTED_MONITORING_ONLY', connection_health='HEALTHY',
           token_storage_status='ENCRYPTED', monitoring_only=TRUE, publish_authorized=FALSE,
           access_token_ciphertext=$2, access_token_iv=$3, access_token_auth_tag=$4,
           refresh_token_ciphertext=$5, refresh_token_iv=$6, refresh_token_auth_tag=$7,
           token_expires_at=$8, last_health_check_at=NOW(),
           oauth_state_hash=NULL, pkce_verifier_hash=NULL, updated_at=NOW()
       WHERE id=$1`,
      [
        connection.id,
        accessEnc?.ciphertext ?? null,
        accessEnc?.iv ?? null,
        accessEnc?.authTag ?? null,
        refreshEnc?.ciphertext ?? null,
        refreshEnc?.iv ?? null,
        refreshEnc?.authTag ?? null,
        tokenExpiresAt,
      ],
    );

    await createAuditLog({
      req,
      action: "oauth_callback_connected",
      entityType: "channel_account_connection",
      entityId: connection.id,
      after: { provider: provider.key, connection_status: "CONNECTED_MONITORING_ONLY", monitoring_only: true, publish_authorized: false },
    });

    res.status(200).json({
      provider: provider.key,
      connectionId: connection.id,
      status: "CONNECTED_MONITORING_ONLY",
      monitoringOnly: true,
      publishAuthorized: false,
      publishEnabled: false,
      externalPublish: "DISABLED",
    });
  } catch (err) {
    console.error("GET /oauth/:provider/callback error:", err);
    res.status(500).json({ provider: provider.key, status: "FAILED", publishEnabled: false });
  }
});

// Disconnect / revoke: clears stored encrypted tokens and marks the connection
// revoked. Does not call the provider unless a revoke endpoint is configured.
router.post("/oauth/connections/:id/disconnect", requirePermission("products:write"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "invalid_id" });
    return;
  }
  try {
    await query(
      `UPDATE channel_account_connections
       SET connection_status='NOT_CONNECTED', connection_health='REVOKED',
           token_storage_status='NOT_STORED', monitoring_only=TRUE, publish_authorized=FALSE,
           access_token_ciphertext=NULL, access_token_iv=NULL, access_token_auth_tag=NULL,
           refresh_token_ciphertext=NULL, refresh_token_iv=NULL, refresh_token_auth_tag=NULL,
           token_expires_at=NULL, oauth_state_hash=NULL, pkce_verifier_hash=NULL, updated_at=NOW()
       WHERE id=$1`,
      [id],
    );
    await createAuditLog({ req, action: "oauth_disconnect", entityType: "channel_account_connection", entityId: id, after: { connection_status: "NOT_CONNECTED", publish_authorized: false } });
    res.json({ connectionId: id, status: "NOT_CONNECTED", publishAuthorized: false, publishEnabled: false });
  } catch (err) {
    console.error("POST /oauth/connections/:id/disconnect error:", err);
    res.status(500).json({ error: "disconnect_failed" });
  }
});

export default router;
