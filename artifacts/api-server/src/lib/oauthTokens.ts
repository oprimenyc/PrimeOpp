// oauthTokens.ts — resolves a currently-valid access token for a connected
// channel account, transparently refreshing via the provider's token
// endpoint when the stored access token has expired.
//
// This sits between lib/oauth.ts (the authorization handshake) and
// lib/channelPublish.ts (what a publish operation actually does with a
// token): oauth.ts creates the connection, this module keeps it usable, and
// channelPublish.ts consumes the result. A resolved access token is returned
// to the caller only for the duration of one provider call -- it is never
// logged, persisted in plaintext, or included in any error/audit payload.

import { query } from "./db.js";
import { decryptToken, encryptToken, getOAuthProvider } from "./oauth.js";

export type ConnectionTokenRow = {
  id: number;
  provider_key: string | null;
  access_token_ciphertext: string | null;
  access_token_iv: string | null;
  access_token_auth_tag: string | null;
  refresh_token_ciphertext: string | null;
  refresh_token_iv: string | null;
  refresh_token_auth_tag: string | null;
  token_expires_at: string | null;
};

export type ResolvedToken =
  | { ok: true; accessToken: string }
  | { ok: false; reason: "not_connected" | "expired_no_refresh_token" | "refresh_unsupported" | "provider_not_configured" | "refresh_network_error" | "refresh_failed" | "refresh_response_missing_token" };

const EXPIRY_SKEW_MS = 60_000;

export async function resolveAccessToken(connection: ConnectionTokenRow): Promise<ResolvedToken> {
  if (!connection.access_token_ciphertext || !connection.access_token_iv || !connection.access_token_auth_tag) {
    return { ok: false, reason: "not_connected" };
  }

  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : null;
  const isExpired = expiresAt !== null && expiresAt - EXPIRY_SKEW_MS <= Date.now();

  if (!isExpired) {
    return {
      ok: true,
      accessToken: decryptToken({
        ciphertext: connection.access_token_ciphertext,
        iv: connection.access_token_iv,
        authTag: connection.access_token_auth_tag,
      }),
    };
  }

  if (!connection.refresh_token_ciphertext || !connection.refresh_token_iv || !connection.refresh_token_auth_tag) {
    return { ok: false, reason: "expired_no_refresh_token" };
  }

  const provider = connection.provider_key ? getOAuthProvider(connection.provider_key) : undefined;
  if (!provider || !provider.supportsRefresh || !provider.tokenUrl) {
    return { ok: false, reason: "refresh_unsupported" };
  }

  const clientId = provider.clientIdEnv ? process.env[provider.clientIdEnv] : undefined;
  const clientSecret = provider.clientSecretEnv ? process.env[provider.clientSecretEnv] : undefined;
  if (!clientId || !clientSecret) {
    return { ok: false, reason: "provider_not_configured" };
  }

  const refreshToken = decryptToken({
    ciphertext: connection.refresh_token_ciphertext,
    iv: connection.refresh_token_iv,
    authTag: connection.refresh_token_auth_tag,
  });

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(provider.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
  } catch {
    return { ok: false, reason: "refresh_network_error" };
  }

  if (!tokenResponse.ok) {
    await query(
      `UPDATE channel_account_connections SET connection_health='EXPIRED', last_error='refresh_failed', updated_at=NOW() WHERE id=$1`,
      [connection.id],
    );
    return { ok: false, reason: "refresh_failed" };
  }

  const tokenJson = (await tokenResponse.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!tokenJson.access_token) return { ok: false, reason: "refresh_response_missing_token" };

  const accessEnc = encryptToken(tokenJson.access_token);
  const refreshEnc = tokenJson.refresh_token ? encryptToken(tokenJson.refresh_token) : null;
  const newExpiresAt = tokenJson.expires_in ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString() : null;

  await query(
    `UPDATE channel_account_connections
     SET access_token_ciphertext=$2, access_token_iv=$3, access_token_auth_tag=$4,
         refresh_token_ciphertext=COALESCE($5, refresh_token_ciphertext),
         refresh_token_iv=COALESCE($6, refresh_token_iv),
         refresh_token_auth_tag=COALESCE($7, refresh_token_auth_tag),
         token_expires_at=$8, connection_health='HEALTHY', last_health_check_at=NOW(), updated_at=NOW()
     WHERE id=$1`,
    [
      connection.id,
      accessEnc.ciphertext,
      accessEnc.iv,
      accessEnc.authTag,
      refreshEnc?.ciphertext ?? null,
      refreshEnc?.iv ?? null,
      refreshEnc?.authTag ?? null,
      newExpiresAt,
    ],
  );

  return { ok: true, accessToken: tokenJson.access_token };
}
