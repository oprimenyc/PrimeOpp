// products routes — full CRUD for products

import { Router } from "express";
import { query } from "../lib/db.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();

router.get("/products", async (_req, res) => {
  try {
    const products = await query("SELECT * FROM products ORDER BY created_at DESC");
    res.json(products);
  } catch (err) {
    console.error("GET /products error:", err);
    res.status(500).json({ error: "Failed to load products" });
  }
});

router.get("/products/:id", async (req, res) => {
  try {
    const rows = await query("SELECT * FROM products WHERE id = $1", [req.params.id]);
    if (rows.length === 0) { res.status(404).json({ error: "Product not found" }); return; }
    res.json(rows[0]);
  } catch (err) {
    console.error("GET /products/:id error:", err);
    res.status(500).json({ error: "Failed to load product" });
  }
});

router.post("/products", requireAdmin, async (req, res) => {
  try {
    const {
      type, title, description, price, category,
      thumbnail_url, external_link, stock_level, shipping_info,
      colors, sizes, pod_provider, printful_variant_id, tapstitch_variant_id,
    } = req.body as Record<string, unknown>;

    if (!type || !title) { res.status(400).json({ error: "type and title are required" }); return; }

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
        pod_provider ?? "printful",
        printful_variant_id ?? null,
        tapstitch_variant_id ?? null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("POST /products error:", err);
    res.status(500).json({ error: "Failed to create product" });
  }
});

router.put("/products/:id", requireAdmin, async (req, res) => {
  try {
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
        pod_provider ?? "printful",
        printful_variant_id ?? null,
        tapstitch_variant_id ?? null,
        req.params.id,
      ]
    );

    if (rows.length === 0) { res.status(404).json({ error: "Product not found" }); return; }
    res.json(rows[0]);
  } catch (err) {
    console.error("PUT /products/:id error:", err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

router.delete("/products/:id", requireAdmin, async (req, res) => {
  try {
    const rows = await query("DELETE FROM products WHERE id=$1 RETURNING id", [req.params.id]);
    if (rows.length === 0) { res.status(404).json({ error: "Product not found" }); return; }
    res.json({ deleted: true });
  } catch (err) {
    console.error("DELETE /products/:id error:", err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

export default router;
