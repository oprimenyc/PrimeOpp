/**
 * Database access for the commerce-worker. Deliberately lazy: importing
 * this module never connects or reads `DATABASE_URL` — the pool is only
 * constructed when a caller explicitly asks for one, so pure planning
 * logic (adapter.ts) and its tests never need a database at all.
 *
 * Never logs `DATABASE_URL` or any other connection value.
 */

import pg from "pg";
import type { ExistingLiveProductRow, ImportPlanSummary, LiveProductRow } from "./types.js";

export function createPool(databaseUrl: string): pg.Pool {
  return new pg.Pool({
    connectionString: databaseUrl,
    ssl: process.env["NODE_ENV"] === "production" ? { rejectUnauthorized: false } : false,
    max: 3,
    connectionTimeoutMillis: 5_000,
    query_timeout: 10_000,
  });
}

/** Read-only. Used for the (title, type) dedupe heuristic — see adapter.ts. */
export async function fetchExistingProductRows(pool: pg.Pool): Promise<ExistingLiveProductRow[]> {
  const result = await pool.query<ExistingLiveProductRow>("SELECT id, title, type FROM products");
  return result.rows;
}

/** Read-only. Reports schema reachability and row count — no row contents. */
export async function checkConnectivity(pool: pg.Pool): Promise<{ ok: true; productCount: number }> {
  const result = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM products");
  return { ok: true, productCount: Number(result.rows[0]?.count ?? 0) };
}

export interface ApplyPlanResult {
  inserted: number;
  updated: number;
}

/**
 * Performs real INSERT/UPDATE statements against `products`. This function
 * has no gate of its own by design (single responsibility) — the caller
 * (worker.ts) is responsible for only invoking it when
 * `isWriteModeActive()` (safety.ts) is true. As of this session, nothing
 * in this codebase ever calls this function — it exists so the adapter's
 * architecture is real and testable, not so it can run unattended. No
 * deployment of this worker in write mode has been requested or performed.
 */
export async function applyPlan(pool: pg.Pool, plan: ImportPlanSummary): Promise<ApplyPlanResult> {
  let inserted = 0;
  let updated = 0;

  for (const entry of plan.entries) {
    if (entry.action !== "insert" && entry.action !== "update") continue;
    const row = entry.row as LiveProductRow;

    if (entry.action === "insert") {
      await pool.query(
        `INSERT INTO products
           (type, title, description, price, category, thumbnail_url, external_link,
            stock_level, shipping_info, colors, sizes, pod_provider, printful_variant_id, tapstitch_variant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          row.type, row.title, row.description, row.price, row.category, row.thumbnail_url, row.external_link,
          row.stock_level, row.shipping_info, JSON.stringify(row.colors), JSON.stringify(row.sizes),
          row.pod_provider, row.printful_variant_id, row.tapstitch_variant_id,
        ],
      );
      inserted += 1;
    } else {
      await pool.query(
        `UPDATE products
         SET description=$2, price=$3, category=$4, thumbnail_url=$5, external_link=$6,
             stock_level=$7, shipping_info=$8, colors=$9, sizes=$10
         WHERE id=$1`,
        [
          entry.matchedExistingId, row.description, row.price, row.category, row.thumbnail_url, row.external_link,
          row.stock_level, row.shipping_info, JSON.stringify(row.colors), JSON.stringify(row.sizes),
        ],
      );
      updated += 1;
    }
  }

  return { inserted, updated };
}
