#!/usr/bin/env node
// migrate.mjs — local-only migration runner
//
// Applies the numbered raw-SQL files in lib/db/migrations/*.sql, in filename
// order, against DATABASE_URL. Tracks what's already applied in a
// `schema_migrations` table so re-running is a no-op for anything already
// applied (the migration files themselves are also written to be idempotent
// via IF NOT EXISTS / ON CONFLICT DO NOTHING, so a re-run is safe either way).
//
// This does not select or configure a database target. It uses whatever
// DATABASE_URL is already set in the environment — the same convention every
// other part of this app uses (see artifacts/api-server/src/lib/db.ts,
// lib/db/src/index.ts). Point DATABASE_URL at a local/dev Postgres instance
// before running this. Refuses to run with NODE_ENV=production unless
// explicitly overridden, as a guard against accidentally targeting a live
// database.
//
// Usage:
//   DATABASE_URL=postgres://localhost:5432/primeopp_dev node scripts/migrate.mjs
//   pnpm --filter @workspace/db run migrate

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const { Client } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "..", "migrations");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error(
    "[migrate] DATABASE_URL is not set. Point it at a local/dev Postgres instance and re-run.\n" +
    "           Example: DATABASE_URL=postgres://localhost:5432/primeopp_dev node scripts/migrate.mjs"
  );
  process.exit(1);
}

if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_MIGRATE !== "true") {
  console.error(
    "[migrate] Refusing to run with NODE_ENV=production. This runner is intended for local/dev\n" +
    "           databases only — deploy-target and production migration strategy is a separate,\n" +
    "           human-approved decision. Set ALLOW_PROD_MIGRATE=true to override."
  );
  process.exit(1);
}

const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.log(`[migrate] No migration files found in ${migrationsDir}`);
  process.exit(0);
}

const client = new Client({ connectionString: databaseUrl });

async function main() {
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const { rows } = await client.query("SELECT filename FROM schema_migrations");
  const applied = new Set(rows.map((row) => row.filename));

  let appliedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`[migrate] skip (already applied): ${file}`);
      skippedCount += 1;
      continue;
    }

    const sql = readFileSync(path.join(migrationsDir, file), "utf8");
    console.log(`[migrate] applying: ${file}`);

    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
      await client.query("COMMIT");
      appliedCount += 1;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`[migrate] FAILED on ${file}:`, err instanceof Error ? err.message : err);
      process.exitCode = 1;
      break;
    }
  }

  console.log(`[migrate] done. ${appliedCount} applied, ${skippedCount} already up to date.`);
  await client.end();
}

main().catch(async (err) => {
  console.error("[migrate] Unexpected error:", err);
  try {
    await client.end();
  } catch {
    // already closed
  }
  process.exitCode = 1;
});
