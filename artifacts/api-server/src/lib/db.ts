// db.ts — PostgreSQL connection pool
// Uses the DATABASE_URL environment variable set by Replit

import pg from "pg";
const { Pool } = pg;

// Create one shared pool — reuses connections efficiently
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// Helper: run a query and return rows
export async function query<T extends pg.QueryResultRow>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query<T>(sql, params);
  return result.rows;
}
