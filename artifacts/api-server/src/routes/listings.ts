import { Router } from "express";
import { requirePermission } from "../lib/auth.js";
import { createAuditLog } from "../lib/audit.js";
import { query } from "../lib/db.js";
import { generateListingWorkspace } from "../lib/listingWorkspace.js";
import { persistGeneratedListingWorkspace, persistUpdatedListingWorkspace } from "../lib/listingPackagePersistence.js";
import { idParamSchema, listingPackageSchema, validateBody, validateParams } from "../lib/validation.js";

const router = Router();

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

export default router;
