import { Router } from "express";
import { query } from "../lib/db.js";
import { applyLocalCatalogLookup, classifyProductIntake, type LocalCatalogProduct } from "../lib/productIntake.js";
import { productIntakeSchema, validateBody } from "../lib/validation.js";

const router = Router();

async function findLocalCatalogProduct(rawQuery: string, identifierType: string): Promise<LocalCatalogProduct | null> {
  if (identifierType !== "PRODUCT_NAME") return null;

  const search = rawQuery.trim();
  if (search.length < 3) return null;

  const rows = await query<LocalCatalogProduct>(
    `SELECT id, title, description, category, thumbnail_url
     FROM products
     WHERE lower(title) LIKE lower($1)
     ORDER BY
       CASE WHEN lower(title) = lower($2) THEN 0 ELSE 1 END,
       created_at DESC
     LIMIT 1`,
    [`%${search}%`, search],
  );

  return rows[0] ?? null;
}

router.post("/products/intake", validateBody(productIntakeSchema), async (req, res) => {
  const classified = classifyProductIntake(req.body.query, req.body.source);
  if (!classified.valid) {
    res.status(422).json(classified);
    return;
  }

  try {
    const product = await findLocalCatalogProduct(req.body.query, classified.identifierType);
    const result = applyLocalCatalogLookup(classified, product);
    res.status(200).json(result);
  } catch (err) {
    console.error("POST /products/intake lookup error:", err);
    res.status(200).json({
      ...classified,
      lookupStatus: "FAILED",
      lookupSource: "NONE",
      enrichmentStatus: "FAILED",
      providerCalls: false,
      publishEnabled: false,
    });
  }
});

export default router;
