import { Router } from "express";
import { requirePermission } from "../lib/auth.js";
import { CHANNELS, normalizeChannelKey } from "../lib/channels.js";
import { getChannelAdapter } from "../lib/channelAdapters/index.js";
import { createAuditLog } from "../lib/audit.js";
import { query } from "../lib/db.js";
import { channelConnectionSchema, validateBody, validateParams } from "../lib/validation.js";
import { idParamSchema } from "../lib/validation.js";

const router = Router();

// oauthEnabled/publishEnabled are overridden here from the live adapter
// registry -- CHANNELS itself only holds static defaults. This is the one
// place "is eBay publish actually ready right now" gets computed, so it's
// never out of sync with what routes/listings.ts will actually allow.
router.get("/channels", (_req, res) => {
  const channels = CHANNELS.map((channel) => {
    const adapter = getChannelAdapter(channel.key);
    if (!adapter) return channel;
    return {
      ...channel,
      oauthEnabled: adapter.capabilities.connect,
      publishEnabled: adapter.capabilities.createListing && adapter.isConfigured(),
    };
  });

  res.json({
    channels,
    providerCalls: false,
    publishEnabled: channels.some((c) => c.publishEnabled),
  });
});

router.get("/channel-connections", requirePermission("products:read"), async (req, res) => {
  try {
    const rows = await query(
      `SELECT id, user_id, channel, display_name, connection_status, scopes_requested, scopes_granted,
              token_storage_status, monitoring_only, publish_authorized, last_error, created_at, updated_at
       FROM channel_account_connections
       WHERE user_id IS NULL OR user_id = $1
       ORDER BY created_at DESC
       LIMIT 200`,
      [req.adminUser?.id ?? null],
    );
    res.json({
      connections: rows,
      providerCalls: false,
      publishEnabled: false,
    });
  } catch (err) {
    console.error("GET /channel-connections error:", err);
    res.status(500).json({ error: "Failed to load channel connection shells" });
  }
});

router.post("/channel-connections", requirePermission("products:write"), validateBody(channelConnectionSchema), async (req, res) => {
  try {
    const channel = normalizeChannelKey(req.body.channel);
    const scopesRequested = req.body.scopesRequested ?? ["listing_drafts", "listing_exports"];

    const rows = await query(
      `INSERT INTO channel_account_connections
        (user_id, channel, display_name, connection_status, scopes_requested, scopes_granted,
         token_storage_status, monitoring_only, publish_authorized, last_error)
       VALUES ($1,$2,$3,'AUTH_REQUIRED',$4::jsonb,'[]'::jsonb,'NOT_IMPLEMENTED',TRUE,FALSE,$5)
       RETURNING id, user_id, channel, display_name, connection_status, scopes_requested, scopes_granted,
                 token_storage_status, monitoring_only, publish_authorized, last_error, created_at, updated_at`,
      [
        req.adminUser?.id ?? null,
        channel,
        req.body.displayName ?? null,
        JSON.stringify(scopesRequested),
        "Provider OAuth credentials not configured",
      ],
    );

    const connection = rows[0];

    await createAuditLog({
      req,
      action: "channel_connection_shell_create",
      entityType: "channel_account_connection",
      entityId: connection?.id,
      after: {
        id: connection?.id,
        channel,
        connection_status: "AUTH_REQUIRED",
        monitoring_only: true,
        publish_authorized: false,
      },
    });

    res.status(201).json({
      connectionId: connection?.id,
      channel,
      connectionStatus: "AUTH_REQUIRED",
      monitoringOnly: true,
      publishAuthorized: false,
      oauthEnabled: false,
      reason: "Provider OAuth credentials not configured",
      tokenStorageStatus: "NOT_IMPLEMENTED",
      providerCalls: false,
      publishEnabled: false,
      connection,
    });
  } catch (err) {
    console.error("POST /channel-connections error:", err);
    res.status(500).json({ error: "Failed to create channel connection shell" });
  }
});

router.get("/channel-connections/:id/oauth/start", requirePermission("products:write"), validateParams(idParamSchema), (_req, res) => {
  res.status(409).json({
    oauthEnabled: false,
    connectionStatus: "AUTH_REQUIRED",
    reason: "Provider OAuth credentials not configured",
    providerCalls: false,
    publishEnabled: false,
  });
});

export default router;
