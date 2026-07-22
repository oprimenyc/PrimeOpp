import { Router } from "express";
import { requirePermission } from "../lib/auth.js";
import { createAuditLog } from "../lib/audit.js";
import { transaction, query } from "../lib/db.js";
import { generateListingWorkspace } from "../lib/listingWorkspace.js";
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

    const result = await transaction(async (client) => {
      const packageRows = await client.query(
        `INSERT INTO canonical_listing_packages
          (product_id, source_identifier, identifier_type, intake_source, title, description, images,
           category, condition, size_variant, cost_basis, target_price, margin, shipping_profile, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING *`,
        [
          generated.canonical.product_id,
          generated.canonical.source_identifier,
          generated.canonical.identifier_type,
          generated.canonical.intake_source,
          generated.canonical.title,
          generated.canonical.description,
          JSON.stringify(generated.canonical.images),
          generated.canonical.category,
          generated.canonical.condition,
          generated.canonical.size_variant,
          generated.canonical.cost_basis,
          generated.canonical.target_price,
          generated.canonical.margin,
          generated.canonical.shipping_profile,
          generated.canonical.status,
        ],
      );

      const packageId = packageRows.rows[0]?.id;
      if (!packageId) throw new Error("canonical_listing_package_not_created");

      const channelDrafts = [];
      for (const draft of generated.channelDrafts) {
        const draftRows = await client.query(
          `INSERT INTO channel_listing_drafts
            (canonical_listing_id, channel, account_connection_id, channel_status, channel_payload,
             last_validation_error, publish_disabled_reason)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           RETURNING *`,
          [
            packageId,
            draft.channel,
            draft.account_connection_id,
            draft.channel_status,
            JSON.stringify(draft.channel_payload),
            draft.last_validation_error,
            draft.publish_disabled_reason,
          ],
        );
        channelDrafts.push(draftRows.rows[0]);
      }

      const exports = [];
      for (const listingExport of generated.exports) {
        const exportRows = await client.query(
          `INSERT INTO listing_export_packages
            (canonical_listing_id, channel, export_format, export_payload)
           VALUES ($1,$2,$3,$4)
           RETURNING *`,
          [
            packageId,
            listingExport.channel,
            listingExport.export_format,
            JSON.stringify(listingExport.export_payload),
          ],
        );
        exports.push(exportRows.rows[0]);
      }

      return {
        packageRow: packageRows.rows[0],
        channelDrafts,
        exports,
      };
    });

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
