// db.ts — PostgreSQL connection pool
// Uses the DATABASE_URL environment variable set by Replit

import pg from "pg";
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  // Connection pool limits — keeps DB stable under thousands of concurrent users
  max: 20,                    // max simultaneous DB connections
  min: 2,                     // keep 2 warm connections ready at all times
  idleTimeoutMillis: 30_000,  // release idle connections after 30s
  connectionTimeoutMillis: 5_000, // fail fast if DB is unreachable (5s)
  // Prevent queries from hanging forever
  query_timeout: 10_000,      // kill any query taking over 10s
});

// Log pool errors so they surface in server logs, not silently crash
pool.on("error", (err) => {
  console.error("[DB] Unexpected pool error:", err);
});

// Helper: run a query and return rows
export async function query<T extends pg.QueryResultRow>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query<T>(sql, params);
  return result.rows;
}

export async function transaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
