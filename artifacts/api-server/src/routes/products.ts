import { Router } from "express";
import { query } from "../lib/db.js";
import { requirePermission } from "../lib/auth.js";
import { createAuditLog } from "../lib/audit.js";
import { idParamSchema, productSchema, validateBody, validateParams } from "../lib/validation.js";

const router = Router();

router.get("/products", async (_req, res) => {
  try {
    const products = await query(
      `SELECT p.*,
              COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0)::text AS average_rating,
              COUNT(r.id)::text AS review_count
       FROM products p
       LEFT JOIN product_reviews r ON r.product_id = p.id AND r.status='approved'
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
    );
    res.json(products);
  } catch (err) {
    console.error("GET /products error:", err);
    res.status(500).json({ error: "Failed to load products" });
  }
});

router.get("/products/:id", validateParams(idParamSchema), async (req, res) => {
  try {
    const rows = await query(
      `SELECT p.*,
              COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0)::text AS average_rating,
              COUNT(r.id)::text AS review_count
       FROM products p
       LEFT JOIN product_reviews r ON r.product_id = p.id AND r.status='approved'
       WHERE p.id = $1
       GROUP BY p.id`,
      [req.params.id],
    );
    if (rows.length === 0) { res.status(404).json({ error: "Product not found" }); return; }
    res.json(rows[0]);
  } catch (err) {
    console.error("GET /products/:id error:", err);
    res.status(500).json({ error: "Failed to load product" });
  }
});

router.post("/products", requirePermission("products:write"), validateBody(productSchema), async (req, res) => {
  try {
    const {
      type, title, description, price, category,
      thumbnail_url, external_link, stock_level, shipping_info,
      colors, sizes, pod_provider, printful_variant_id, tapstitch_variant_id,
    } = req.body as Record<string, unknown>;

    const rows = await query(
      `INSERT INTO products
        (type, title, description, price, category, thumbnail_url, external_link,
         stock_level, shipping_info, colors, sizes, pod_provider,
         printful_variant_id, tapstitch_variant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        type, title, description ?? null, price ?? null, category ?? null,
        thumbnail_url ?? null, external_link ?? null,
        stock_level ?? null, shipping_info ?? null,
        JSON.stringify(colors ?? []),
        JSON.stringify(sizes ?? []),
        pod_provider ?? null,
        printful_variant_id ?? null,
        tapstitch_variant_id ?? null,
      ]
    );
    await createAuditLog({ req, action: "product_create", entityType: "product", entityId: rows[0]?.id, after: rows[0] });
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("POST /products error:", err);
    res.status(500).json({ error: "Failed to create product" });
  }
});

router.put("/products/:id", requirePermission("products:write"), validateParams(idParamSchema), validateBody(productSchema), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const before = await query("SELECT * FROM products WHERE id=$1", [id]);
    const {
      type, title, description, price, category,
      thumbnail_url, external_link, stock_level, shipping_info,
      colors, sizes, pod_provider, printful_variant_id, tapstitch_variant_id,
    } = req.body as Record<string, unknown>;

    const rows = await query(
      `UPDATE products SET
        type=$1, title=$2, description=$3, price=$4, category=$5,
        thumbnail_url=$6, external_link=$7, stock_level=$8,
        shipping_info=$9, colors=$10, sizes=$11, pod_provider=$12,
        printful_variant_id=$13, tapstitch_variant_id=$14
       WHERE id=$15 RETURNING *`,
      [
        type, title, description ?? null, price ?? null, category ?? null,
        thumbnail_url ?? null, external_link ?? null,
        stock_level ?? null, shipping_info ?? null,
        JSON.stringify(colors ?? []),
        JSON.stringify(sizes ?? []),
        pod_provider ?? null,
        printful_variant_id ?? null,
        tapstitch_variant_id ?? null,
        id,
      ]
    );

    if (rows.length === 0) { res.status(404).json({ error: "Product not found" }); return; }
    await createAuditLog({ req, action: "product_update", entityType: "product", entityId: id, before: before[0], after: rows[0] });
    res.json(rows[0]);
  } catch (err) {
    console.error("PUT /products/:id error:", err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

router.delete("/products/:id", requirePermission("products:delete"), validateParams(idParamSchema), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await query("DELETE FROM products WHERE id=$1 RETURNING *", [id]);
    if (rows.length === 0) { res.status(404).json({ error: "Product not found" }); return; }
    await createAuditLog({ req, action: "product_delete", entityType: "product", entityId: id, before: rows[0] });
    res.json({ deleted: true });
  } catch (err) {
    console.error("DELETE /products/:id error:", err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

export default router;
