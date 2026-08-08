import { Router } from "express";
import { requirePermission } from "../lib/auth.js";
import { createAuditLog } from "../lib/audit.js";
import { query } from "../lib/db.js";
import { generateListingWorkspace } from "../lib/listingWorkspace.js";
import { persistGeneratedListingWorkspace } from "../lib/listingPackagePersistence.js";
import { listingPackageSchema, validateBody } from "../lib/validation.js";

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

export default router;
