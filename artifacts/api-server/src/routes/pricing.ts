import { Router } from "express";
import { requirePermission } from "../lib/auth.js";
import { createAuditLog } from "../lib/audit.js";
import { query } from "../lib/db.js";
import { calculateFees, recommendListPrice, type PricingStrategy } from "../lib/feeEngine.js";
import {
  getPricingAdapter,
  PLATFORM_PRICING_ADAPTERS,
  platformPricingStatus,
} from "../lib/platformPricing.js";
import {
  feeCalculationSchema,
  manualPriceObservationBatchSchema,
  marketPricingSchema,
  validateBody,
} from "../lib/validation.js";

const router = Router();

// Public-safe: lists platform pricing adapter shells and their configuration
// status. No provider is called.
router.get("/pricing/platforms", (_req, res) => {
  res.json({
    platforms: PLATFORM_PRICING_ADAPTERS.map(platformPricingStatus),
    providerCalls: false,
    publishEnabled: false,
  });
});

// Retrieve market pricing for ONLY the platforms the seller selected. Each
// adapter is a shell that returns an honest NOT_CONFIGURED / PROVIDER_REQUIRED
// state — active and sold bands stay separate and empty rather than fabricated.
router.post("/pricing/market", requirePermission("products:read"), validateBody(marketPricingSchema), async (req, res) => {
  try {
    const results = await Promise.all(
      (req.body.platforms as string[]).map(async (platformKey) => {
        const adapter = getPricingAdapter(platformKey);
        if (!adapter) {
          return {
            platform: platformKey,
            configured: false,
            sourceStatus: "UNSUPPORTED",
            active: { low: null, median: null, high: null, sampleCount: null },
            sold: { low: null, median: null, high: null, sampleCount: null },
            providerCalls: false,
          };
        }
        return adapter.getPricing({
          productId: req.body.productId ?? null,
          normalizedIdentifier: req.body.normalizedIdentifier ?? null,
          identifierType: req.body.identifierType ?? null,
          condition: req.body.condition,
        });
      }),
    );

    res.json({
      condition: req.body.condition,
      results,
      providerCalls: false,
      publishEnabled: false,
      pricingPolicy: "Active asking prices and sold comps are separate. No recommendation is produced from insufficient or fabricated data.",
    });
  } catch (err) {
    console.error("POST /pricing/market error:", err);
    res.status(200).json({
      results: (req.body.platforms as string[]).map((platform) => ({
        platform,
        configured: false,
        sourceStatus: "FAILED",
        active: { low: null, median: null, high: null, sampleCount: null },
        sold: { low: null, median: null, high: null, sampleCount: null },
      })),
      providerCalls: false,
      publishEnabled: false,
    });
  }
});

// Real, deterministic fee/net/profit math. Uses only the seller-supplied fee
// schedule and shipping input. Never assumes shipping silently.
router.post("/pricing/calculate", requirePermission("products:read"), validateBody(feeCalculationSchema), (req, res) => {
  const result = calculateFees({
    listPrice: req.body.listPrice,
    feeSchedule: req.body.feeSchedule,
    shipping: req.body.shipping,
    costBasis: req.body.costBasis ?? null,
    currency: req.body.currency,
  });

  // Optional strategy recommendation is only produced from supported evidence
  // the caller passes; there is no fabricated market data here.
  res.json({
    platform: req.body.platform ?? null,
    calculation: result,
    strategies: (["QUICK_SALE", "MARKET", "MAX_MARGIN"] as PricingStrategy[]).map((strategy) => ({
      strategy,
      ...recommendListPrice(strategy, { soldMedian: null, activeLow: null, activeMedian: null, activeHigh: null }),
    })),
    providerCalls: false,
    publishEnabled: false,
  });
});

// BYOD / manual evidence entry -- the "bring your own data" path. The
// operator directly records a real price they observed (checked a
// marketplace themselves, read it off a Helium10/Keepa/SellerAmp export,
// etc.) rather than PrimeOpp calling any provider. This is currently the
// ONLY writer into platform_price_observations anywhere in the app --
// /pricing/market queries adapter shells live and never persists. No
// fabrication: each submission is exactly the one number the operator
// entered, stored as-is with source_type='MANUAL_ENTRY', never expanded
// into a synthesized low/high range.
router.post("/pricing/observations/manual", requirePermission("products:write"), validateBody(manualPriceObservationBatchSchema), async (req, res) => {
  try {
    const inserted: Record<string, unknown>[] = [];
    for (const obs of req.body.observations as Array<{
      productId: number | null | undefined;
      normalizedIdentifier: string | null | undefined;
      identifierType: string | null | undefined;
      platform: string;
      listingType: "ACTIVE" | "SOLD";
      price: number;
      condition: "NEW" | "USED" | "REFURBISHED" | "OPEN_BOX" | "UNKNOWN";
      matchConfidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
      sourceUrl: string | null | undefined;
      currency: string;
    }>) {
      const rows = await query<Record<string, unknown>>(
        `INSERT INTO platform_price_observations
          (product_id, normalized_identifier, identifier_type, platform, condition, listing_type,
           active_median, sold_median, active_listing_count, sold_comp_count,
           currency, source_type, source_status, source_url, match_confidence, adapter_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'MANUAL_ENTRY','FOUND',$12,$13,'manual-1')
         RETURNING *`,
        [
          obs.productId ?? null,
          obs.normalizedIdentifier ?? null,
          obs.identifierType ?? null,
          obs.platform,
          obs.condition,
          obs.listingType,
          obs.listingType === "ACTIVE" ? obs.price : null,
          obs.listingType === "SOLD" ? obs.price : null,
          obs.listingType === "ACTIVE" ? 1 : null,
          obs.listingType === "SOLD" ? 1 : null,
          obs.currency,
          obs.sourceUrl ?? null,
          obs.matchConfidence,
        ],
      );
      inserted.push(rows[0]);
    }

    await createAuditLog({
      req,
      action: "pricing_observation_manual_entry",
      entityType: "platform_price_observation",
      entityId: null,
      after: { count: inserted.length, platforms: inserted.map((row) => row.platform) },
    });

    res.status(201).json({ observations: inserted, providerCalls: false, publishEnabled: false });
  } catch (err) {
    console.error("POST /pricing/observations/manual error:", err);
    res.status(500).json({ error: "Failed to record manual price observation" });
  }
});

export default router;
