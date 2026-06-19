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

  // Build the origin from the request headers
  const origin = req.headers["origin"] as string ?? req.headers["referer"] as string ?? "https://primeopp.com";
  const baseUrl = origin.replace(/\/$/, "");

  try {
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item) => ({
      price_data: {
        currency: "usd",
        unit_amount: Math.round(item.price * 100), // cents
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
    res.status(200).send("ok"); // Don't fail if not configured
    return;
  }

  const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];
  let event: Stripe.Event;

  try {
    if (webhookSecret) {
      const sig = req.headers["stripe-signature"] as string;
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
    } else {
      // In dev without webhook secret, parse raw body
      event = JSON.parse((req.body as Buffer).toString()) as Stripe.Event;
    }
  } catch (err) {
    console.error("[Webhook] Signature verification failed:", err);
    res.status(400).send("Webhook Error");
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // Only process paid sessions
    if (session.payment_status !== "paid") {
      res.json({ received: true });
      return;
    }

    try {
      // Parse items from session metadata
      const items: OrderItem[] = JSON.parse(session.metadata?.["items"] ?? "[]") as OrderItem[];
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

      // Save order to DB
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

      const orderId = orderRows[0]?.id ?? 0;
      console.log("[Webhook] Order saved:", orderId);

      // Auto-fulfill with Printful / Tapstitch
      if (items.length > 0 && shippingAddr.line1) {
        const results = await fulfillOrder(items, shippingAddr, customerEmail);
        if (results.length > 0) {
          const r = results[0];
          await query(
            "UPDATE orders SET fulfillment_provider=$1, fulfillment_order_id=$2, fulfillment_status=$3 WHERE id=$4",
            [r.provider, r.order_id, r.status, orderId]
          );
        }
      }

      // Send confirmation email
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
      console.error("[Webhook] Order processing error:", err);
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

// PATCH /api/orders/:id/status — admin: update order status
router.patch("/orders/:id/status", requireAdmin, async (req, res) => {
  const { status } = req.body as { status: string };
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
