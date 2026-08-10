import { Router } from "express";
import { requirePermission } from "../lib/auth.js";
import { createAuditLog } from "../lib/audit.js";
import { query } from "../lib/db.js";
import { generateListingWorkspace } from "../lib/listingWorkspace.js";
import { persistGeneratedListingWorkspace, persistUpdatedListingWorkspace } from "../lib/listingPackagePersistence.js";
import { idParamSchema, listingPackageSchema, validateBody, validateParams } from "../lib/validation.js";
import { getChannelAdapter } from "../lib/channelAdapters/index.js";
import { publishToChannel, endChannelListing, syncChannelListingStatus, type ChannelListingDraftRow, type ConnectionRow } from "../lib/channelPublish.js";
import type { CanonicalListingPackageRow } from "../lib/channelAdapter.js";

const router = Router();

const CHANNEL_PARAM_RE = /^[a-z0-9][a-z0-9-]*$/;

async function loadPackage(id: number): Promise<CanonicalListingPackageRow | null> {
  const rows = await query<CanonicalListingPackageRow>("SELECT * FROM canonical_listing_packages WHERE id=$1", [id]);
  return rows[0] ?? null;
}

async function loadDraft(packageId: number, channel: string): Promise<ChannelListingDraftRow | null> {
  const rows = await query<ChannelListingDraftRow>(
    "SELECT * FROM channel_listing_drafts WHERE canonical_listing_id=$1 AND channel=$2",
    [packageId, channel],
  );
  return rows[0] ?? null;
}

// One eBay (etc.) seller account is the common case -- the most recently
// created connection for this channel's provider is used. A connection is
// only usable here once it's CONNECTED (real tokens exchanged) AND an
// operator has separately flipped publish_authorized via
// POST /oauth/connections/:id/authorize-publish -- connecting an account is
// not, by itself, permission to publish.
async function loadConnectionForChannel(channel: string): Promise<ConnectionRow | null> {
  const rows = await query<ConnectionRow>(
    `SELECT id, provider_key, connection_status, publish_authorized,
            access_token_ciphertext, access_token_iv, access_token_auth_tag,
            refresh_token_ciphertext, refresh_token_iv, refresh_token_auth_tag, token_expires_at
     FROM channel_account_connections
     WHERE provider_key=$1
     ORDER BY created_at DESC LIMIT 1`,
    [channel],
  );
  return rows[0] ?? null;
}

router.get("/listings/account-connections", requirePermission("products:read"), async (_req, res) => {
  try {
    const rows = await query(
      `SELECT id, owner_scope, channel, connection_status, monitoring_only, publish_authorized, created_at, updated_at
       FROM marketplace_account_connections
       ORDER BY created_at DESC
       LIMIT 200`,
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /listings/account-connections error:", err);
    res.status(500).json({ error: "Failed to load account connections" });
  }
});

router.post("/listings/packages", requirePermission("products:write"), validateBody(listingPackageSchema), async (req, res) => {
  try {
    const generated = generateListingWorkspace(req.body);
    const result = await persistGeneratedListingWorkspace(generated);

    await createAuditLog({
      req,
      action: "listing_package_create",
      entityType: "canonical_listing_package",
      entityId: result.packageRow.id,
      after: {
        id: result.packageRow.id,
        channel_count: result.channelDrafts.length,
        export_count: result.exports.length,
        external_publish_enabled: generated.externalPublishEnabled,
      },
    });

    res.status(201).json({
      canonicalListingPackageId: result.packageRow.id,
      canonicalListingPackage: result.packageRow,
      channelDrafts: result.channelDrafts,
      exports: result.exports,
      externalPublishEnabled: generated.externalPublishEnabled,
      approvalRequired: generated.approvalRequired,
      liabilityMode: generated.liabilityMode,
    });
  } catch (err) {
    console.error("POST /listings/packages error:", err);
    res.status(500).json({ error: "Failed to create listing package" });
  }
});

// Updates an EXISTING canonical listing package in place -- the counterpart
// to POST above. Without this, Listing Workspace had no way to save an edit
// to a package it already opened (e.g. from a Sourcing BUY -> LIST handoff)
// without creating a second, disconnected package while
// sourcing_session_items.canonical_listing_package_id kept pointing at the
// original. Uses the exact same generateListingWorkspace() the create route
// uses -- no second generation/pricing logic -- just persisted as an update.
router.put("/listings/packages/:id", requirePermission("products:write"), validateParams(idParamSchema), validateBody(listingPackageSchema), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const generated = generateListingWorkspace(req.body);
    const result = await persistUpdatedListingWorkspace(id, generated);

    if (!result) {
      res.status(404).json({ error: "listing_package_not_found" });
      return;
    }

    await createAuditLog({
      req,
      action: "listing_package_update",
      entityType: "canonical_listing_package",
      entityId: id,
      after: {
        id,
        channel_count: result.channelDrafts.length,
        export_count: result.exports.length,
        external_publish_enabled: generated.externalPublishEnabled,
      },
    });

    res.json({
      canonicalListingPackageId: result.packageRow.id,
      canonicalListingPackage: result.packageRow,
      channelDrafts: result.channelDrafts,
      exports: result.exports,
      externalPublishEnabled: generated.externalPublishEnabled,
      approvalRequired: generated.approvalRequired,
      liabilityMode: generated.liabilityMode,
    });
  } catch (err) {
    console.error("PUT /listings/packages/:id error:", err);
    res.status(500).json({ error: "Failed to update listing package" });
  }
});

// CAN THIS LISTING BE PUBLISHED TO {channel}? Deterministic, no network call,
// no side effects -- safe to poll from the UI as the operator fills in
// required fields (Phase 5's preflight requirement).
router.get(
  "/listings/packages/:id/channels/:channel/preflight",
  requirePermission("products:read"),
  validateParams(idParamSchema),
  async (req, res) => {
    const channel = String(req.params.channel);
    if (!CHANNEL_PARAM_RE.test(channel)) {
      res.status(400).json({ error: "invalid_channel" });
      return;
    }
    const adapter = getChannelAdapter(channel);
    if (!adapter) {
      res.json({ channel, hasAdapter: false, canPublish: false, issues: [{ field: "channel", code: "NO_ADAPTER", message: `${channel} has no publish adapter -- drafts/exports only.` }] });
      return;
    }

    const listingPackage = await loadPackage(Number(req.params.id));
    if (!listingPackage) {
      res.status(404).json({ error: "listing_package_not_found" });
      return;
    }
    const draft = await loadDraft(listingPackage.id as number, channel);
    if (!draft) {
      res.status(404).json({ error: "channel_draft_not_found", reason: `"${channel}" is not one of this package's selected channels.` });
      return;
    }

    const result = adapter.preflight({ listingPackage, draft: { channel_payload: draft.channel_payload } });
    res.json({ channel, hasAdapter: true, configured: adapter.isConfigured(), ...result });
  },
);

// PUBLISH (create or, if already listed, update-in-place). Never returns
// LIVE unless the provider actually confirmed it -- see channelPublish.ts.
router.post(
  "/listings/packages/:id/channels/:channel/publish",
  requirePermission("products:write"),
  validateParams(idParamSchema),
  async (req, res) => {
    const channel = String(req.params.channel);
    if (!CHANNEL_PARAM_RE.test(channel)) {
      res.status(400).json({ error: "invalid_channel" });
      return;
    }

    try {
      const listingPackage = await loadPackage(Number(req.params.id));
      if (!listingPackage) {
        res.status(404).json({ error: "listing_package_not_found" });
        return;
      }
      const draft = await loadDraft(listingPackage.id as number, channel);
      if (!draft) {
        res.status(404).json({ error: "channel_draft_not_found", reason: `"${channel}" is not one of this package's selected channels.` });
        return;
      }

      const connection = await loadConnectionForChannel(channel);
      const operation = draft.external_listing_id ? "UPDATE" : "CREATE";
      const outcome = await publishToChannel(draft, listingPackage, connection, operation);

      await createAuditLog({
        req,
        action: `channel_publish_${operation.toLowerCase()}`,
        entityType: "channel_listing_draft",
        entityId: draft.id,
        after: outcome.ok
          ? { channel, status: outcome.status, externalListingId: outcome.externalListingId, reused: outcome.reused }
          : { channel, failed: true, reason: outcome.reason },
      });

      if (!outcome.ok) {
        const status = outcome.reason === "preflight_failed" ? 422 : outcome.reason === "attempt_in_flight" ? 409 : 409;
        res.status(status).json({ channel, ...outcome });
        return;
      }

      res.status(outcome.status === "LIVE" ? 200 : 202).json({ channel, ...outcome });
    } catch (err) {
      console.error("POST /listings/packages/:id/channels/:channel/publish error:", err);
      res.status(500).json({ error: "publish_failed" });
    }
  },
);

// END a live (or submitting) external listing. Idempotent -- ending an
// already-ended listing reuses the recorded ENDED result rather than
// re-calling the provider.
router.post(
  "/listings/packages/:id/channels/:channel/end",
  requirePermission("products:write"),
  validateParams(idParamSchema),
  async (req, res) => {
    const channel = String(req.params.channel);
    if (!CHANNEL_PARAM_RE.test(channel)) {
      res.status(400).json({ error: "invalid_channel" });
      return;
    }

    try {
      const listingPackage = await loadPackage(Number(req.params.id));
      if (!listingPackage) {
        res.status(404).json({ error: "listing_package_not_found" });
        return;
      }
      const draft = await loadDraft(listingPackage.id as number, channel);
      if (!draft) {
        res.status(404).json({ error: "channel_draft_not_found" });
        return;
      }

      const connection = await loadConnectionForChannel(channel);
      const outcome = await endChannelListing(draft, connection);

      await createAuditLog({
        req,
        action: "channel_publish_end",
        entityType: "channel_listing_draft",
        entityId: draft.id,
        after: outcome.ok ? { channel, status: outcome.status } : { channel, failed: true, reason: outcome.reason },
      });

      if (!outcome.ok) {
        res.status(409).json({ channel, ...outcome });
        return;
      }
      res.json({ channel, ...outcome });
    } catch (err) {
      console.error("POST /listings/packages/:id/channels/:channel/end error:", err);
      res.status(500).json({ error: "end_failed" });
    }
  },
);

// SYNC pulls the provider's current status for a listing that's already
// been published -- read-only, does not itself publish/end anything.
router.post(
  "/listings/packages/:id/channels/:channel/sync",
  requirePermission("products:read"),
  validateParams(idParamSchema),
  async (req, res) => {
    const channel = String(req.params.channel);
    if (!CHANNEL_PARAM_RE.test(channel)) {
      res.status(400).json({ error: "invalid_channel" });
      return;
    }

    try {
      const listingPackage = await loadPackage(Number(req.params.id));
      if (!listingPackage) {
        res.status(404).json({ error: "listing_package_not_found" });
        return;
      }
      const draft = await loadDraft(listingPackage.id as number, channel);
      if (!draft) {
        res.status(404).json({ error: "channel_draft_not_found" });
        return;
      }

      const connection = await loadConnectionForChannel(channel);
      const result = await syncChannelListingStatus(draft, connection);
      if (!result.ok) {
        res.status(409).json({ channel, ok: false, reason: result.reason });
        return;
      }
      res.json({ channel, ok: true, externalStatus: result.externalStatus });
    } catch (err) {
      console.error("POST /listings/packages/:id/channels/:channel/sync error:", err);
      res.status(500).json({ error: "sync_failed" });
    }
  },
);

// The CHANNEL / STATUS / EXTERNAL ID / LAST SYNC / ERROR table view for
// Listing Workspace -- one row per selected channel for this package.
router.get(
  "/listings/packages/:id/channels",
  requirePermission("products:read"),
  validateParams(idParamSchema),
  async (req, res) => {
    const rows = await query(
      `SELECT channel, channel_status, external_listing_id, external_offer_id, external_status,
              last_publish_attempt_at, last_synced_at, last_publish_error
       FROM channel_listing_drafts WHERE canonical_listing_id=$1 ORDER BY channel`,
      [Number(req.params.id)],
    );
    res.json({ channels: rows });
  },
);

export default router;
