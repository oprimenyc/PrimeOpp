import { Router } from "express";
import { requirePermission } from "../lib/auth.js";
import { createAuditLog } from "../lib/audit.js";
import { query } from "../lib/db.js";
import {
  applyIdentifierMapLookup,
  applyLocalCatalogLookup,
  classifyProductIntake,
  identifierLookupTypesFor,
  normalizeProductIdentifier,
  type LocalCatalogProduct,
  type ProductIdentifierMapMatch,
} from "../lib/productIntake.js";
import { productIdentifierSchema, productIntakeSchema, validateBody } from "../lib/validation.js";

const router = Router();

async function findIdentifierMapProduct(normalizedIdentifier: string, identifierType: string): Promise<ProductIdentifierMapMatch | null> {
  const lookupTypes = identifierLookupTypesFor(identifierType as ReturnType<typeof classifyProductIntake>["identifierType"]);
  const rows = await query<ProductIdentifierMapMatch>(
    `SELECT p.id, p.title, p.description, p.category, p.thumbnail_url,
            pi.identifier AS matched_identifier,
            pi.product_id AS matched_product_id,
            pi.identifier_type AS matched_identifier_type,
            pi.confidence AS matched_confidence,
            pi.source AS matched_source
     FROM product_identifiers pi
     JOIN products p ON p.id = pi.product_id
     WHERE pi.normalized_identifier = $1
       AND pi.identifier_type = ANY($2::text[])
     ORDER BY
       CASE WHEN pi.is_primary THEN 0 ELSE 1 END,
       CASE pi.confidence WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END,
       pi.updated_at DESC
     LIMIT 1`,
    [normalizedIdentifier, lookupTypes],
  );

  return rows[0] ?? null;
}

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
    const identifier = classified.normalizedIdentifier;
    if (identifier && classified.identifierType !== "PRODUCT_NAME") {
      const match = await findIdentifierMapProduct(identifier, classified.identifierType);
      const result = applyIdentifierMapLookup(classified, match);
      res.status(200).json(result);
      return;
    }

    const product = await findLocalCatalogProduct(req.body.query, classified.identifierType);
    const result = applyLocalCatalogLookup(classified, product);
    res.status(200).json(result);
  } catch (err) {
    console.error("POST /products/intake lookup error:", err);
    res.status(200).json({
      ...classified,
      lookupStatus: "FAILED",
      lookupSource: "NONE",
      matchedIdentifier: null,
      matchedProductId: null,
      enrichmentStatus: "FAILED",
      providerCalls: false,
      publishEnabled: false,
    });
  }
});

router.post("/product-identifiers", requirePermission("products:write"), validateBody(productIdentifierSchema), async (req, res) => {
  try {
    const normalizedIdentifier = normalizeProductIdentifier(req.body.identifier);
    const rows = await query(
      `INSERT INTO product_identifiers
        (product_id, identifier, identifier_type, normalized_identifier, source, confidence, is_primary)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (normalized_identifier, identifier_type)
       DO UPDATE SET
         product_id = EXCLUDED.product_id,
         identifier = EXCLUDED.identifier,
         source = EXCLUDED.source,
         confidence = EXCLUDED.confidence,
         is_primary = EXCLUDED.is_primary,
         updated_at = NOW()
       RETURNING id, product_id, identifier, identifier_type, normalized_identifier,
                 source, confidence, is_primary, created_at, updated_at`,
      [
        req.body.productId,
        req.body.identifier.trim(),
        req.body.identifierType,
        normalizedIdentifier,
        req.body.source,
        req.body.confidence,
        req.body.isPrimary,
      ],
    );

    const mapping = rows[0];

    await createAuditLog({
      req,
      action: "product_identifier_upsert",
      entityType: "product_identifier",
      entityId: mapping?.id,
      after: {
        id: mapping?.id,
        product_id: mapping?.product_id,
        identifier_type: mapping?.identifier_type,
        source: mapping?.source,
        confidence: mapping?.confidence,
      },
    });

    res.status(201).json({
      mapping,
      normalizedIdentifier,
      providerCalls: false,
      publishEnabled: false,
    });
  } catch (err) {
    console.error("POST /product-identifiers error:", err);
    res.status(500).json({ error: "Failed to save product identifier mapping" });
  }
});

export default router;
