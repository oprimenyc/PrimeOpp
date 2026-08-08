import { Router } from "express";
import { requirePermission } from "../lib/auth.js";
import { createAuditLog } from "../lib/audit.js";
import { query } from "../lib/db.js";
import {
  applyIdentifierMapLookup,
  applyLocalCatalogLookup,
  classifyProductIntake,
  identifierLookupTypesFor,
  type LocalCatalogProduct,
  type ProductIdentifierMapMatch,
} from "../lib/productIntake.js";
import { generateListingWorkspace } from "../lib/listingWorkspace.js";
import { persistGeneratedListingWorkspace } from "../lib/listingPackagePersistence.js";
import {
  computeSourcingDecision,
  DEFAULT_SOURCING_FEE_SCHEDULE,
  type SourcingItemStatus,
} from "../lib/sourcingDecision.js";
import type { PricingEvidence, FeeSchedule } from "../lib/feeEngine.js";
import {
  sourcingItemBatchSchema,
  sourcingItemCreateSchema,
  sourcingItemUpdateSchema,
  sourcingSessionCreateSchema,
  sourcingSessionUpdateSchema,
  validateBody,
} from "../lib/validation.js";

const router = Router();

function parsePositiveId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

type SessionRow = {
  id: number;
  admin_user_id: number | null;
  label: string;
  location_name: string | null;
  status: "ACTIVE" | "CLOSED";
  notes: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

type ItemRow = {
  id: number;
  session_id: number;
  raw_query: string;
  intake_source: string;
  identifier_type: string | null;
  normalized_identifier: string | null;
  lookup_status: string;
  lookup_source: string;
  matched_product_id: number | null;
  identity_confidence: "HIGH" | "MEDIUM" | "LOW" | "AMBIGUOUS" | "MANUAL" | null;
  title: string | null;
  description: string | null;
  category: string | null;
  image_url: string | null;
  condition: string | null;
  acquisition_cost: string | null;
  shipping_estimate: string | null;
  currency: string;
  target_platform: string | null;
  status: SourcingItemStatus;
  notes: string | null;
  duplicate_of_item_id: number | null;
  canonical_listing_package_id: number | null;
  created_at: string;
  updated_at: string;
};

type PlatformPriceRow = {
  active_low: string | null;
  active_median: string | null;
  active_high: string | null;
  sold_low: string | null;
  sold_median: string | null;
  sold_high: string | null;
  match_confidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  active_listing_count: number | null;
  sold_comp_count: number | null;
};

type EvidenceSummaryRow = {
  platform: string;
  listing_type: "ACTIVE" | "SOLD";
  active_median: string | null;
  sold_median: string | null;
  match_confidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  source_type: string;
  source_url: string | null;
  observed_at: string;
};

export type EvidenceSummaryEntry = {
  platform: string;
  listingType: "ACTIVE" | "SOLD";
  price: number | null;
  matchConfidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  sourceType: string;
  sourceUrl: string | null;
  observedAt: string;
};

type FeeScheduleRow = {
  percentage_fee: string | null;
  fixed_fee: string | null;
  payment_processing_fee: string | null;
  source: string;
  version: string;
};

function toNumber(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Evidence is looked up by the operator's own catalog match (matched_product_id)
// OR by the scanned item's normalized identifier -- whichever is present.
// Most real sourcing items (something scanned at Ross that was never in
// PrimeOpp's own product catalog) will only ever have a normalized
// identifier, never a matched_product_id. Requiring product_id here would
// make evidence lookup permanently unreachable for exactly the scenario
// Sourcing exists for -- see migration 0014.
async function loadPricingEvidence(
  productId: number | null,
  normalizedIdentifier: string | null,
  platform: string | null,
): Promise<{ evidence: PricingEvidence; confidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN"; sampleCount: number | null }> {
  const empty = { evidence: { soldMedian: null, activeLow: null, activeMedian: null, activeHigh: null }, confidence: "UNKNOWN" as const, sampleCount: null };
  if (!platform || (productId === null && !normalizedIdentifier)) return empty;

  const rows = await query<PlatformPriceRow>(
    `SELECT active_low, active_median, active_high, sold_low, sold_median, sold_high,
            match_confidence, active_listing_count, sold_comp_count
     FROM platform_price_observations
     WHERE platform = $3 AND source_status = 'FOUND'
       AND ((product_id IS NOT NULL AND product_id = $1) OR (normalized_identifier IS NOT NULL AND normalized_identifier = $2))
     ORDER BY observed_at DESC
     LIMIT 1`,
    [productId, normalizedIdentifier, platform],
  );
  const row = rows[0];
  if (!row) return empty;

  return {
    evidence: {
      soldMedian: toNumber(row.sold_median),
      activeLow: toNumber(row.active_low),
      activeMedian: toNumber(row.active_median),
      activeHigh: toNumber(row.active_high),
    },
    confidence: row.match_confidence,
    sampleCount: (row.sold_comp_count ?? 0) + (row.active_listing_count ?? 0) || null,
  };
}

// The concise cross-platform summary for the review queue ("eBay $42 sold,
// StockX $61 active...") -- independent of which single platform is
// selected as target_platform for the decision's fee math. Latest FOUND
// observation per platform, across every platform, for this item's
// identity. Never aggregates/averages across platforms -- each stays
// attributed to its own source.
async function loadEvidenceSummary(productId: number | null, normalizedIdentifier: string | null): Promise<EvidenceSummaryEntry[]> {
  if (productId === null && !normalizedIdentifier) return [];

  const rows = await query<EvidenceSummaryRow>(
    `SELECT DISTINCT ON (platform) platform, listing_type, active_median, sold_median,
            match_confidence, source_type, source_url, observed_at
     FROM platform_price_observations
     WHERE source_status = 'FOUND'
       AND ((product_id IS NOT NULL AND product_id = $1) OR (normalized_identifier IS NOT NULL AND normalized_identifier = $2))
     ORDER BY platform, observed_at DESC`,
    [productId, normalizedIdentifier],
  );

  return rows.map((row) => ({
    platform: row.platform,
    listingType: row.listing_type,
    price: toNumber(row.listing_type === "SOLD" ? row.sold_median : row.active_median),
    matchConfidence: row.match_confidence,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    observedAt: row.observed_at,
  }));
}

async function loadFeeSchedule(platform: string | null): Promise<FeeSchedule> {
  if (!platform) return DEFAULT_SOURCING_FEE_SCHEDULE;

  const rows = await query<FeeScheduleRow>(
    `SELECT percentage_fee, fixed_fee, payment_processing_fee, source, version
     FROM platform_fee_schedules
     WHERE platform = $1 AND effective_from <= CURRENT_DATE AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
     ORDER BY effective_from DESC
     LIMIT 1`,
    [platform],
  );
  const row = rows[0];
  if (!row) return DEFAULT_SOURCING_FEE_SCHEDULE;

  return {
    percentageFee: toNumber(row.percentage_fee) ?? DEFAULT_SOURCING_FEE_SCHEDULE.percentageFee,
    fixedFee: toNumber(row.fixed_fee) ?? DEFAULT_SOURCING_FEE_SCHEDULE.fixedFee,
    paymentProcessingPercent: DEFAULT_SOURCING_FEE_SCHEDULE.paymentProcessingPercent,
    paymentProcessingFixed: toNumber(row.payment_processing_fee) ?? DEFAULT_SOURCING_FEE_SCHEDULE.paymentProcessingFixed,
    source: row.source,
    version: row.version,
  };
}

async function withDecision(item: ItemRow) {
  const [{ evidence, confidence, sampleCount }, feeSchedule, evidenceSummary] = await Promise.all([
    loadPricingEvidence(item.matched_product_id, item.normalized_identifier, item.target_platform),
    loadFeeSchedule(item.target_platform),
    loadEvidenceSummary(item.matched_product_id, item.normalized_identifier),
  ]);

  const decision = computeSourcingDecision({
    acquisitionCost: toNumber(item.acquisition_cost),
    shippingEstimate: toNumber(item.shipping_estimate),
    feeSchedule,
    evidence,
    evidenceConfidence: confidence,
    evidenceSampleCount: sampleCount,
  });

  return {
    id: item.id,
    sessionId: item.session_id,
    rawQuery: item.raw_query,
    intakeSource: item.intake_source,
    identifierType: item.identifier_type,
    normalizedIdentifier: item.normalized_identifier,
    lookupStatus: item.lookup_status,
    lookupSource: item.lookup_source,
    matchedProductId: item.matched_product_id,
    identityConfidence: item.identity_confidence,
    title: item.title,
    description: item.description,
    category: item.category,
    imageUrl: item.image_url,
    condition: item.condition,
    acquisitionCost: toNumber(item.acquisition_cost),
    shippingEstimate: toNumber(item.shipping_estimate),
    currency: item.currency,
    targetPlatform: item.target_platform,
    status: item.status,
    notes: item.notes,
    duplicateOfItemId: item.duplicate_of_item_id,
    canonicalListingPackageId: item.canonical_listing_package_id,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    decision,
    evidenceSummary,
  };
}

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
     ORDER BY CASE WHEN lower(title) = lower($2) THEN 0 ELSE 1 END, created_at DESC
     LIMIT 1`,
    [`%${search}%`, search],
  );
  return rows[0] ?? null;
}

// ── Sessions ──────────────────────────────────────────────────────────────

router.post("/sourcing/sessions", requirePermission("products:write"), validateBody(sourcingSessionCreateSchema), async (req, res) => {
  try {
    const rows = await query<SessionRow>(
      `INSERT INTO sourcing_sessions (admin_user_id, label, location_name, notes)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [req.adminUser?.id ?? null, req.body.label, req.body.locationName ?? null, req.body.notes ?? null],
    );
    const session = rows[0];
    await createAuditLog({ req, action: "sourcing_session_create", entityType: "sourcing_session", entityId: session.id, after: { label: session.label } });
    res.status(201).json(session);
  } catch (err) {
    console.error("POST /sourcing/sessions error:", err);
    res.status(500).json({ error: "Failed to create sourcing session" });
  }
});

router.get("/sourcing/sessions", requirePermission("products:read"), async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : null;
    const rows = await query<SessionRow & { item_counts: Record<string, number> }>(
      `SELECT s.*,
              COALESCE(
                (SELECT jsonb_object_agg(status, count) FROM (
                  SELECT status, COUNT(*)::int AS count
                  FROM sourcing_session_items
                  WHERE session_id = s.id
                  GROUP BY status
                ) counts),
                '{}'::jsonb
              ) AS item_counts
       FROM sourcing_sessions s
       WHERE $1::text IS NULL OR s.status = $1
       ORDER BY s.started_at DESC
       LIMIT 200`,
      [status],
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /sourcing/sessions error:", err);
    res.status(500).json({ error: "Failed to load sourcing sessions" });
  }
});

router.get("/sourcing/sessions/:id", requirePermission("products:read"), async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "invalid_route_parameter" });
    return;
  }
  try {
    const rows = await query<SessionRow>("SELECT * FROM sourcing_sessions WHERE id=$1", [id]);
    const session = rows[0];
    if (!session) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const counts = await query<{ status: string; count: number }>(
      "SELECT status, COUNT(*)::int AS count FROM sourcing_session_items WHERE session_id=$1 GROUP BY status",
      [id],
    );
    res.json({ ...session, itemCounts: Object.fromEntries(counts.map((row) => [row.status, row.count])) });
  } catch (err) {
    console.error("GET /sourcing/sessions/:id error:", err);
    res.status(500).json({ error: "Failed to load sourcing session" });
  }
});

router.patch("/sourcing/sessions/:id", requirePermission("products:write"), validateBody(sourcingSessionUpdateSchema), async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "invalid_route_parameter" });
    return;
  }
  try {
    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (req.body.label !== undefined) { fields.push(`label=$${index++}`); values.push(req.body.label); }
    if (req.body.locationName !== undefined) { fields.push(`location_name=$${index++}`); values.push(req.body.locationName); }
    if (req.body.notes !== undefined) { fields.push(`notes=$${index++}`); values.push(req.body.notes); }
    if (req.body.status !== undefined) {
      fields.push(`status=$${index++}`);
      values.push(req.body.status);
      if (req.body.status === "CLOSED") fields.push("ended_at=NOW()");
    }

    if (fields.length === 0) {
      res.status(400).json({ error: "no_fields_to_update" });
      return;
    }

    fields.push("updated_at=NOW()");
    values.push(id);

    const rows = await query<SessionRow>(
      `UPDATE sourcing_sessions SET ${fields.join(", ")} WHERE id=$${index} RETURNING *`,
      values,
    );
    if (!rows[0]) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    await createAuditLog({ req, action: "sourcing_session_update", entityType: "sourcing_session", entityId: id, after: req.body });
    res.json(rows[0]);
  } catch (err) {
    console.error("PATCH /sourcing/sessions/:id error:", err);
    res.status(500).json({ error: "Failed to update sourcing session" });
  }
});

// ── Items ─────────────────────────────────────────────────────────────────

router.post("/sourcing/sessions/:id/items", requirePermission("products:write"), validateBody(sourcingItemCreateSchema), async (req, res) => {
  const sessionId = parsePositiveId(req.params.id);
  if (sessionId === null) {
    res.status(400).json({ error: "invalid_route_parameter" });
    return;
  }

  try {
    const sessionRows = await query<{ id: number; status: string }>("SELECT id, status FROM sourcing_sessions WHERE id=$1", [sessionId]);
    if (!sessionRows[0]) {
      res.status(404).json({ error: "session_not_found" });
      return;
    }

    const classified = classifyProductIntake(req.body.query, req.body.source);
    let resolved = classified;

    if (classified.valid) {
      if (classified.normalizedIdentifier && classified.identifierType !== "PRODUCT_NAME") {
        const match = await findIdentifierMapProduct(classified.normalizedIdentifier, classified.identifierType);
        resolved = applyIdentifierMapLookup(classified, match);
      } else {
        const product = await findLocalCatalogProduct(req.body.query, classified.identifierType);
        resolved = applyLocalCatalogLookup(classified, product);
      }
    }

    // Same-session duplicate detection by normalized identifier.
    let duplicateOfItemId: number | null = null;
    if (resolved.normalizedIdentifier) {
      const dupRows = await query<{ id: number }>(
        `SELECT id FROM sourcing_session_items
         WHERE session_id=$1 AND normalized_identifier=$2 AND status <> 'ARCHIVED'
         ORDER BY created_at ASC LIMIT 1`,
        [sessionId, resolved.normalizedIdentifier],
      );
      duplicateOfItemId = dupRows[0]?.id ?? null;
    }

    const matchedProductId = resolved.matchedProductId ? Number(resolved.matchedProductId) : null;
    const initialStatus: SourcingItemStatus = resolved.lookupStatus === "FOUND" ? "QUEUED" : "SCANNED";

    const rows = await query<ItemRow>(
      `INSERT INTO sourcing_session_items
        (session_id, raw_query, intake_source, identifier_type, normalized_identifier,
         lookup_status, lookup_source, matched_product_id, identity_confidence, title, description, category, image_url,
         acquisition_cost, currency, status, duplicate_of_item_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'USD',$15,$16)
       RETURNING *`,
      [
        sessionId,
        req.body.query,
        req.body.source,
        resolved.identifierType,
        resolved.normalizedIdentifier,
        resolved.lookupStatus,
        resolved.lookupSource,
        matchedProductId,
        // The same classification/match confidence classifyProductIntake()
        // already computes -- previously returned once in this response and
        // then discarded. Persisted so the Review Queue can keep showing it,
        // not just the item's first render.
        resolved.confidence,
        resolved.productCandidate.title ?? null,
        resolved.productCandidate.description ?? null,
        resolved.productCandidate.category ?? null,
        resolved.productCandidate.imageUrl ?? null,
        req.body.acquisitionCost ?? null,
        initialStatus,
        duplicateOfItemId,
      ],
    );

    await createAuditLog({ req, action: "sourcing_item_create", entityType: "sourcing_session_item", entityId: rows[0].id, after: { sessionId, lookupStatus: resolved.lookupStatus } });

    const withDecisionResult = await withDecision(rows[0]);
    res.status(201).json({ ...withDecisionResult, classification: resolved.classification, valid: resolved.valid });
  } catch (err) {
    console.error("POST /sourcing/sessions/:id/items error:", err);
    res.status(500).json({ error: "Failed to add sourcing item" });
  }
});

router.get("/sourcing/sessions/:id/items", requirePermission("products:read"), async (req, res) => {
  const sessionId = parsePositiveId(req.params.id);
  if (sessionId === null) {
    res.status(400).json({ error: "invalid_route_parameter" });
    return;
  }

  try {
    const statusFilter = typeof req.query.status === "string" ? req.query.status.split(",") : null;
    const rows = await query<ItemRow>(
      `SELECT * FROM sourcing_session_items
       WHERE session_id=$1 AND ($2::text[] IS NULL OR status = ANY($2::text[]))
       ORDER BY created_at DESC
       LIMIT 500`,
      [sessionId, statusFilter],
    );
    const withDecisions = await Promise.all(rows.map(withDecision));
    res.json(withDecisions);
  } catch (err) {
    console.error("GET /sourcing/sessions/:id/items error:", err);
    res.status(500).json({ error: "Failed to load sourcing items" });
  }
});

router.patch("/sourcing/sessions/:id/items/:itemId", requirePermission("products:write"), validateBody(sourcingItemUpdateSchema), async (req, res) => {
  const sessionId = parsePositiveId(req.params.id);
  const itemId = parsePositiveId(req.params.itemId);
  if (sessionId === null || itemId === null) {
    res.status(400).json({ error: "invalid_route_parameter" });
    return;
  }

  try {
    // Identity correction: providing matchedProductId means an operator just
    // verified/linked this item to a real catalog product (via the same
    // POST /product-identifiers mapping Listing Workspace already uses --
    // the caller is expected to have saved that mapping first). This is the
    // one field that also drives lookup_status/lookup_source/
    // identity_confidence, so those are never independently settable and
    // can't drift out of sync with what actually happened.
    if (req.body.matchedProductId !== undefined) {
      const productRows = await query<{ id: number }>("SELECT id FROM products WHERE id=$1", [req.body.matchedProductId]);
      if (!productRows[0]) {
        res.status(400).json({ error: "product_not_found" });
        return;
      }
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (req.body.acquisitionCost !== undefined) { fields.push(`acquisition_cost=$${index++}`); values.push(req.body.acquisitionCost); }
    if (req.body.shippingEstimate !== undefined) { fields.push(`shipping_estimate=$${index++}`); values.push(req.body.shippingEstimate); }
    if (req.body.targetPlatform !== undefined) { fields.push(`target_platform=$${index++}`); values.push(req.body.targetPlatform); }
    if (req.body.status !== undefined) { fields.push(`status=$${index++}`); values.push(req.body.status); }
    if (req.body.notes !== undefined) { fields.push(`notes=$${index++}`); values.push(req.body.notes); }
    if (req.body.title !== undefined) { fields.push(`title=$${index++}`); values.push(req.body.title); }
    if (req.body.description !== undefined) { fields.push(`description=$${index++}`); values.push(req.body.description); }
    if (req.body.category !== undefined) { fields.push(`category=$${index++}`); values.push(req.body.category); }
    if (req.body.matchedProductId !== undefined) {
      fields.push(`matched_product_id=$${index++}`);
      values.push(req.body.matchedProductId);
      fields.push(`lookup_status=$${index++}`);
      values.push("FOUND");
      fields.push(`lookup_source=$${index++}`);
      values.push("MANUAL_CORRECTION");
      fields.push(`identity_confidence=$${index++}`);
      values.push("MANUAL");
    }

    if (fields.length === 0) {
      res.status(400).json({ error: "no_fields_to_update" });
      return;
    }

    fields.push("updated_at=NOW()");
    values.push(itemId, sessionId);

    const rows = await query<ItemRow>(
      `UPDATE sourcing_session_items SET ${fields.join(", ")} WHERE id=$${index} AND session_id=$${index + 1} RETURNING *`,
      values,
    );
    if (!rows[0]) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    await createAuditLog({ req, action: "sourcing_item_update", entityType: "sourcing_session_item", entityId: itemId, after: req.body });
    res.json(await withDecision(rows[0]));
  } catch (err) {
    console.error("PATCH /sourcing/sessions/:id/items/:itemId error:", err);
    res.status(500).json({ error: "Failed to update sourcing item" });
  }
});

router.post("/sourcing/sessions/:id/items/batch", requirePermission("products:write"), validateBody(sourcingItemBatchSchema), async (req, res) => {
  const sessionId = parsePositiveId(req.params.id);
  if (sessionId === null) {
    res.status(400).json({ error: "invalid_route_parameter" });
    return;
  }

  const statusForAction: Record<string, SourcingItemStatus | null> = {
    PASS: "PASS",
    WATCH: "WATCH",
    ARCHIVE: "ARCHIVED",
    QUEUE: "QUEUED",
  };
  const nextStatus = statusForAction[req.body.action];

  try {
    const rows = await query<ItemRow>(
      `UPDATE sourcing_session_items
       SET status=$1, updated_at=NOW()
       WHERE session_id=$2 AND id = ANY($3::bigint[])
       RETURNING *`,
      [nextStatus, sessionId, req.body.itemIds],
    );

    await createAuditLog({ req, action: "sourcing_item_batch_update", entityType: "sourcing_session_item", after: { sessionId, itemIds: req.body.itemIds, action: req.body.action } });
    res.json({ updatedCount: rows.length, items: await Promise.all(rows.map(withDecision)) });
  } catch (err) {
    console.error("POST /sourcing/sessions/:id/items/batch error:", err);
    res.status(500).json({ error: "Failed to batch-update sourcing items" });
  }
});

// Bridges a BUY decision into the existing listing workspace instead of
// duplicating listing/channel-draft logic.
router.post("/sourcing/sessions/:id/items/:itemId/create-listing", requirePermission("products:write"), async (req, res) => {
  const sessionId = parsePositiveId(req.params.id);
  const itemId = parsePositiveId(req.params.itemId);
  if (sessionId === null || itemId === null) {
    res.status(400).json({ error: "invalid_route_parameter" });
    return;
  }

  try {
    const rows = await query<ItemRow>("SELECT * FROM sourcing_session_items WHERE id=$1 AND session_id=$2", [itemId, sessionId]);
    const item = rows[0];
    if (!item) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const selectedChannels = Array.isArray(req.body?.selectedChannels) && req.body.selectedChannels.length > 0
      ? req.body.selectedChannels
      : [item.target_platform ?? "manual"];

    // The decision engine (computeSourcingDecision, via the same withDecision
    // helper the Review Queue uses) is the one source of truth for pricing --
    // never recalculated here. recommendedListPrice is already derived from
    // real supported market evidence (see sourcingDecision.ts / feeEngine.ts);
    // this just carries that number into the listing instead of discarding it.
    // Still null when there's no supported evidence yet, exactly as before --
    // no fabricated price is ever introduced.
    const { decision } = await withDecision(item);

    const generated = generateListingWorkspace({
      source: "SCAN",
      identifier: item.normalized_identifier ?? item.raw_query,
      identifierType: item.identifier_type,
      productId: item.matched_product_id,
      product: {
        title: item.title,
        description: item.description,
        category: item.category,
        condition: item.condition,
        costBasis: toNumber(item.acquisition_cost),
        targetPrice: decision.recommendedListPrice,
      },
      selectedChannels,
      createExports: true,
    });

    // Persist through the exact same path routes/listings.ts uses (canonical
    // package + channel drafts + exports) so a BUY item that gets listed here
    // hands off a real ListingPackageResponse the frontend can render with
    // zero adaptation -- not a truncated, drafts-less stand-in.
    const result = await persistGeneratedListingWorkspace(generated, async (client, packageId) => {
      await client.query(
        `UPDATE sourcing_session_items SET canonical_listing_package_id=$1, status='LISTED', updated_at=NOW() WHERE id=$2`,
        [packageId, itemId],
      );
    });

    await createAuditLog({
      req,
      action: "sourcing_item_create_listing",
      entityType: "sourcing_session_item",
      entityId: itemId,
      after: {
        canonicalListingPackageId: result.packageRow.id,
        channel_count: result.channelDrafts.length,
        export_count: result.exports.length,
      },
    });

    res.status(201).json({
      canonicalListingPackageId: result.packageRow.id,
      canonicalListingPackage: result.packageRow,
      channelDrafts: result.channelDrafts,
      exports: result.exports,
      externalPublishEnabled: generated.externalPublishEnabled,
      approvalRequired: generated.approvalRequired,
      liabilityMode: generated.liabilityMode,
    });
  } catch (err) {
    console.error("POST /sourcing/sessions/:id/items/:itemId/create-listing error:", err);
    res.status(500).json({ error: "Failed to create listing from sourcing item" });
  }
});

export default router;
