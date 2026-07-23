import { Router } from "express";
import { requirePermission } from "../lib/auth.js";
import { calculateFees, recommendListPrice, type PricingStrategy } from "../lib/feeEngine.js";
import {
  getPricingAdapter,
  PLATFORM_PRICING_ADAPTERS,
  platformPricingStatus,
} from "../lib/platformPricing.js";
import { feeCalculationSchema, marketPricingSchema, validateBody } from "../lib/validation.js";

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

export default router;
