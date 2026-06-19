// orders.ts — Stripe checkout session creation, webhook, and order management

import { Router } from "express";
import Stripe from "stripe";
import { query } from "../lib/db.js";
import { requireAdmin } from "../lib/auth.js";
import { fulfillOrder, type OrderItem, type ShippingAddress } from "../lib/fulfillment.js";
import { sendOrderConfirmation } from "../lib/email.js";

const router = Router();

function getStripe(): Stripe | null {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) return null;
  return new Stripe(key);
}

// POST /api/checkout/session — create a Stripe Checkout session
// Body: { items: [{product_id, title, quantity, size, color, price, pod_provider}], cancel_url }
router.post("/checkout/session", async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({ error: "Stripe not configured — STRIPE_SECRET_KEY missing" });
    return;
  }

  const { items, cancel_url } = req.body as {
    items: OrderItem[];
    cancel_url?: string;
  };

  if (!items || items.length === 0) {
    res.status(400).json({ error: "No items provided" });
    return;
  }

  // ── Cart sanity checks ────────────────────────────────────────────────────
  if (items.length > 20) {
    res.status(400).json({ error: "Cart too large — maximum 20 line items" });
    return;
  }
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) {
      res.status(400).json({
        error: `Invalid quantity for "${item.title}" — must be a whole number between 1 and 20`,
      });
      return;
    }
    if (!item.product_id || typeof item.product_id !== "number") {
      res.status(400).json({ error: "Invalid product_id in cart" });
      return;
    }
  }

  // ── Server-side price validation ──────────────────────────────────────────
  // Never trust client-supplied prices — look them up from the DB
  try {
    const productIds = [...new Set(items.map((i) => i.product_id))];
    const dbRows = await query<{
      id: number;
      price: string | number | null;
      colors: Array<{ name: string; hex: string; price: number }> | null;
    }>(
      `SELECT id, price, colors FROM products WHERE id = ANY($1::int[])`,
      [productIds]
    );

    if (dbRows.length !== productIds.length) {
      const foundIds = new Set(dbRows.map((r) => r.id));
      const missing = productIds.filter((id) => !foundIds.has(id));
      res.status(400).json({ error: `Product(s) not found: ${missing.join(", ")}` });
      return;
    }

    const priceMap = new Map(dbRows.map((r) => ({
      id: r.id,
      basePrice: Number(r.price ?? 0),
      colors: Array.isArray(r.colors) ? r.colors : [],
    })).map((r) => [r.id, r]));

    // Overwrite client-supplied prices with authoritative DB prices
    for (const item of items) {
      const product = priceMap.get(item.product_id);
      if (!product) continue;
      const colorVariant = item.color
        ? product.colors.find((c) => c.name === item.color)
        : null;
      item.price = colorVariant ? Number(colorVariant.price) : product.basePrice;
    }
  } catch (err) {
    console.error("[Checkout] Price validation error:", err);
    res.status(500).json({ error: "Could not validate product prices" });
    return;
  }

  // Build the origin from the request headers
  const origin = req.headers["origin"] as string ?? req.headers["referer"] as string ?? "https://primeopp.com";
  const baseUrl = origin.replace(/\/$/, "");

  try {
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item) => ({
      price_data: {
        currency: "usd",
        unit_amount: Math.round(item.price * 100), // cents — now from DB
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
        items: JSON.stringify(items),
      },
    });

    res.json({ url: session.url, session_id: session.id });
  } catch (err) {
    console.error("[Stripe] Create session error:", err);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// GET /api/checkout/session/:id — verify a completed session (for success page)
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
      shipping: session.shipping_details,
    });
  } catch (err) {
    console.error("[Stripe] Retrieve session error:", err);
    res.status(500).json({ error: "Could not retrieve session" });
  }
});

// POST /api/webhook — Stripe webhook (called by Stripe after payment)
// Must use raw body — app.ts mounts this BEFORE express.json()
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
      // In production, NEVER process unverified webhook events
      console.error("[Webhook] CRITICAL: STRIPE_WEBHOOK_SECRET not set in production — rejecting event");
      res.status(400).send("Webhook secret not configured");
      return;
    } else {
      // Dev only — parse without verification
      console.warn("[Webhook] No STRIPE_WEBHOOK_SECRET — accepting without signature (dev mode only)");
      event = JSON.parse((req.body as Buffer).toString()) as Stripe.Event;
    }
  } catch (err) {
    console.error("[Webhook] Signature verification failed:", err);
    res.status(400).send("Webhook Error");
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status !== "paid") {
      res.json({ received: true });
      return;
    }

    // ── Step 1: Parse session data ──────────────────────────────────────────
    const items: OrderItem[] = (() => {
      try {
        return JSON.parse(session.metadata?.["items"] ?? "[]") as OrderItem[];
      } catch {
        console.error("[Webhook] CRITICAL: Could not parse items from session metadata", session.id);
        return [];
      }
    })();

    const customerEmail = session.customer_details?.email ?? "";
    const customerName = session.customer_details?.name ?? "";
    const shipping = session.shipping_details;
    const total = (session.amount_total ?? 0) / 100;
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const shippingAddr: ShippingAddress = {
      name: customerName,
      line1: shipping?.address?.line1 ?? "",
      line2: shipping?.address?.line2 ?? undefined,
      city: shipping?.address?.city ?? "",
      state: shipping?.address?.state ?? "",
      postal_code: shipping?.address?.postal_code ?? "",
      country: shipping?.address?.country ?? "US",
    };

    // ── Step 2: Save order to DB ─────────────────────────────────────────────
    let orderId: number;
    try {
      const orderRows = await query<{ id: number }>(
        `INSERT INTO orders
          (stripe_session_id, stripe_payment_intent, status, customer_email, customer_name,
           shipping_address, items, subtotal, total)
         VALUES ($1,$2,'paid',$3,$4,$5,$6,$7,$8)
         ON CONFLICT (stripe_session_id) DO UPDATE SET status='paid'
         RETURNING id`,
        [
          session.id,
          typeof session.payment_intent === "string" ? session.payment_intent : null,
          customerEmail,
          customerName,
          JSON.stringify(shippingAddr),
          JSON.stringify(items),
          subtotal,
          total,
        ]
      );

      if (!orderRows[0]?.id) {
        throw new Error(`DB returned no order ID for session ${session.id}`);
      }

      orderId = orderRows[0].id;
      console.log("[Webhook] Order saved:", orderId);
    } catch (err) {
      // CRITICAL — customer was charged but order wasn't saved
      console.error("[Webhook] CRITICAL: Failed to save order to DB — session:", session.id, err);
      // Still return 200 so Stripe doesn't retry indefinitely;
      // the DBA / admin must manually reconcile using the session ID above.
      res.json({ received: true, error: "order_save_failed" });
      return;
    }

    // ── Step 3: Fulfill with Printful / Tapstitch ────────────────────────────
    if (items.length > 0 && shippingAddr.line1) {
      try {
        const results = await fulfillOrder(items, shippingAddr, customerEmail);
        if (results.length > 0) {
          // Save ALL results (supports mixed Printful + Tapstitch carts)
          const summary = results.map(r => r.status).join(", ");
          const providers = results.map(r => r.provider).join(", ");
          const orderIds = results.map(r => r.order_id).join(", ");
          await query(
            "UPDATE orders SET fulfillment_provider=$1, fulfillment_order_id=$2, fulfillment_status=$3 WHERE id=$4",
            [providers, orderIds, summary, orderId]
          );
        }
      } catch (err) {
        // Non-fatal — order is saved and paid, but fulfillment needs manual retry
        console.error("[Webhook] Fulfillment error for order", orderId, err);
        await query(
          "UPDATE orders SET fulfillment_status=$1 WHERE id=$2",
          ["error: fulfillment threw unexpectedly", orderId]
        ).catch((dbErr) => console.error("[Webhook] Could not save fulfillment error status:", dbErr));
      }
    }

    // ── Step 4: Send confirmation email ─────────────────────────────────────
    try {
      await sendOrderConfirmation({
        customerEmail,
        customerName,
        orderId,
        items: items.map((i) => ({
          title: i.title,
          size: i.size,
          color: i.color,
          quantity: i.quantity,
          price: i.price,
        })),
        total,
        shippingAddress: {
          line1: shippingAddr.line1,
          city: shippingAddr.city,
          state: shippingAddr.state,
          postal_code: shippingAddr.postal_code,
          country: shippingAddr.country,
        },
      });
    } catch (err) {
      // Non-fatal — order is saved, fulfillment submitted; email can be sent manually
      console.error("[Webhook] Email send failed for order", orderId, err);
    }
  }

  res.json({ received: true });
});

// GET /api/orders — admin: list all orders (newest first)
router.get("/orders", requireAdmin, async (_req, res) => {
  try {
    const orders = await query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 200");
    res.json(orders);
  } catch (err) {
    console.error("GET /orders error:", err);
    res.status(500).json({ error: "Failed to load orders" });
  }
});

// GET /api/orders/:id — admin: single order detail
router.get("/orders/:id", requireAdmin, async (req, res) => {
  try {
    const rows = await query("SELECT * FROM orders WHERE id=$1", [req.params.id]);
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

const ALLOWED_ORDER_STATUSES = new Set([
  "pending", "paid", "processing", "fulfilled",
  "shipped", "delivered", "refunded", "cancelled", "fulfillment_failed",
]);

// PATCH /api/orders/:id/status — admin: update order status
router.patch("/orders/:id/status", requireAdmin, async (req, res) => {
  const { status } = req.body as { status: string };

  if (!status || !ALLOWED_ORDER_STATUSES.has(status)) {
    res.status(400).json({
      error: `Invalid status. Allowed: ${[...ALLOWED_ORDER_STATUSES].join(", ")}`,
    });
    return;
  }

  try {
    const rows = await query(
      "UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
      [status, req.params.id]
    );
    if (rows.length === 0) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    console.error("PATCH /orders/:id/status error:", err);
    res.status(500).json({ error: "Failed to update order" });
  }
});

export default router;
