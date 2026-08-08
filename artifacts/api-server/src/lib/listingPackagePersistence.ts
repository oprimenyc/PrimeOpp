// Shared persistence for a generated listing workspace result.
//
// generateListingWorkspace() (lib/listingWorkspace.ts) is a pure function --
// it never touches the database. Both the standalone Listing Workspace route
// (routes/listings.ts, POST /listings/packages) and the Sourcing "List It"
// route (routes/sourcing.ts, POST .../create-listing) need to take that same
// generated result and persist it as a canonical_listing_package plus its
// channel drafts and exports. This module is the one place that does that
// insert, so the two routes cannot drift (previously the sourcing route
// persisted only the canonical row and silently dropped channelDrafts/
// exports -- this fixes that by sharing the exact same insert path).
import type pg from "pg";
import { transaction } from "./db.js";
import type { GeneratedListingWorkspace } from "./listingWorkspace.js";

export type PersistedListingPackage = {
  packageRow: Record<string, unknown> & { id: number | string };
  channelDrafts: Record<string, unknown>[];
  exports: Record<string, unknown>[];
};

export async function persistGeneratedListingWorkspace(
  generated: GeneratedListingWorkspace,
  // Runs inside the same transaction, after the package/drafts/exports are
  // inserted but before commit -- e.g. sourcing.ts uses this to mark the
  // originating sourcing_session_item LISTED atomically with the package
  // it now points to, instead of a second, non-atomic query after commit.
  onPersisted?: (client: pg.PoolClient, packageId: number | string) => Promise<void>,
): Promise<PersistedListingPackage> {
  return transaction(async (client: pg.PoolClient) => {
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

    const channelDrafts: Record<string, unknown>[] = [];
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

    const exports: Record<string, unknown>[] = [];
    for (const listingExport of generated.exports) {
      const exportRows = await client.query(
        `INSERT INTO listing_export_packages
          (canonical_listing_id, channel, export_format, export_payload)
         VALUES ($1,$2,$3,$4)
         RETURNING *`,
        [packageId, listingExport.channel, listingExport.export_format, JSON.stringify(listingExport.export_payload)],
      );
      exports.push(exportRows.rows[0]);
    }

    if (onPersisted) await onPersisted(client, packageId);

    return { packageRow: packageRows.rows[0], channelDrafts, exports };
  });
}
