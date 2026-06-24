# PrimeOpp — Production Readiness Audit

> **Audit Date:** 2026-06-24  
> **Auditor Roles:** Principal Software Architect · Security Engineer · DevOps Engineer · QA Lead · E-Commerce Auditor  
> **Codebase reviewed:** All source files in `artifacts/api-server/src/` and `artifacts/primeopp/src/`

---

## Scores

| Dimension | Score | Grade |
|---|---|---|
| **A) Production Readiness** | **54 / 100** | D+ |
| **B) Security** | **63 / 100** | C |
| **C) Scalability** | **36 / 100** | F |
| **D) Conversion** | **51 / 100** | D |
| **E) Admin Backend** | **47 / 100** | D |

---

## Deployment Blockers Summary

Issues rated **Critical** or **High** must be resolved before going live.

| # | Severity | Issue |
|---|---|---|
| 1 | 🔴 CRITICAL | Stripe metadata 500-char limit silently truncates cart — orders lost after payment |
| 2 | 🔴 CRITICAL | No product field validation — stored XSS and negative price possible |
| 3 | 🔴 CRITICAL | Admin JWT stored in `localStorage` — stolen by any XSS on the domain |
| 4 | 🔴 CRITICAL | Dev fallback credentials hardcoded in source code |
| 5 | 🟠 HIGH | No fulfillment retry — one network error = permanently unfulfilled order |
| 6 | 🟠 HIGH | No DB indexes — queries degrade to full table scans as data grows |
| 7 | 🟠 HIGH | `GET /checkout/session/:id` exposes customer PII to anyone who knows the URL |
| 8 | 🟠 HIGH | No cookie consent banner — GDPR/CCPA legal violation before first visitor |
| 9 | 🟠 HIGH | Synchronous fulfillment in webhook — 30s Stripe timeout risk under load |
| 10 | 🟠 HIGH | No monitoring or alerting — CRITICAL webhook failures are invisible in production |

---

## 1. Frontend

### 1.1 UX

**MEDIUM — "Buy Now" doesn't skip the cart**
- Description: `handleBuyNow()` calls `handleAddToCart()` then navigates to `/cart`. The customer still has to click Checkout. A true Buy Now creates a Stripe session immediately.
- Risk: Conversion drop. Users expect Buy Now = 1-click payment.
- Fix:
  ```typescript
  async function handleBuyNow() {
    if (!canAddToCart || !product) return;
    setLoading(true);
    try {
      const item: CartItem = { /* ... */ };
      const { url } = await createCheckoutSession([item]);
      window.location.href = url;
    } catch { /* show error */ }
  }
  ```

**LOW — Cart quantity UI cap (10) doesn't match API cap (20)**
- `product.tsx` line 224: `Math.min(10, q + 1)` — but the API accepts up to 20.
- Fix: Align both to the same value. Recommend 10 everywhere.

**LOW — No loading skeleton states**
- Text "LOADING PRODUCTS..." flashes on every page load. Skeleton cards improve perceived performance and trust.

---

### 1.2 Accessibility

**MEDIUM — Color picker buttons have no accessible label**
- File: `product.tsx` line 193–209
- Reproduction: Screen reader user cannot identify color options — only a `title` attribute is set (not read by all screen readers).
- Fix:
  ```tsx
  <button aria-label={`Select color ${color.name} — $${color.price.toFixed(2)}`} ...>
  ```

**MEDIUM — No skip navigation link**
- Users navigating by keyboard must tab through the entire Navbar before reaching content.
- Fix: Add `<a href="#main-content" className="sr-only focus:not-sr-only">Skip to main content</a>` as first element in `App.tsx`.

**MEDIUM — Carousel dots have no accessible label**
- `home.tsx` line 59: `<button key={i} onClick={() => switchTo(i)} ...>`
- Fix: `aria-label={`Go to slide ${i + 1}`}`

**LOW — Low color contrast on zinc-500 text**
- `#71717a` on `#000000` = 5.7:1 (passes AA) but `#3f3f46` (zinc-700) on black fails AA at 3.1:1.
- Fix: Audit all `text-zinc-700` labels and raise to zinc-500 minimum.

---

### 1.3 SEO

**HIGH — No page `<title>` tags, no meta descriptions, no Open Graph**
- Every page serves the same default Vite title.
- Risk: Google indexes nothing useful. Social shares show no preview.
- Fix: Add `react-helmet-async` and set per-page meta.

```tsx
// product.tsx
import { Helmet } from "react-helmet-async";
<Helmet>
  <title>{product.title} — PrimeOpp</title>
  <meta name="description" content={product.description ?? `Buy ${product.title} at PrimeOpp`} />
  <meta property="og:image" content={product.thumbnail_url ?? ""} />
</Helmet>
```

**HIGH — No `robots.txt` or `sitemap.xml`**
- Risk: Googlebot crawls admin pages; product pages may not be indexed.
- Fix: Create `artifacts/primeopp/public/robots.txt`:
  ```
  User-agent: *
  Disallow: /admin
  Sitemap: https://primeopp.com/sitemap.xml
  ```

**MEDIUM — No JSON-LD structured data for products**
- Risk: No rich product snippets (star ratings, price) in Google search results.
- Fix: Inject `<script type="application/ld+json">` on each product page with `Product` schema.

**LOW — SPA with no SSR**
- Product pages require JS execution for content. Google handles this today but it is an inherent risk for indexing speed.

---

### 1.4 Performance

**MEDIUM — No image optimization**
- Base64 images stored in the DB are returned inline in product JSON. A single product list response can be multiple megabytes.
- Risk: Slow first load, mobile abandonment, Core Web Vitals penalty.
- Fix: Move to object storage (Replit App Storage or S3). Return URLs, not base64 blobs. Add `loading="lazy"` on product images.

**LOW — No API response caching**
- Product list fetched on every page load with no `Cache-Control` header.
- Fix: Add `res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60")` on `GET /api/products`.

---

### 1.5 Conversion

**HIGH — No analytics or conversion tracking**
- No Google Analytics, no Meta Pixel, no Stripe Radar events.
- Risk: Cannot measure funnel drop-off, optimize ads, or identify checkout abandonment.
- Fix: Add GA4 or Plausible with custom events on `add_to_cart`, `begin_checkout`, `purchase`.

**MEDIUM — No social proof (reviews / ratings)**
- Trust is critical for new stores. No reviews, no star ratings, no "X people bought this."

**LOW — No discount code support**
- Stripe Checkout natively supports promotion codes. Enable with `allow_promotion_codes: true` in the session create params.

---

## 2. Backend

### 2.1 API Architecture

**MEDIUM — No API versioning**
- All routes at `/api/*`. Any breaking change requires coordinated frontend + backend deploy.
- Fix: Add `/api/v1/` prefix now before you have paying customers who depend on the API.

**MEDIUM — `GET /orders/:id` passes unvalidated string to SQL**
- File: `orders.ts` line 354
- Reproduction: `GET /api/orders/'; DROP TABLE orders;--` — parameterized query prevents injection, but returns a DB cast error instead of a clean 400.
- Fix: 
  ```typescript
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid order ID" }); return; }
  ```

**LOW — No pagination**
- `GET /products` — no LIMIT at all. 10,000 products = 10MB response.
- `GET /orders LIMIT 200` — page 2 is inaccessible.
- Fix: Add `?limit=50&offset=0` query params.

---

### 2.2 Authentication

**🔴 CRITICAL — JWT stored in `localStorage`**
- File: `api.ts` line 148, `auth.ts` line 43
- Risk: Any XSS vulnerability on the domain (third-party scripts, injected ads, future bugs) can exfiltrate the admin token. The attacker then has full admin access for 7 days.
- Fix: Use `httpOnly` cookies set by the server. The browser automatically attaches them to requests and JavaScript cannot read them.

```typescript
// Server: set cookie instead of returning token in JSON
res.cookie("admin_token", token, {
  httpOnly: true,
  secure: isProduction,
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
res.json({ ok: true });

// requireAdmin: read from cookie instead of Authorization header
const token = req.cookies?.admin_token;
```

**🔴 CRITICAL — Dev fallback credentials in source code**
- File: `auth.ts` lines 14, 23, 33
- The strings `"admin"`, `"primeopp2025"`, and `"primeopp-dev-secret-CHANGE-IN-PRODUCTION"` are committed to source code.
- Risk: If the repository is ever made public (or leaked), these become the default credentials for any misconfigured deployment.
- Fix: Remove all fallbacks. In dev, require a `.env` file with a clear error message if missing:
  ```typescript
  function getAdminPassword(): string {
    const val = process.env["ADMIN_PASSWORD"];
    if (!val) throw new Error("ADMIN_PASSWORD env var is required. Create a .env file.");
    return val;
  }
  ```

**MEDIUM — No token revocation**
- If an admin JWT is stolen, it is valid for 7 days with no way to invalidate it.
- Fix: Store a `token_version` integer in the DB per admin user. Include it in the JWT payload. On `requireAdmin`, verify `token_version` matches the DB. Increment on logout/password change to invalidate all existing tokens.

**LOW — No 2FA for admin**
- TOTP (Google Authenticator) would provide significant protection given the single-account design.

---

### 2.3 Validation

**🔴 CRITICAL — No product field validation on POST/PUT `/products`**
- File: `products.ts` lines 30–62
- Reproduction: 
  ```bash
  curl -X POST /api/products -H "Authorization: Bearer <token>" \
    -d '{"type":"pod","title":"<script>alert(1)</script>","price":-99.99}'
  ```
- Risk: Stored XSS in product titles/descriptions. Negative prices charged to POD provider. Unbounded string lengths bloating DB.
- Fix: Add Zod validation before DB insert:
  ```typescript
  import { z } from "zod";
  const ProductSchema = z.object({
    type: z.enum(["pod", "affiliate"]),
    title: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    price: z.number().positive().max(9999),
    // ...
  });
  const parsed = ProductSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.format() }); return; }
  ```

**MEDIUM — No integer validation on route params**
- `GET /products/:id`, `GET /orders/:id`, `PATCH /orders/:id/status` all pass `req.params.id` (a string) directly to parameterized queries.
- While SQL injection is prevented by parameterization, it causes confusing 500 errors from PostgreSQL's type cast failure rather than a clean 400.

---

### 2.4 Rate Limiting

**MEDIUM — In-memory rate limits reset on server restart**
- `express-rate-limit` uses an in-memory store by default.
- Risk: Restarting the server resets all counters. An attacker can trigger a restart (e.g., crash it) then immediately retry brute-force.
- Fix: Use `rate-limit-redis` with an external Redis instance, or Replit's KV store.

---

## 3. POD Operations

### 3.1 Fulfillment Workflow

**🟠 HIGH — No retry logic for fulfillment failures**
- File: `fulfillment.ts`, `orders.ts` lines 286–308
- If the Printful or Tapstitch API returns a 5xx or times out, `fulfillment_status` is set to `"request_failed"` and nothing ever retries.
- Risk: Customer paid, receives no item, store owner doesn't know unless they check the admin panel.
- Fix: Implement a retry queue. Simplest approach: a `cron`-style job that queries `WHERE fulfillment_status LIKE 'failed%' AND created_at > NOW() - INTERVAL '48 hours'` and re-submits. Or use a proper queue (BullMQ + Redis).

**🟠 HIGH — Fulfillment is synchronous inside the Stripe webhook**
- File: `orders.ts` lines 286–308
- Stripe webhooks timeout after 30 seconds. If Printful's API is slow (large order, high traffic), the webhook can time out. Stripe then retries the webhook, potentially creating duplicate fulfillment orders.
- Fix: After saving the order to DB, immediately return 200 to Stripe, then trigger fulfillment asynchronously (setImmediate, a job queue, or a separate worker).

**MEDIUM — No inbound webhooks from Printful/Tapstitch**
- Order status never updates automatically. Admin must manually change status from "processing" → "shipped" → "delivered."
- Fix: Register a webhook URL with Printful (`order_updated` event) and update order status automatically.

**LOW — No fulfillment retry button in admin panel**
- Admin has no way to manually re-trigger fulfillment for a failed order from the UI.

---

### 3.2 Webhook Handling

**🔴 CRITICAL — Stripe metadata value limit: 500 characters**
- File: `orders.ts` line 147: `metadata: { items: JSON.stringify(items) }`
- Stripe enforces a **500 character maximum per metadata value**. A cart with 3 items easily exceeds this.
- Reproduction: Add 3 products to cart. JSON of items array: `[{"product_id":1,"title":"Premium Drop Hoodie Black","quantity":2,"size":"XL","color":"Jet Black","price":89.99,"pod_provider":"printful","printful_variant_id":"123456789","tapstitch_variant_id":null},...]` — this alone is ~200+ chars per item.
- Risk: **SILENT DATA LOSS.** Stripe silently truncates the metadata value. The webhook receives malformed JSON. `items` parses as `[]`. Order saved to DB with no items. Fulfillment skipped. Customer charged, nothing ships.
- Fix: Store a pending order in your DB **before** creating the Stripe session, then use the order ID as metadata:

```typescript
// 1. Save a "pending" order to DB with items
const [pendingOrder] = await query(
  "INSERT INTO orders (status, items, subtotal) VALUES ('pending', $1, $2) RETURNING id",
  [JSON.stringify(items), subtotal]
);

// 2. Store only the order ID in Stripe metadata (fits in 500 chars)
const session = await stripe.checkout.sessions.create({
  // ...
  metadata: { order_id: String(pendingOrder.id) },
});

// 3. In webhook: look up order by ID, update status to 'paid'
const orderId = Number(session.metadata?.order_id);
await query("UPDATE orders SET status='paid', stripe_session_id=$1, ... WHERE id=$2",
  [session.id, orderId]);
```

---

## 4. Admin Backend

### 4.1 Dashboard

**MEDIUM — No analytics on dashboard**
- Admin sees product list. No: total revenue, orders today, fulfillment failure rate, top products.
- Fix: Add a summary bar: `SELECT COUNT(*), SUM(total), status FROM orders GROUP BY status`.

**MEDIUM — Orders capped at 200 with no pagination**
- File: `orders.ts` line 344: `LIMIT 200`
- Fix: `?page=1&limit=50` with `OFFSET`.

### 4.2 Audit Logging

**MEDIUM — No audit log for admin actions**
- No record of who deleted a product, changed an order status, or logged in from where.
- Risk: If credentials are compromised, there is no forensic trail.
- Fix: Create an `audit_log` table: `(id, action, entity_type, entity_id, actor_ip, created_at)`. Log every admin mutation.

### 4.3 Security Controls

**MEDIUM — No image type validation on admin upload**
- File: `products.ts` — `thumbnail_url` accepts any string, including `javascript:` URIs or `data:text/html` payloads.
- Fix: Validate base64 uploads begin with `data:image/(jpeg|png|webp|gif);base64,` before storing.

---

## 5. Security

### 5.1 OWASP Top 10 Assessment

| # | Vulnerability | Status | Details |
|---|---|---|---|
| A01 | Broken Access Control | ⚠️ PARTIAL | Session endpoint exposes PII; no ownership check |
| A02 | Cryptographic Failures | ⚠️ PARTIAL | JWT in localStorage; HTTPS handled by Replit |
| A03 | Injection | ⚠️ PARTIAL | SQL: ✅ parameterized. XSS: ❌ no input sanitization |
| A04 | Insecure Design | ⚠️ PARTIAL | Metadata limit, webhook sync fulfillment |
| A05 | Security Misconfiguration | ✅ GOOD | Helmet, CORS, rate limits all present |
| A06 | Vulnerable Components | ❓ UNKNOWN | No `npm audit` run |
| A07 | Auth Failures | ⚠️ PARTIAL | Rate limiting ✅; localStorage JWT ❌ |
| A08 | Data Integrity | ✅ GOOD | Webhook signature verification |
| A09 | Logging/Monitoring | ❌ FAIL | Console logs only, no alerting |
| A10 | SSRF | ✅ GOOD | No user-controlled URLs in server-side fetch |

### 5.2 Information Disclosure — Session Endpoint

**🟠 HIGH — `GET /api/checkout/session/:id` leaks customer PII**
- File: `orders.ts` lines 159–179
- Reproduction: Any person who finds a `session_id` in a browser URL bar or server log can call `GET /api/checkout/session/cs_live_xxxxx` and receive the customer's email, name, and shipping total.
- Risk: Privacy violation. Customer PII accessible without authentication.
- Fix: Make this endpoint admin-only, OR only return a `status: "paid" | "unpaid"` flag without PII. The success page only needs to know the order was paid — it doesn't need to display the customer's email from the API.

### 5.3 XSS

**🔴 CRITICAL — No input sanitization on product fields**
- See Section 2.3 above. React escapes on render, which prevents reflected XSS for most cases. However:
  - The email template in `email.ts` uses `${data.customerName}` directly in a template literal. `customerName` comes from Stripe and is safe in practice, but product title/description are stored and displayed via React, which does escape. The actual high risk is **future code using `dangerouslySetInnerHTML`** or **admin actions** that bypass React's escaping (e.g., populating an email with a crafted product title).
  - Validate inputs now to prevent the problem from existing at all.

### 5.4 Dependency Audit

**MEDIUM — No `npm audit` in CI or pre-deploy**
- Run: `pnpm audit` to check for known vulnerabilities.
- Fix: Add to go-live checklist. Set up `pnpm audit --audit-level=high` in your deploy pipeline.

---

## 6. Infrastructure

### 6.1 Monitoring & Alerting

**🟠 HIGH — No monitoring or alerting**
- When `[Webhook] CRITICAL: Failed to save order to DB` fires, nobody knows.
- When the server goes down, nobody knows.
- Fix options (in order of effort):
  1. **Sentry** (free tier) — catches unhandled errors with stack traces, alerts via email/Slack
  2. **UptimeRobot** (free) — pings `/api/healthz` every 5 minutes, alerts if down
  3. **Logtail / Betterstack** — structured log shipping and alerting rules

Minimum viable monitoring before launch:
```typescript
// Replace console.error("[Webhook] CRITICAL:...") with:
async function alertCritical(message: string, context: object) {
  console.error("[CRITICAL]", message, context);
  // POST to Slack webhook or Sentry.captureException(...)
}
```

### 6.2 Backups

**MEDIUM — No documented backup strategy**
- Replit's PostgreSQL may have point-in-time recovery but this is not confirmed.
- Fix: Before going live, confirm Replit's backup policy. Set up a nightly `pg_dump` to object storage as an additional safety net.

### 6.3 Caching

**MEDIUM — No caching layer**
- Every product page load hits the DB. Every admin dashboard load hits the DB.
- Fix short-term: Cache-Control headers on `GET /products` (30s max-age).
- Fix long-term: Redis or Replit KV for product catalog (invalidate on admin update).

### 6.4 CDN

**MEDIUM — No CDN for product images**
- Product images are either base64-encoded (served inline in JSON, huge) or external URLs (third-party availability dependency).
- Fix: Use Replit Object Storage or Cloudflare R2 for images. Return a CDN URL from the API.

### 6.5 Scalability

**LOW — In-memory rate limiting won't scale horizontally**
- If Replit ever runs two instances, each has separate counters. An attacker can make 5 requests to instance A and 5 to instance B for 10 total login attempts at the "5 per 15 min" limit.
- Fix: Use Redis-backed rate limiting (`rate-limit-redis`).

---

## 7. Database

### 7.1 Missing Indexes

**🟠 HIGH — No indexes on critical query columns**
- Reproduction: After 10,000 orders, `SELECT * FROM orders WHERE stripe_session_id = $1` becomes a full table scan.
- Fix — run these migrations before go-live:

```sql
-- Webhook idempotency lookup (currently relies on UNIQUE constraint which does create an index, but let's be explicit)
-- Already has UNIQUE → implicitly indexed ✅

-- Admin order list sorted by date
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);

-- Filter by status
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);

-- Customer lookup
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders (customer_email);

-- Product type filter (home page renders POD vs affiliate separately)
CREATE INDEX IF NOT EXISTS idx_products_type ON products (type);

-- Product listing by date
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products (created_at DESC);
```

### 7.2 Schema Integrity

**MEDIUM — No DB-level constraints on critical fields**
- `products.type` can be `NULL` or any string at DB level. App checks `!type` but a direct DB insert bypasses this.
- Fix:
  ```sql
  ALTER TABLE products ADD CONSTRAINT products_type_check 
    CHECK (type IN ('pod', 'affiliate'));
  ALTER TABLE products ALTER COLUMN type SET NOT NULL;
  ALTER TABLE products ALTER COLUMN title SET NOT NULL;
  ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN ('pending','paid','processing','fulfilled',
                      'shipped','delivered','refunded','cancelled','fulfillment_failed'));
  ```

**MEDIUM — `SELECT *` on all queries**
- Fetches `thumbnail_url` (potentially megabytes of base64) even when only `id` and `type` are needed.
- Fix: `SELECT id, type, title, price, category` on list endpoints. `SELECT *` only on detail pages.

### 7.3 Transactional Consistency

**MEDIUM — Webhook flow is not transactional**
- Steps: (1) save order → (2) fulfill → (3) email are three separate DB operations.
- If the process crashes between steps 1 and 2, the order exists in DB as "paid" but fulfillment never ran.
- The `fulfillment_status` field captures this, but there is no automatic recovery.
- Fix: After implementing async fulfillment (see 3.1), a job queue with retry handles this naturally.

---

## 8. Payments

### 8.1 Webhook Events

**MEDIUM — Only `checkout.session.completed` handled**
- Stripe fires many other relevant events with no handler:
  - `charge.refunded` — update order status to "refunded"
  - `payment_intent.payment_failed` — mark order as failed
  - `charge.dispute.created` — chargeback alert
- Fix: Add handlers for these events. At minimum, handle `charge.refunded` so orders show correct status.

### 8.2 Refunds

**MEDIUM — No refund endpoint or UI**
- Admin cannot issue a refund from the admin panel. Must log into Stripe dashboard manually.
- Fix: Add `POST /api/orders/:id/refund` (admin only):
  ```typescript
  await stripe.refunds.create({ payment_intent: order.stripe_payment_intent });
  await query("UPDATE orders SET status='refunded' WHERE id=$1", [id]);
  ```

### 8.3 Fraud Prevention

**LOW — Stripe Radar not configured**
- Stripe Radar provides ML-based fraud scoring for free. Enable custom rules for: block free email domains on high-value orders, flag velocity (same card multiple orders in 1 hour), geographic mismatch.

---

## 9. Compliance

### 9.1 GDPR / CCPA

**🟠 HIGH — No cookie consent banner**
- If any tracking (analytics, social pixels) is ever added — even a Google Analytics tag — GDPR requires prior consent.
- Even without tracking, GDPR requires disclosure that cookies are used if localStorage is used (cart, JWT token).
- Fix: Add a consent banner before launch. Use `react-cookie-consent` (2KB, no dependencies).

**MEDIUM — No data deletion / export mechanism**
- GDPR Article 17 (right to erasure) and Article 20 (right to portability) require you to respond to user requests to delete or export their data within 30 days.
- Fix: Document your manual process. For an e-commerce store this size, a support email (`support@primeopp.com`) and manual DB query is legally acceptable, but must be documented in the privacy policy.

**MEDIUM — Privacy policy placeholder emails**
- `support@primeopp.com` appears in 5 places. This inbox must be active before launch — GDPR requires a working data subject request channel.

**LOW — No data retention policy**
- Orders contain customer PII (name, email, shipping address) stored indefinitely.
- Fix: Add a policy to the Privacy page: "We retain order data for 7 years for legal/tax purposes." Configure a DB job to anonymize orders older than 7 years.

### 9.2 PCI DSS

✅ **COMPLIANT** — Using Stripe Checkout (hosted payment page). This puts PrimeOpp in **SAQ A** scope — the minimal PCI compliance tier. Card data never touches PrimeOpp's servers.

---

## Prioritized Fix List

### Must Fix Before Launch (Blockers)

| Priority | Fix | Effort |
|---|---|---|
| 1 | Fix Stripe metadata limit — store pending order in DB before session creation | 3h |
| 2 | Add Zod validation to POST/PUT `/api/products` | 2h |
| 3 | Move JWT to httpOnly cookie (or at minimum document the XSS risk) | 4h |
| 4 | Remove hardcoded fallback credentials from `auth.ts` | 30min |
| 5 | Add DB indexes (6 CREATE INDEX statements) | 30min |
| 6 | Make `GET /checkout/session/:id` auth-required or strip PII | 30min |
| 7 | Add cookie consent banner | 1h |
| 8 | Make fulfillment async (return 200 to Stripe, then fulfill) | 2h |
| 9 | Add Sentry (error monitoring) + UptimeRobot (uptime monitoring) | 1h |
| 10 | Add meta titles, descriptions, OG tags per page | 3h |

### Fix in First 2 Weeks Post-Launch

| Priority | Fix | Effort |
|---|---|---|
| 11 | Implement fulfillment retry job (cron every 15min for failed orders) | 4h |
| 12 | Fix "Buy Now" to create Stripe session directly | 2h |
| 13 | Add integer validation on all route params | 1h |
| 14 | Add `charge.refunded` webhook handler + refund endpoint | 2h |
| 15 | Add `robots.txt` and `sitemap.xml` | 1h |
| 16 | Image type validation on admin upload | 30min |
| 17 | `SELECT *` → explicit column lists on list endpoints | 2h |
| 18 | Add pagination to `/products` and `/orders` | 2h |
| 19 | Add basic analytics (Plausible or GA4) | 2h |
| 20 | DB schema constraints (NOT NULL, CHECK constraints) | 1h |

### Nice to Have (Month 1–2)

- Admin analytics dashboard (revenue, order count, fulfillment rate)
- Inbound Printful/Tapstitch webhooks (auto-update tracking)
- Redis-backed rate limiting + caching
- TOTP 2FA for admin
- Discount/coupon code support via Stripe
- Audit log table for admin actions
- Product reviews / social proof
- Email cart abandonment recovery
- API versioning (`/api/v1/`)

---

## What Is Working Well

It's worth documenting what was done correctly — this is a real foundation:

- ✅ **Server-side price validation** — client prices are always discarded and overwritten from DB
- ✅ **Stripe webhook signature verification** with hard production fail-safe
- ✅ **All SQL queries parameterized** — no SQL injection surface
- ✅ **Idempotent order creation** — `ON CONFLICT` prevents duplicate charges
- ✅ **Rate limiting** on login (5/15min), checkout (15/hr), public API (300/min)
- ✅ **Helmet security headers** on every response
- ✅ **CORS restricted** to configured origins in production
- ✅ **No hardcoded Stripe keys** — graceful degradation if env vars missing
- ✅ **Fulfillment blocked** when variant IDs are missing (prevents garbage submissions to Printful/Tapstitch)
- ✅ **DB pool configured** with explicit limits and timeout values
- ✅ **Legal pages** (Terms, Privacy) exist
- ✅ **Cart bounds** validated server-side (quantity 1–20, max 20 items)
- ✅ **Order status whitelist** prevents arbitrary status injection
