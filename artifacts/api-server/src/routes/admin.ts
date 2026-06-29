import { Router } from "express";
import { query } from "../lib/db.js";
import { requirePermission } from "../lib/auth.js";

const router = Router();

router.get("/admin/dashboard", requirePermission("orders:read"), async (_req, res) => {
  const [orderCounts, revenue, productCounts, jobCounts] = await Promise.all([
    query<{ status: string; count: string }>("SELECT status, COUNT(*)::text AS count FROM orders GROUP BY status"),
    query<{ total: string | null }>("SELECT COALESCE(SUM(total), 0)::text AS total FROM orders WHERE status NOT IN ('refunded')"),
    query<{ type: string; count: string }>("SELECT type, COUNT(*)::text AS count FROM products GROUP BY type"),
    query<{ status: string; count: string }>("SELECT status, COUNT(*)::text AS count FROM fulfillment_jobs GROUP BY status"),
  ]);

  res.json({
    orders: orderCounts,
    revenue: Number(revenue[0]?.total ?? 0),
    products: productCounts,
    fulfillmentJobs: jobCounts,
  });
});

router.get("/admin/audit-log", requirePermission("audit:read"), async (_req, res) => {
  const rows = await query(
    `SELECT id, created_at, actor_id, actor_email, actor_ip, action, entity_type, entity_id, old_value, new_value
     FROM audit_log
     ORDER BY created_at DESC
     LIMIT 200`,
  );
  res.json(rows);
});

export default router;
