#!/usr/bin/env node
/**
 * Worker entrypoint: `pnpm run worker:commerce-core:dry-run`
 *
 * Reads canonical products (a fixture file by default — no live commerce-
 * core wiring exists yet, see the contract doc), builds an import plan
 * against the live `products` schema, and logs counts only. Defaults to
 * DRY_RUN=true. Never writes to the database unless both DRY_RUN=false
 * and WRITE_MODE=true are explicitly set (safety.ts) — and even then,
 * nothing in this repo or its Railway config ever sets those values.
 *
 * Flags:
 *   --input=<path>    JSON file of canonical products (default: fixtures/sample-products.json)
 *   --check-db        Also run a read-only connectivity check against DATABASE_URL
 *                      (row count only — never prints the connection string, never writes)
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planImport } from "./adapter.js";
import { isDryRun, isWriteModeActive } from "./safety.js";
import { applyPlan, checkConnectivity, createPool, fetchExistingProductRows } from "./db.js";
import type { CanonicalProduct, ExistingLiveProductRow } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv: string[]): { input?: string; checkDb: boolean } {
  const input = argv.find((a) => a.startsWith("--input="))?.slice("--input=".length);
  const checkDb = argv.includes("--check-db");
  return { input, checkDb };
}

async function loadCanonicalProducts(inputPath: string): Promise<CanonicalProduct[]> {
  const raw = await readFile(inputPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Input file ${inputPath} must contain a JSON array of canonical products`);
  }
  return parsed as CanonicalProduct[];
}

async function main(): Promise<void> {
  const { input, checkDb } = parseArgs(process.argv.slice(2));
  const inputPath = input ?? path.join(__dirname, "..", "fixtures", "sample-products.json");

  const dryRun = isDryRun(process.env);
  const writeModeActive = isWriteModeActive(process.env);

  console.log(`[commerce-worker] mode: ${dryRun ? "DRY_RUN" : "WRITE"} (write-mode active: ${writeModeActive})`);
  console.log(`[commerce-worker] loading canonical products from: ${inputPath}`);

  const products = await loadCanonicalProducts(inputPath);
  console.log(`[commerce-worker] loaded ${products.length} canonical product(s)`);

  let existingRows: ExistingLiveProductRow[] = [];
  let pool: ReturnType<typeof createPool> | undefined;

  if (checkDb) {
    const databaseUrl = process.env["DATABASE_URL"];
    if (!databaseUrl) {
      console.error("[commerce-worker] --check-db was requested but DATABASE_URL is not set");
      process.exitCode = 1;
      return;
    }
    pool = createPool(databaseUrl);
    try {
      const connectivity = await checkConnectivity(pool);
      console.log(`[commerce-worker] DB connectivity OK — live products table has ${connectivity.productCount} row(s)`);
      existingRows = await fetchExistingProductRows(pool);
      console.log(`[commerce-worker] fetched ${existingRows.length} existing row(s) for dedupe matching`);
    } finally {
      // Connectivity check is read-only regardless of mode; always release the pool.
      if (dryRun || !writeModeActive) {
        await pool.end();
        pool = undefined;
      }
    }
  }

  const plan = planImport(products, existingRows);

  console.log("[commerce-worker] import plan:");
  console.log(`  total:  ${plan.total}`);
  console.log(`  insert: ${plan.insert}`);
  console.log(`  update: ${plan.update}`);
  console.log(`  skip:   ${plan.skip}`);
  console.log(`  error:  ${plan.error}`);
  for (const entry of plan.entries) {
    const detail = entry.reason ? ` — ${entry.reason}` : "";
    console.log(`  [${entry.action.toUpperCase()}] ${entry.canonicalProductId}${detail}`);
    for (const warning of entry.warnings) {
      console.log(`    warning: ${warning}`);
    }
  }

  if (writeModeActive) {
    if (!pool) {
      const databaseUrl = process.env["DATABASE_URL"];
      if (!databaseUrl) {
        console.error("[commerce-worker] WRITE_MODE is active but DATABASE_URL is not set — refusing to proceed");
        process.exitCode = 1;
        return;
      }
      pool = createPool(databaseUrl);
    }
    console.warn("[commerce-worker] WRITE MODE ACTIVE — applying plan to the live database");
    const result = await applyPlan(pool, plan);
    console.log(`[commerce-worker] applied: ${result.inserted} inserted, ${result.updated} updated`);
    await pool.end();
  } else {
    console.log("[commerce-worker] dry run complete — no database writes performed");
  }
}

main().catch((err) => {
  console.error("[commerce-worker] fatal error:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
