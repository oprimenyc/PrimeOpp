import { Router } from "express";
import { query } from "../lib/db.js";
import { requirePermission } from "../lib/auth.js";
import { createAuditLog } from "../lib/audit.js";
import { sendAbandonedCartReminder } from "../lib/email.js";
import {
  abandonedCartSchema,
  discountQuoteSchema,
  idParamSchema,
  reviewCreateSchema,
  reviewModerationSchema,
  validateBody,
  validateParams,
} from "../lib/validation.js";

const router = Router();

type ReviewRow = {
  id: string;
  product_id: number;
  customer_name: string;
  rating: number;
  title: string;
  body: string;
  photo_url: string | null;
  is_verified_purchase: boolean;
  helpful_count: number;
  created_at: string;
};

type ProductRow = {
  id: number;
  type: string;
  title: string;
  description: string | null;
  price: string | number | null;
  category: string | null;
  thumbnail_url: string | null;
  external_link: string | null;
  stock_level: number | null;
  shipping_info: string | null;
  colors: unknown;
  sizes: unknown;
  pod_provider: string | null;
  printful_variant_id: string | null;
  tapstitch_variant_id: string | null;
  created_at: string;
  average_rating?: string | number | null;
  review_count?: string | number | null;
};

function parsePositiveId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeProduct(product: ProductRow) {
  return {
    ...product,
    price: product.price === null ? null : Number(product.price),
    average_rating: product.average_rating === null || product.average_rating === undefined
      ? 0
      : Number(product.average_rating),
    review_count: product.review_count === null || product.review_count === undefined
      ? 0
      : Number(product.review_count),
  };
}

function discountAmount(discount: { value_type: string; value: string | number }, subtotal: number): number {
  if (discount.value_type === "shipping") return 0;
  if (discount.value_type === "fixed") return Math.min(Number(discount.value), subtotal);
  return Math.min(subtotal, subtotal * (Number(discount.value) / 100));
}

router.get("/products/:id/reviews", validateParams(idParamSchema), async (req, res) => {
  const id = parsePositiveId(req.params.id);
  const sort = String(req.query["sort"] ?? "newest");
  const search = String(req.query["q"] ?? "").trim();
  const orderBy = sort === "helpful"
    ? "helpful_count DESC, created_at DESC"
    : sort === "rating_high"
      ? "rating DESC, created_at DESC"
      : sort === "rating_low"
        ? "rating ASC, created_at DESC"
        : "created_at DESC";

  const reviews = await query<ReviewRow>(
    `SELECT id::text, product_id, customer_name, rating, title, body, photo_url,
            is_verified_purchase, helpful_count, created_at::text
     FROM product_reviews
     WHERE product_id=$1
       AND status='approved'
       AND ($2 = '' OR title ILIKE '%' || $2 || '%' OR body ILIKE '%' || $2 || '%')
     ORDER BY ${orderBy}
     LIMIT 100`,
    [id, search],
  );

  const summary = await query<{ average_rating: string | null; review_count: string }>(
    "SELECT ROUND(AVG(rating)::numeric, 2)::text AS average_rating, COUNT(*)::text AS review_count FROM product_reviews WHERE product_id=$1 AND status='approved'",
    [id],
  );

  res.json({
    average_rating: Number(summary[0]?.average_rating ?? 0),
    review_count: Number(summary[0]?.review_count ?? 0),
    reviews,
  });
});

router.post("/products/:id/reviews", validateParams(idParamSchema), validateBody(reviewCreateSchema), async (req, res) => {
  const productId = parsePositiveId(req.params.id);
  if (!productId) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }

  const body = req.body as {
    customer_email: string;
    customer_name: string;
    rating: number;
    title: string;
    body: string;
    photo_url?: string | null;
  };

  const verified = await query<{ id: number }>(
    "SELECT id FROM orders WHERE customer_email=$1 AND items::text LIKE $2 AND status IN ('paid','processing','fulfilled','shipped','delivered') LIMIT 1",
    [body.customer_email, `%"product_id":${productId}%`],
  );

  const rows = await query<{ id: string }>(
    `INSERT INTO product_reviews
      (product_id, order_id, customer_email, customer_name, rating, title, body, photo_url, is_verified_purchase)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id::text`,
    [
      productId,
      verified[0]?.id ?? null,
      body.customer_email,
      body.customer_name,
      body.rating,
      body.title,
      body.body,
      body.photo_url ?? null,
      Boolean(verified[0]?.id),
    ],
  );

  res.status(202).json({ id: rows[0]?.id, status: "pending" });
});

router.post("/reviews/:id/helpful", validateParams(idParamSchema), async (req, res) => {
  const id = parsePositiveId(req.params.id);
  const voterKey = `${req.ip ?? "unknown"}:${req.headers["user-agent"] ?? "unknown"}`.slice(0, 240);
  const vote = await query(
    `INSERT INTO product_review_votes (review_id, voter_key)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING
     RETURNING review_id`,
    [id, voterKey],
  );

  if (vote.length > 0) {
    await query("UPDATE product_reviews SET helpful_count=helpful_count + 1 WHERE id=$1", [id]);
  }

  const rows = await query<{ helpful_count: number }>("SELECT helpful_count FROM product_reviews WHERE id=$1", [id]);
  res.json({ helpful_count: rows[0]?.helpful_count ?? 0 });
});

router.get("/products/:id/recommendations", validateParams(idParamSchema), async (req, res) => {
  const id = parsePositiveId(req.params.id);
  const productRows = await query<{ category: string | null; type: string }>("SELECT category, type FROM products WHERE id=$1", [id]);
  const product = productRows[0];
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const placements = [
    "frequently_bought_together",
    "related_products",
    "complete_the_look",
    "customers_also_bought",
    "cart_upsell",
    "checkout_upsell",
    "post_purchase_upsell",
  ];

  const response: Record<string, ReturnType<typeof normalizeProduct>[]> = {};
  for (const placement of placements) {
    const explicit = await query<ProductRow>(
      `SELECT p.*, ROUND(AVG(r.rating)::numeric, 2)::text AS average_rating, COUNT(r.id)::text AS review_count
       FROM product_recommendations pr
       JOIN products p ON p.id = pr.recommended_product_id
       LEFT JOIN product_reviews r ON r.product_id = p.id AND r.status='approved'
       WHERE pr.product_id=$1 AND pr.placement=$2
       GROUP BY p.id, pr.priority
       ORDER BY pr.priority DESC, p.created_at DESC
       LIMIT 4`,
      [id, placement],
    );

    const fallback = explicit.length > 0 ? explicit : await query<ProductRow>(
      `SELECT p.*, ROUND(AVG(r.rating)::numeric, 2)::text AS average_rating, COUNT(r.id)::text AS review_count
       FROM products p
       LEFT JOIN product_reviews r ON r.product_id = p.id AND r.status='approved'
       WHERE p.id <> $1 AND (p.category = $2 OR p.type = $3)
       GROUP BY p.id
       ORDER BY p.created_at DESC
       LIMIT 4`,
      [id, product.category, product.type],
    );
    response[placement] = fallback.map(normalizeProduct);
  }

  res.json(response);
});

router.post("/abandoned-cart", validateBody(abandonedCartSchema), async (req, res) => {
  const body = req.body as {
    email?: string | null;
    cart_token: string;
    items: unknown[];
    subtotal: number;
  };

  const status = body.items.length === 0 ? "expired" : "active";
  await query(
    `INSERT INTO abandoned_carts (cart_token, email, items, subtotal, status, updated_at)
     VALUES ($1,$2,$3,$4,$5,NOW())
     ON CONFLICT (cart_token) DO UPDATE SET
       email=COALESCE(EXCLUDED.email, abandoned_carts.email),
       items=EXCLUDED.items,
       subtotal=EXCLUDED.subtotal,
       status=EXCLUDED.status,
       updated_at=NOW()`,
    [body.cart_token, body.email ?? null, JSON.stringify(body.items), body.subtotal, status],
  );

  res.status(202).json({ tracked: true });
});

router.post("/discounts/quote", validateBody(discountQuoteSchema), async (req, res) => {
  const body = req.body as {
    code?: string;
    subtotal: number;
    items: Array<{ quantity: number; price: number }>;
  };
  const itemCount = body.items.reduce((sum, item) => sum + item.quantity, 0);
  const discounts = await query<{ code: string | null; name: string; discount_type: string; value_type: string; value: string; minimum_subtotal: string }>(
    `SELECT code, name, discount_type, value_type, value::text, minimum_subtotal::text
     FROM discounts
     WHERE is_active=TRUE
       AND starts_at <= NOW()
       AND (ends_at IS NULL OR ends_at > NOW())
       AND minimum_subtotal <= $1
       AND ($2 = '' OR lower(code) = lower($2) OR discount_type IN ('automatic','free_shipping','tiered','volume'))
     ORDER BY value DESC`,
    [body.subtotal, body.code ?? ""],
  );

  const eligible = discounts
    .filter((discount) => discount.discount_type !== "volume" || itemCount >= 3)
    .map((discount) => ({
      ...discount,
      amount: Number(discountAmount(discount, body.subtotal).toFixed(2)),
    }));
  const best = eligible.sort((a, b) => b.amount - a.amount)[0] ?? null;
  const freeShipping = eligible.some((discount) => discount.discount_type === "free_shipping");

  res.json({
    discount: best,
    free_shipping: freeShipping,
    subtotal: body.subtotal,
    total: Number(Math.max(0, body.subtotal - (best?.amount ?? 0)).toFixed(2)),
    eligible,
  });
});

router.get("/loyalty/:email", async (req, res) => {
  const email = String(req.params["email"] ?? "").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Invalid email" });
    return;
  }

  const rows = await query<{ id: string; customer_email: string; points_balance: number; lifetime_points: number; vip_level: string; referral_code: string | null }>(
    `INSERT INTO loyalty_accounts (customer_email, referral_code)
     VALUES ($1, upper(substr(md5($1), 1, 8)))
     ON CONFLICT (customer_email) DO UPDATE SET updated_at=NOW()
     RETURNING id::text, customer_email, points_balance, lifetime_points, vip_level, referral_code`,
    [email],
  );
  const history = await query(
    "SELECT points, reason, order_id, created_at FROM loyalty_points_history WHERE loyalty_account_id=$1 ORDER BY created_at DESC LIMIT 20",
    [rows[0]?.id],
  );

  res.json({ account: rows[0], history });
});

router.get("/admin/revenue", requirePermission("orders:read"), async (_req, res) => {
  const [
    totals,
    repeat,
    products,
    abandoned,
    coupons,
    refunds,
    upsells,
  ] = await Promise.all([
    query<{ revenue: string; orders: string; aov: string }>(
      "SELECT COALESCE(SUM(total),0)::text AS revenue, COUNT(*)::text AS orders, COALESCE(AVG(total),0)::text AS aov FROM orders WHERE status NOT IN ('pending','refunded')",
    ),
    query<{ repeat_customers: string; ltv: string }>(
      `SELECT COUNT(*)::text AS repeat_customers, COALESCE(AVG(customer_total),0)::text AS ltv
       FROM (
        SELECT customer_email, SUM(total) AS customer_total, COUNT(*) AS order_count
        FROM orders
        WHERE customer_email <> '' AND status NOT IN ('pending','refunded')
        GROUP BY customer_email
       ) customers
       WHERE order_count > 1`,
    ),
    query(
      `SELECT item->>'title' AS title, SUM((item->>'quantity')::int)::text AS units
       FROM orders, jsonb_array_elements(items) AS item
       WHERE status NOT IN ('pending','refunded')
       GROUP BY item->>'title'
       ORDER BY SUM((item->>'quantity')::int) DESC
       LIMIT 8`,
    ),
    query<{ active: string; recovered: string; value: string }>(
      "SELECT COUNT(*) FILTER (WHERE status='active')::text AS active, COUNT(*) FILTER (WHERE status='recovered')::text AS recovered, COALESCE(SUM(subtotal) FILTER (WHERE status='active'),0)::text AS value FROM abandoned_carts",
    ),
    query("SELECT code, name, usage_count FROM discounts ORDER BY usage_count DESC, created_at DESC LIMIT 10"),
    query<{ refunds: string; refund_rate: string }>(
      "SELECT COUNT(*) FILTER (WHERE status='refunded')::text AS refunds, CASE WHEN COUNT(*) = 0 THEN '0' ELSE ROUND((COUNT(*) FILTER (WHERE status='refunded')::numeric / COUNT(*)::numeric) * 100, 2)::text END AS refund_rate FROM orders",
    ),
    query<{ upsell_conversion: string }>(
      "SELECT '0'::text AS upsell_conversion",
    ),
  ]);

  const orderCount = Number(totals[0]?.orders ?? 0);
  const activeAbandoned = Number(abandoned[0]?.active ?? 0);
  res.json({
    revenue: Number(totals[0]?.revenue ?? 0),
    orders: orderCount,
    conversion_rate: null,
    aov: Number(totals[0]?.aov ?? 0),
    repeat_customers: Number(repeat[0]?.repeat_customers ?? 0),
    ltv: Number(repeat[0]?.ltv ?? 0),
    top_products: products,
    abandoned_cart_rate: orderCount + activeAbandoned === 0 ? 0 : Number(((activeAbandoned / (orderCount + activeAbandoned)) * 100).toFixed(2)),
    abandoned_cart_value: Number(abandoned[0]?.value ?? 0),
    refund_rate: Number(refunds[0]?.refund_rate ?? 0),
    upsell_conversion: Number(upsells[0]?.upsell_conversion ?? 0),
    coupon_usage: coupons,
  });
});

router.get("/admin/abandoned-carts", requirePermission("orders:read"), async (_req, res) => {
  const rows = await query(
    `SELECT id::text, email, items, subtotal::text, status, recovery_email_count,
            last_reminder_at, created_at, updated_at
     FROM abandoned_carts
     ORDER BY updated_at DESC
     LIMIT 100`,
  );
  res.json(rows);
});

router.post("/admin/abandoned-carts/process-due", requirePermission("orders:read"), async (req, res) => {
  const due = await query<{
    id: string;
    email: string;
    cart_token: string;
    items: unknown[];
    subtotal: string;
  }>(
    `SELECT id::text, email, cart_token, items, subtotal::text
     FROM abandoned_carts
     WHERE status='active'
       AND email IS NOT NULL
       AND recovery_email_count < 3
       AND updated_at < NOW() - INTERVAL '60 minutes'
       AND (last_reminder_at IS NULL OR last_reminder_at < NOW() - INTERVAL '24 hours')
     ORDER BY updated_at ASC
     LIMIT 25`,
  );

  let sent = 0;
  for (const cart of due) {
    await sendAbandonedCartReminder({
      customerEmail: cart.email,
      recoveryUrl: `https://primeopp.com/cart?recover=${encodeURIComponent(cart.cart_token)}`,
      subtotal: Number(cart.subtotal),
      itemCount: Array.isArray(cart.items) ? cart.items.length : 0,
    });
    await query(
      "UPDATE abandoned_carts SET recovery_email_count=recovery_email_count + 1, last_reminder_at=NOW(), updated_at=NOW() WHERE id=$1",
      [cart.id],
    );
    sent += 1;
  }

  await createAuditLog({ req, action: "abandoned_cart_process_due", entityType: "abandoned_cart", after: { sent } });
  res.json({ processed: due.length, sent });
});

router.get("/admin/reviews", requirePermission("products:write"), async (_req, res) => {
  const rows = await query(
    `SELECT r.id::text, r.product_id, p.title AS product_title, r.customer_email, r.customer_name,
            r.rating, r.title, r.body, r.photo_url, r.is_verified_purchase, r.status,
            r.helpful_count, r.created_at
     FROM product_reviews r
     JOIN products p ON p.id = r.product_id
     ORDER BY r.created_at DESC
     LIMIT 200`,
  );
  res.json(rows);
});

router.patch("/admin/reviews/:id", requirePermission("products:write"), validateParams(idParamSchema), validateBody(reviewModerationSchema), async (req, res) => {
  const id = parsePositiveId(req.params.id);
  const { status } = req.body as { status: string };
  const before = await query("SELECT * FROM product_reviews WHERE id=$1", [id]);
  const rows = await query(
    `UPDATE product_reviews
     SET status=$1, moderated_at=NOW(), moderated_by=$2
     WHERE id=$3
     RETURNING *`,
    [status, req.adminUser?.id ?? null, id],
  );

  if (rows.length === 0) {
    res.status(404).json({ error: "Review not found" });
    return;
  }

  await createAuditLog({ req, action: "review_moderate", entityType: "product_review", entityId: id, before: before[0], after: rows[0] });
  res.json(rows[0]);
});

export default router;
