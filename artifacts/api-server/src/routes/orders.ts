import { Router } from "express";
import Stripe from "stripe";
import { query, transaction } from "../lib/db.js";
import { requirePermission } from "../lib/auth.js";
import { createAuditLog } from "../lib/audit.js";
import { type OrderItem, type ShippingAddress } from "../lib/fulfillment.js";
import {
  processDueFulfillmentJobs,
  processFulfillmentJobSoon,
} from "../lib/fulfillmentQueue.js";
import { processNotificationJobSoon } from "../lib/notificationQueue.js";
import { assertOrderTransition, isOrderStatus, ORDER_STATUSES } from "../lib/orderState.js";
import { checkoutSessionSchema, idParamSchema, orderStatusSchema, validateBody, validateParams } from "../lib/validation.js";

const router = Router();

type ProductPriceRow = {
  id: number;
  price: string | number | null;
  colors: Array<{ name: string; hex: string; price: number }> | null;
};

type OrderRow = {
  id: number;
  status: string;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  customer_email: string;
  customer_name: string | null;
  shipping_address: ShippingAddress | null;
  items: OrderItem[] | null;
};

type StripeSessionWithShipping = Stripe.Checkout.Session & {
  shipping_details?: {
    address?: {
      line1?: string | null;
      line2?: string | null;
      city?: string | null;
      state?: string | null;
      postal_code?: string | null;
      country?: string | null;
    } | null;
  } | null;
};

function getStripe(): Stripe | null {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) return null;
  return new Stripe(key);
}

function parsePositiveId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function buildShippingAddress(session: StripeSessionWithShipping): ShippingAddress {
  const shipping = session.shipping_details;
  return {
    name: session.customer_details?.name ?? "",
    line1: shipping?.address?.line1 ?? "",
    line2: shipping?.address?.line2 ?? undefined,
    city: shipping?.address?.city ?? "",
    state: shipping?.address?.state ?? "",
    postal_code: shipping?.address?.postal_code ?? "",
    country: shipping?.address?.country ?? "US",
  };
}

async function validateAndPriceItems(items: OrderItem[]): Promise<OrderItem[]> {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("No items provided");
  }
  if (items.length > 20) {
    throw new Error("Cart too large - maximum 20 line items");
  }

  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) {
      throw new Error(`Invalid quantity for "${item.title}" - must be a whole number between 1 and 20`);
    }
    if (!Number.isInteger(item.product_id) || item.product_id <= 0) {
      throw new Error("Invalid product_id in cart");
    }
  }

  const productIds = [...new Set(items.map((item) => item.product_id))];
  const dbRows = await query<ProductPriceRow>(
    "SELECT id, price, colors FROM products WHERE id = ANY($1::int[])",
    [productIds],
  );

  if (dbRows.length !== productIds.length) {
    const foundIds = new Set(dbRows.map((row) => row.id));
    const missing = productIds.filter((id) => !foundIds.has(id));
    throw new Error(`Product(s) not found: ${missing.join(", ")}`);
  }

  const priceMap = new Map(
    dbRows.map((row) => [
      row.id,
      {
        basePrice: Number(row.price ?? 0),
        colors: Array.isArray(row.colors) ? row.colors : [],
      },
    ]),
  );

  return items.map((item) => {
    const product = priceMap.get(item.product_id);
    const colorVariant = item.color && product
      ? product.colors.find((color) => color.name === item.color)
      : null;

    return {
      ...item,
      price: colorVariant ? Number(colorVariant.price) : Number(product?.basePrice ?? 0),
    };
  });
}

router.post("/checkout/session", validateBody(checkoutSessionSchema), async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({ error: "Stripe not configured - STRIPE_SECRET_KEY missing" });
    return;
  }

  const { items: rawItems, cancel_url, discount_code } = req.body as {
    items?: OrderItem[];
    cancel_url?: string;
    discount_code?: string;
  };

  let items: OrderItem[];
  let pendingOrderId: number | null = null;
  let stripeSessionCreated = false;
  try {
    items = await validateAndPriceItems(rawItems ?? []);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Invalid cart" });
    return;
  }

  const origin = req.headers["origin"] as string ?? req.headers["referer"] as string ?? "https://primeopp.com";
  const baseUrl = origin.replace(/\/$/, "");

  try {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    let discountAmount = 0;
    let appliedDiscountId: number | null = null;
    if (discount_code) {
      const discounts = await query<{ id: number; value_type: string; value: string; minimum_subtotal: string }>(
        `SELECT id, value_type, value::text, minimum_subtotal::text
         FROM discounts
         WHERE lower(code)=lower($1)
           AND is_active=TRUE
           AND starts_at <= NOW()
           AND (ends_at IS NULL OR ends_at > NOW())
         LIMIT 1`,
        [discount_code],
      );
      const discount = discounts[0];
      if (!discount || subtotal < Number(discount.minimum_subtotal)) {
        res.status(400).json({ error: "Discount code is not eligible for this cart" });
        return;
      }
      appliedDiscountId = discount.id;
      discountAmount = discount.value_type === "fixed"
        ? Math.min(Number(discount.value), subtotal)
        : discount.value_type === "percent"
          ? Math.min(subtotal, subtotal * (Number(discount.value) / 100))
          : 0;
    }
    const discountRatio = subtotal > 0 ? discountAmount / subtotal : 0;
    const pricedItems = items.map((item) => ({
      ...item,
      price: Number(Math.max(0.5, item.price * (1 - discountRatio)).toFixed(2)),
    }));
    const total = Number(pricedItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2));
    const orderRows = await query<{ id: number }>(
      `INSERT INTO orders
        (status, customer_email, customer_name, shipping_address, items, subtotal, total)
       VALUES ('pending', '', NULL, NULL, $1, $2, $3)
       RETURNING id`,
      [JSON.stringify(pricedItems), subtotal, total],
    );
    const orderId = orderRows[0]?.id;
    if (!orderId) throw new Error("Failed to create pending order");
    pendingOrderId = orderId;

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = pricedItems.map((item) => ({
      price_data: {
        currency: "usd",
        unit_amount: Math.round(item.price * 100),
        product_data: {
          name: item.title,
          description: [item.size, item.color].filter(Boolean).join(" / ") || undefined,
        },
      },
      quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      shipping_address_collection: {
        allowed_countries: ["US", "CA", "GB", "AU", "DE", "FR", "JP"],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 499, currency: "usd" },
            display_name: "Standard Shipping",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 5 },
              maximum: { unit: "business_day", value: 10 },
            },
          },
        },
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 999, currency: "usd" },
            display_name: "Express Shipping",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 2 },
              maximum: { unit: "business_day", value: 4 },
            },
          },
        },
      ],
      success_url: `${baseUrl}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url ?? `${baseUrl}/cart`,
      metadata: {
        order_id: String(orderId),
        discount_code: discount_code ?? "",
      },
    });
    stripeSessionCreated = true;

    await query(
      "UPDATE orders SET stripe_session_id=$1, updated_at=NOW() WHERE id=$2",
      [session.id, orderId],
    );
    if (appliedDiscountId) {
      await query("UPDATE discounts SET usage_count=usage_count + 1 WHERE id=$1", [appliedDiscountId]);
    }

    res.json({ url: session.url, session_id: session.id });
  } catch (err) {
    if (pendingOrderId && !stripeSessionCreated) {
      await query("DELETE FROM orders WHERE id=$1 AND status='pending' AND stripe_session_id IS NULL", [pendingOrderId])
        .catch((cleanupErr) => console.error("[Checkout] Could not clean up pending order:", cleanupErr));
    }
    console.error("[Stripe] Create session error:", err);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

router.get("/checkout/session/:id", async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({ error: "Stripe not configured" });
    return;
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.id, {
      expand: ["line_items", "shipping_details"],
    });
    res.json({
      status: session.payment_status,
      customer_email: session.customer_details?.email,
      customer_name: session.customer_details?.name,
      amount_total: session.amount_total,
      shipping: (session as StripeSessionWithShipping).shipping_details,
    });
  } catch (err) {
    console.error("[Stripe] Retrieve session error:", err);
    res.status(500).json({ error: "Could not retrieve session" });
  }
});

router.post("/webhook", async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    res.status(200).send("ok");
    return;
  }

  const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];
  const isProduction = process.env["NODE_ENV"] === "production";
  let event: Stripe.Event;

  try {
    if (webhookSecret) {
      const sig = req.headers["stripe-signature"] as string;
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
    } else if (isProduction) {
      console.error("[Webhook] CRITICAL: STRIPE_WEBHOOK_SECRET not set in production - rejecting event");
      res.status(400).send("Webhook secret not configured");
      return;
    } else {
      console.warn("[Webhook] No STRIPE_WEBHOOK_SECRET - accepting without signature in dev only");
      event = JSON.parse((req.body as Buffer).toString()) as Stripe.Event;
    }
  } catch (err) {
    console.error("[Webhook] Signature verification failed:", err);
    res.status(400).send("Webhook Error");
    return;
  }

  if (event.type !== "checkout.session.completed") {
    res.json({ received: true });
    return;
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") {
    res.json({ received: true });
    return;
  }

  const orderId = parsePositiveId(session.metadata?.["order_id"]);
  if (!orderId) {
    console.error("[Webhook] Missing valid order_id metadata for session:", session.id);
    res.status(400).json({ error: "Missing order_id metadata" });
    return;
  }

  let queuedFulfillmentJobId: number | null = null;
  let queuedNotificationJobId: number | null = null;
  try {
    const queuedJobs = await transaction(async (client) => {
      const orderResult = await client.query<OrderRow>(
        "SELECT * FROM orders WHERE id=$1 FOR UPDATE",
        [orderId],
      );
      const order = orderResult.rows[0];

      if (!order) {
        throw new Error(`Order ${orderId} not found for session ${session.id}`);
      }

      if (order.stripe_session_id && order.stripe_session_id !== session.id) {
        throw new Error(`Order ${orderId} belongs to a different Stripe session`);
      }

      if (order.status !== "pending") {
        console.log("[Webhook] Duplicate or late webhook ignored:", {
          orderId,
          sessionId: session.id,
          status: order.status,
        });
        return { fulfillmentJobId: null, notificationJobId: null };
      }

      assertOrderTransition(order.status, "paid");

      await client.query(
        `UPDATE orders
         SET stripe_session_id=$1,
             stripe_payment_intent=$2,
             status='paid',
             customer_email=$3,
             customer_name=$4,
             shipping_address=$5,
             total=$6,
             updated_at=NOW()
         WHERE id=$7`,
        [
          session.id,
          typeof session.payment_intent === "string" ? session.payment_intent : null,
          session.customer_details?.email ?? "",
          session.customer_details?.name ?? "",
          JSON.stringify(buildShippingAddress(session as StripeSessionWithShipping)),
          (session.amount_total ?? 0) / 100,
          orderId,
        ],
      );

      const jobResult = await client.query<{ id: number }>(
        `INSERT INTO fulfillment_jobs (order_id, status, next_retry_at)
         VALUES ($1, 'queued', NOW())
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [orderId],
      );

      const notificationResult = await client.query<{ id: number }>(
        `INSERT INTO notification_jobs (order_id, type, status, next_retry_at)
         VALUES ($1, 'order_confirmation', 'queued', NOW())
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [orderId],
      );

      return {
        fulfillmentJobId: jobResult.rows[0]?.id ?? null,
        notificationJobId: notificationResult.rows[0]?.id ?? null,
      };
    });
    queuedFulfillmentJobId = queuedJobs.fulfillmentJobId;
    queuedNotificationJobId = queuedJobs.notificationJobId;
  } catch (err) {
    console.error("[Webhook] Failed to mark order paid:", err);
    res.status(500).json({ error: "Could not save paid order" });
    return;
  }

  res.json({ received: true });
  if (queuedFulfillmentJobId) {
    processFulfillmentJobSoon(queuedFulfillmentJobId);
  }
  if (queuedNotificationJobId) {
    processNotificationJobSoon(queuedNotificationJobId);
  }
});

router.get("/orders", requirePermission("orders:read"), async (_req, res) => {
  try {
    const orders = await query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 200");
    res.json(orders);
  } catch (err) {
    console.error("GET /orders error:", err);
    res.status(500).json({ error: "Failed to load orders" });
  }
});

router.post("/orders/fulfillment-jobs/process-due", requirePermission("fulfillment:retry"), async (req, res) => {
  try {
    const processed = await processDueFulfillmentJobs();
    await createAuditLog({ req, action: "fulfillment_process_due", entityType: "fulfillment_job", after: { processed } });
    res.json({ processed });
  } catch (err) {
    console.error("POST /orders/fulfillment-jobs/process-due error:", err);
    res.status(500).json({ error: "Failed to process due fulfillment jobs" });
  }
});

router.get("/orders/:id", requirePermission("orders:read"), validateParams(idParamSchema), async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid order id" });
    return;
  }

  try {
    const rows = await query("SELECT * FROM orders WHERE id=$1", [id]);
    if (rows.length === 0) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    console.error("GET /orders/:id error:", err);
    res.status(500).json({ error: "Failed to load order" });
  }
});

router.patch("/orders/:id/status", requirePermission("orders:write"), validateParams(idParamSchema), validateBody(orderStatusSchema), async (req, res) => {
  const id = parsePositiveId(req.params.id);
  const { status } = req.body as { status?: string };

  if (!id) {
    res.status(400).json({ error: "Invalid order id" });
    return;
  }
  if (!isOrderStatus(status)) {
    res.status(400).json({ error: `Invalid status. Allowed: ${ORDER_STATUSES.join(", ")}` });
    return;
  }

  try {
    const result = await transaction(async (client) => {
      const current = await client.query<OrderRow>(
        "SELECT * FROM orders WHERE id=$1 FOR UPDATE",
        [id],
      );
      const before = current.rows[0];
      if (!before) return { rows: [], before: null };

      assertOrderTransition(before.status, status);

      const updated = await client.query(
        "UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
        [status, id],
      );
      return { rows: updated.rows, before };
    });

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    await createAuditLog({ req, action: "order_status_update", entityType: "order", entityId: id, before: result.before, after: result.rows[0] });
    res.json(result.rows[0]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update order";
    const statusCode = message.startsWith("Invalid order status transition") ? 409 : 500;
    console.error("PATCH /orders/:id/status error:", err);
    res.status(statusCode).json({ error: message });
  }
});

router.post("/orders/:id/retry-fulfillment", requirePermission("fulfillment:retry"), validateParams(idParamSchema), async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid order id" });
    return;
  }

  try {
    const result = await transaction(async (client) => {
      const orderResult = await client.query<OrderRow>(
        "SELECT * FROM orders WHERE id=$1 FOR UPDATE",
        [id],
      );
      const order = orderResult.rows[0];
      if (!order) return { status: 404 as const };

      if (order.status !== "paid") {
        return { status: 409 as const, error: `Order status ${order.status} cannot be retried` };
      }

      await client.query(
        `UPDATE fulfillment_jobs
         SET status='failed', next_retry_at=NULL, updated_at=NOW()
         WHERE order_id=$1 AND status='processing'`,
        [id],
      );

      const existingJob = await client.query<{ id: number }>(
        `UPDATE fulfillment_jobs
         SET status='queued',
             attempts=0,
             last_error=NULL,
             next_retry_at=NOW(),
             updated_at=NOW()
         WHERE order_id=$1 AND status IN ('queued','failed')
         RETURNING id`,
        [id],
      );

      if (existingJob.rows[0]?.id) {
        return { status: 202 as const, jobId: existingJob.rows[0].id };
      }

      const jobResult = await client.query<{ id: number }>(
        `INSERT INTO fulfillment_jobs (order_id, status, attempts, last_error, next_retry_at)
         VALUES ($1, 'queued', 0, NULL, NOW())
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [id],
      );

      if (jobResult.rows[0]?.id) {
        return { status: 202 as const, jobId: jobResult.rows[0].id };
      }

      const activeJob = await client.query<{ id: number }>(
        "SELECT id FROM fulfillment_jobs WHERE order_id=$1 AND status IN ('queued','processing','failed') ORDER BY created_at DESC LIMIT 1",
        [id],
      );

      return { status: 202 as const, jobId: activeJob.rows[0]?.id ?? null };
    });

    if (result.status === 404) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    if (result.status === 409) {
      res.status(409).json({ error: result.error });
      return;
    }

    if (result.jobId) {
      processFulfillmentJobSoon(result.jobId);
    }
    await createAuditLog({ req, action: "fulfillment_retry", entityType: "order", entityId: id, after: result });
    res.status(202).json({ queued: true, job_id: result.jobId });
  } catch (err) {
    console.error("POST /orders/:id/retry-fulfillment error:", err);
    res.status(500).json({ error: "Failed to queue fulfillment retry" });
  }
});

export default router;
