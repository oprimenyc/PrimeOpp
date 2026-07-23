import { Router } from "express";
import { requirePermission } from "../lib/auth.js";
import { query } from "../lib/db.js";
import {
  classifyFreshness,
  getRetailerAdapter,
  RETAILER_ADAPTERS,
  retailerAdapterStatus,
  type FreshnessStatus,
} from "../lib/retailerAdapters.js";
import { storeLookupSchema, validateBody } from "../lib/validation.js";

const router = Router();

// Public-safe: lists retailer adapter shells and their honest configuration
// status. No provider is called.
router.get("/retailers", (_req, res) => {
  res.json({
    retailers: RETAILER_ADAPTERS.map(retailerAdapterStatus),
    providerCalls: false,
    publishEnabled: false,
  });
});

type StoreObservationRow = {
  external_store_id: string;
  store_name: string;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  availability_status: string;
  quantity: number | null;
  quantity_confidence: string;
  price: string | null;
  currency: string | null;
  observed_at: string | null;
  expires_at: string | null;
  source_type: string;
  source_status: string;
  adapter_version: string;
};

// Resolve store availability for the seller-selected retailers. This reads any
// real locally-stored observations (there is no live provider call) and reports
// an honest NOT_CONFIGURED / PROVIDER_REQUIRED state per retailer when no real
// data or configured adapter exists. Quantity is always nullable and a
// status-only observation is never turned into a number.
router.post("/retailers/store-lookup", requirePermission("products:read"), validateBody(storeLookupSchema), async (req, res) => {
  const now = Date.now();
  const productId = req.body.productId ?? null;

  try {
    const results = await Promise.all(
      (req.body.retailers as string[]).map(async (retailerKey) => {
        const adapter = getRetailerAdapter(retailerKey);
        if (!adapter) {
          return {
            retailer: retailerKey,
            adapterStatus: "UNKNOWN_RETAILER",
            configured: false,
            requiredEnv: [],
            stores: [],
            lookupStatus: "UNSUPPORTED",
          };
        }

        const status = retailerAdapterStatus(adapter);

        // Read any real, locally-stored observations joined to this retailer's
        // stores and products. Empty in practice until a real adapter writes
        // rows — but the path is real and reports honestly.
        let rows: StoreObservationRow[] = [];
        if (productId !== null) {
          rows = await query<StoreObservationRow>(
            `SELECT rs.external_store_id, rs.name AS store_name, rs.city, rs.region, rs.postal_code,
                    io.availability_status, io.quantity, io.quantity_confidence, io.price, io.currency,
                    io.observed_at, io.expires_at, io.source_type, io.source_status, io.adapter_version
             FROM retailers r
             JOIN retailer_products rp ON rp.retailer_id = r.id AND rp.product_id = $2
             JOIN inventory_observations io ON io.retailer_product_id = rp.id
             JOIN retailer_stores rs ON rs.id = io.retailer_store_id
             WHERE r.slug = $1
             ORDER BY io.observed_at DESC
             LIMIT 50`,
            [retailerKey, productId],
          );
        }

        const stores = rows.map((row) => {
          const freshness: FreshnessStatus = classifyFreshness(row.observed_at, now, row.expires_at);
          return {
            storeName: row.store_name,
            externalStoreId: row.external_store_id,
            city: row.city,
            region: row.region,
            postalCode: row.postal_code,
            availabilityStatus: row.availability_status,
            // Quantity stays nullable; never invented from a status.
            quantity: row.quantity,
            quantityConfidence: row.quantity_confidence,
            localPrice: row.price !== null ? Number(row.price) : null,
            currency: row.currency,
            observedAt: row.observed_at,
            source: row.source_type,
            sourceStatus: row.source_status,
            freshness,
            adapterVersion: row.adapter_version,
          };
        });

        const lookupStatus = stores.length > 0 ? "SUPPORTED" : status.status === "READY" ? "PROVIDER_REQUIRED" : "NOT_CONFIGURED";

        return {
          retailer: retailerKey,
          adapterStatus: status.status,
          category: status.category,
          configured: status.configured,
          requiredEnv: status.requiredEnv,
          stores,
          lookupStatus,
        };
      }),
    );

    res.json({
      productId,
      location: req.body.location,
      results,
      providerCalls: false,
      publishEnabled: false,
      quantityPolicy: "Quantity is only shown when a source truly supplies it. Status-only availability never invents a number.",
    });
  } catch (err) {
    console.error("POST /retailers/store-lookup error:", err);
    res.status(200).json({
      productId,
      results: (req.body.retailers as string[]).map((retailer) => ({
        retailer,
        adapterStatus: "FAILED",
        stores: [],
        lookupStatus: "FAILED",
      })),
      providerCalls: false,
      publishEnabled: false,
    });
  }
});

export default router;
