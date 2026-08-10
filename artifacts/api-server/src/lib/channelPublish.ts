// channelPublish.ts — orchestrates a publish/update/end/sync operation
// against a channel adapter with deterministic idempotency, a persisted
// attempt log, and honest state transitions.
//
// This is the ONLY place that writes channel_status/external_listing_id/etc.
// on channel_listing_drafts for real external operations -- routes never
// touch those columns directly. Every external call goes through here so the
// idempotency and "never claim LIVE without confirmation" rules can't be
// bypassed by a route that forgot to apply them.

import { createHash } from "node:crypto";
import { query } from "./db.js";
import { getChannelAdapter } from "./channelAdapters/index.js";
import { resolveAccessToken, type ConnectionTokenRow } from "./oauthTokens.js";
import type { CanonicalListingPackageRow, PreflightResult } from "./channelAdapter.js";

export type ChannelListingDraftRow = {
  id: number;
  canonical_listing_id: number;
  channel: string;
  channel_status: string;
  channel_payload: Record<string, unknown>;
  external_listing_id: string | null;
  external_offer_id: string | null;
};

export type ConnectionRow = ConnectionTokenRow & {
  connection_status: string;
  publish_authorized: boolean;
};

export type PublishOutcome =
  | { ok: true; status: "LIVE" | "SUBMITTING" | "ENDED"; externalListingId: string | null; externalOfferId: string | null; reused: boolean }
  | { ok: false; reason: string; issues?: PreflightResult["issues"] };

const CONNECTED_STATUSES = new Set(["CONNECTED_MONITORING_ONLY", "CONNECTED_DRAFTS_ONLY"]);

// Deterministic per (draft, operation, content-of-what's-being-sent). A
// client retry of the exact same request reuses the same key -- an
// idempotent no-op/reconcile. An operator's intentional edit changes the
// payload salt, producing a genuinely new key -- a real new attempt.
function deriveIdempotencyKey(draftId: number, operation: string, salt: string): string {
  return createHash("sha256").update(`${draftId}:${operation}:${salt}`).digest("hex").slice(0, 40);
}

function payloadSalt(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

async function reconcileExistingAttempt(
  draftId: number,
  idempotencyKey: string,
): Promise<{ attempt_status: string; external_listing_id: string | null; external_offer_id: string | null } | null> {
  const rows = await query<{ attempt_status: string; external_listing_id: string | null; external_offer_id: string | null }>(
    `SELECT attempt_status, external_listing_id, external_offer_id
     FROM channel_publish_attempts WHERE channel_listing_draft_id=$1 AND idempotency_key=$2`,
    [draftId, idempotencyKey],
  );
  return rows[0] ?? null;
}

async function insertPendingAttempt(
  draftId: number,
  channel: string,
  operation: "CREATE" | "UPDATE" | "END" | "SYNC",
  idempotencyKey: string,
): Promise<number | null> {
  try {
    const rows = await query<{ id: number }>(
      `INSERT INTO channel_publish_attempts (channel_listing_draft_id, channel, operation, idempotency_key, attempt_status)
       VALUES ($1,$2,$3,$4,'PENDING') RETURNING id`,
      [draftId, channel, operation, idempotencyKey],
    );
    return rows[0]?.id ?? null;
  } catch {
    // Unique (draft_id, idempotency_key) violation -- a concurrent request
    // for this exact key is already in flight (or already ran). Never
    // proceed to a second provider call for the same key.
    return null;
  }
}

export async function publishToChannel(
  draft: ChannelListingDraftRow,
  listingPackage: CanonicalListingPackageRow,
  connection: ConnectionRow | null,
  operation: "CREATE" | "UPDATE",
): Promise<PublishOutcome> {
  const adapter = getChannelAdapter(draft.channel);
  if (!adapter || !adapter.capabilities.createListing || !adapter.createListing) {
    return { ok: false, reason: "channel_has_no_publish_adapter" };
  }
  if (!adapter.isConfigured()) {
    return { ok: false, reason: "provider_not_configured" };
  }

  const preflight = adapter.preflight({ listingPackage, draft: { channel_payload: draft.channel_payload } });
  if (!preflight.canPublish) {
    return { ok: false, reason: "preflight_failed", issues: preflight.issues };
  }

  if (!connection || !CONNECTED_STATUSES.has(connection.connection_status)) {
    return { ok: false, reason: "account_not_connected" };
  }
  if (!connection.publish_authorized) {
    return { ok: false, reason: "publish_not_authorized" };
  }

  const tokenResult = await resolveAccessToken(connection);
  if (!tokenResult.ok) {
    return { ok: false, reason: `token_${tokenResult.reason}` };
  }

  const idempotencyKey = deriveIdempotencyKey(draft.id, operation, payloadSalt(draft.channel_payload));

  const existing = await reconcileExistingAttempt(draft.id, idempotencyKey);
  if (existing?.attempt_status === "SUCCESS") {
    return {
      ok: true,
      status: draft.channel_status === "LIVE" ? "LIVE" : "SUBMITTING",
      externalListingId: existing.external_listing_id,
      externalOfferId: existing.external_offer_id,
      reused: true,
    };
  }

  const attemptId = await insertPendingAttempt(draft.id, draft.channel, operation, idempotencyKey);
  if (attemptId === null) {
    return { ok: false, reason: "attempt_in_flight" };
  }

  await query(
    `UPDATE channel_listing_drafts SET channel_status='SUBMITTING', last_publish_attempt_at=NOW(), account_connection_ref_id=$2 WHERE id=$1`,
    [draft.id, connection.id],
  );

  const adapterFn = operation === "CREATE" ? adapter.createListing : (adapter.updateListing ?? adapter.createListing);
  const result = await adapterFn({
    listingPackage,
    draft: { id: draft.id, channel_payload: draft.channel_payload, external_listing_id: draft.external_listing_id, external_offer_id: draft.external_offer_id },
    accessToken: tokenResult.accessToken,
    idempotencyKey,
  });

  const attemptStatus = result.status === "LIVE" ? "SUCCESS" : result.status === "FAILED" ? "FAILED" : "PENDING";
  await query(
    `UPDATE channel_publish_attempts
     SET attempt_status=$2, external_listing_id=$3, external_offer_id=$4, error_code=$5, error_message=$6,
         completed_at=CASE WHEN $2='PENDING' THEN NULL ELSE NOW() END
     WHERE id=$1`,
    [attemptId, attemptStatus, result.externalListingId, result.externalOfferId, result.errorCode, result.errorMessage],
  );

  await query(
    `UPDATE channel_listing_drafts
     SET channel_status=$2,
         external_listing_id=COALESCE($3, external_listing_id),
         external_offer_id=COALESCE($4, external_offer_id),
         external_status=$5, last_synced_at=NOW(), last_publish_error=$6
     WHERE id=$1`,
    [draft.id, result.status, result.externalListingId, result.externalOfferId, result.externalStatus, result.errorMessage],
  );

  if (result.status === "FAILED") {
    return { ok: false, reason: result.errorCode ?? "publish_failed" };
  }

  return { ok: true, status: result.status, externalListingId: result.externalListingId, externalOfferId: result.externalOfferId, reused: false };
}

export async function endChannelListing(draft: ChannelListingDraftRow, connection: ConnectionRow | null): Promise<PublishOutcome> {
  const adapter = getChannelAdapter(draft.channel);
  if (!adapter || !adapter.capabilities.endListing || !adapter.endListing) {
    return { ok: false, reason: "channel_has_no_end_adapter" };
  }
  if (!draft.external_listing_id) {
    return { ok: false, reason: "not_listed" };
  }
  if (!connection || !CONNECTED_STATUSES.has(connection.connection_status)) {
    return { ok: false, reason: "account_not_connected" };
  }
  if (!connection.publish_authorized) {
    return { ok: false, reason: "publish_not_authorized" };
  }

  const tokenResult = await resolveAccessToken(connection);
  if (!tokenResult.ok) return { ok: false, reason: `token_${tokenResult.reason}` };

  const idempotencyKey = deriveIdempotencyKey(draft.id, "END", draft.external_listing_id);

  const existing = await reconcileExistingAttempt(draft.id, idempotencyKey);
  if (existing?.attempt_status === "SUCCESS") {
    return { ok: true, status: "ENDED", externalListingId: draft.external_listing_id, externalOfferId: draft.external_offer_id, reused: true };
  }

  const attemptId = await insertPendingAttempt(draft.id, draft.channel, "END", idempotencyKey);
  if (attemptId === null) {
    return { ok: false, reason: "attempt_in_flight" };
  }

  const result = await adapter.endListing({
    externalListingId: draft.external_listing_id,
    externalOfferId: draft.external_offer_id,
    accessToken: tokenResult.accessToken,
    idempotencyKey,
  });

  const success = result.errorCode === null;
  await query(
    `UPDATE channel_publish_attempts SET attempt_status=$2, error_code=$3, error_message=$4, completed_at=NOW() WHERE id=$1`,
    [attemptId, success ? "SUCCESS" : "FAILED", result.errorCode, result.errorMessage],
  );

  if (!success) {
    await query(`UPDATE channel_listing_drafts SET last_publish_error=$2, last_synced_at=NOW() WHERE id=$1`, [draft.id, result.errorMessage]);
    return { ok: false, reason: result.errorCode ?? "end_failed" };
  }

  await query(
    `UPDATE channel_listing_drafts SET channel_status='ENDED', external_status='ENDED', last_synced_at=NOW(), last_publish_error=NULL WHERE id=$1`,
    [draft.id],
  );
  return { ok: true, status: "ENDED", externalListingId: draft.external_listing_id, externalOfferId: draft.external_offer_id, reused: false };
}

export async function syncChannelListingStatus(
  draft: ChannelListingDraftRow,
  connection: ConnectionRow | null,
): Promise<{ ok: true; externalStatus: string | null } | { ok: false; reason: string }> {
  const adapter = getChannelAdapter(draft.channel);
  if (!adapter || !adapter.capabilities.syncStatus || !adapter.retrieveListing) {
    return { ok: false, reason: "channel_has_no_sync_adapter" };
  }
  if (!draft.external_offer_id) return { ok: false, reason: "not_listed" };
  if (!connection || !CONNECTED_STATUSES.has(connection.connection_status)) {
    return { ok: false, reason: "account_not_connected" };
  }

  const tokenResult = await resolveAccessToken(connection);
  if (!tokenResult.ok) return { ok: false, reason: `token_${tokenResult.reason}` };

  const result = await adapter.retrieveListing({
    externalListingId: draft.external_listing_id ?? "",
    externalOfferId: draft.external_offer_id,
    accessToken: tokenResult.accessToken,
  });

  if (!result.found) {
    return { ok: false, reason: "not_found_on_provider" };
  }

  await query(`UPDATE channel_listing_drafts SET external_status=$2, last_synced_at=NOW() WHERE id=$1`, [draft.id, result.externalStatus]);
  return { ok: true, externalStatus: result.externalStatus };
}
