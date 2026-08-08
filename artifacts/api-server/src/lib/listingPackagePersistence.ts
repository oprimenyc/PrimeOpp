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

// Shared by both create and update: (re)inserts a generated workspace's
// channel drafts and exports for a given canonical package id. The update
// path deletes the previous rows first (see persistUpdatedListingWorkspace)
// so this always starts from a clean slate -- channel drafts/exports never
// drift out of sync with whatever channels the latest save actually
// selected, and there is exactly one insert implementation for both paths.
async function insertChannelDraftsAndExports(
  client: pg.PoolClient,
  packageId: number | string,
  generated: GeneratedListingWorkspace,
): Promise<{ channelDrafts: Record<string, unknown>[]; exports: Record<string, unknown>[] }> {
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

  return { channelDrafts, exports };
}

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

    const { channelDrafts, exports } = await insertChannelDraftsAndExports(client, packageId, generated);

    if (onPersisted) await onPersisted(client, packageId);

    return { packageRow: packageRows.rows[0], channelDrafts, exports };
  });
}

// Updates an EXISTING canonical listing package in place instead of creating
// a new one. This is what makes Listing Workspace's "edit an already-handed-
// off listing and save" case safe: without this, the only persistence path
// was an INSERT, so re-saving a package opened from a Sourcing BUY -> LIST
// handoff (or from a prior save in this same Listing Workspace session)
// created a second, disconnected canonical_listing_package while
// sourcing_session_items.canonical_listing_package_id kept pointing at the
// original -- see routes/listings.ts's PUT /listings/packages/:id.
//
// Channel drafts and exports are replaced wholesale (delete then reinsert
// via the same insertChannelDraftsAndExports() the create path uses) rather
// than diffed, so they can never end up half-old/half-new for a package
// whose selected channels changed between saves. Returns null if the
// package id doesn't exist, so the caller can 404 instead of silently
// creating orphaned drafts under a package id that was never inserted.
export async function persistUpdatedListingWorkspace(
  packageId: number,
  generated: GeneratedListingWorkspace,
  onPersisted?: (client: pg.PoolClient, packageId: number | string) => Promise<void>,
): Promise<PersistedListingPackage | null> {
  return transaction(async (client: pg.PoolClient) => {
    const packageRows = await client.query(
      `UPDATE canonical_listing_packages SET
        product_id=$1, source_identifier=$2, identifier_type=$3, intake_source=$4, title=$5, description=$6,
        images=$7, category=$8, condition=$9, size_variant=$10, cost_basis=$11, target_price=$12, margin=$13,
        shipping_profile=$14, status=$15, updated_at=NOW()
       WHERE id=$16
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
        packageId,
      ],
    );

    if (!packageRows.rows[0]) return null;

    await client.query("DELETE FROM channel_listing_drafts WHERE canonical_listing_id=$1", [packageId]);
    await client.query("DELETE FROM listing_export_packages WHERE canonical_listing_id=$1", [packageId]);

    const { channelDrafts, exports } = await insertChannelDraftsAndExports(client, packageId, generated);

    if (onPersisted) await onPersisted(client, packageId);

    return { packageRow: packageRows.rows[0], channelDrafts, exports };
  });
}
