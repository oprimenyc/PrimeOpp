# PrimeOpp

Premium edgy streetwear e-commerce + affiliate marketing store. Black/red brutalist aesthetic. Built for real paying customers with print-on-demand fulfillment, Stripe payments, and order management.

---

## What It Is

- **Storefront** — product grid, individual product pages with size/color picker, cart, and Stripe checkout
- **Print-on-Demand** — POD products auto-fulfilled via Printful or Tapstitch after payment
- **Affiliate Section** — partner links that open in a new tab (you earn a commission)
- **Admin Panel** — full product CRUD, image uploads, order management at `/admin`
- **Order Emails** — branded HTML confirmation emails via Resend

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Backend | Express 5 + TypeScript (Node.js 24) |
| Database | PostgreSQL (Replit-managed) |
| Payments | Stripe Checkout (hosted) |
| Fulfillment | Printful API + Tapstitch API |
| Email | Resend |
| Auth | JWT (admin panel only) |
| Monorepo | pnpm workspaces |

---

## Architecture

```
Browser
  │
  ├── / (React + Vite frontend)
  │     src/pages/home.tsx          Hero carousel, product grids
  │     src/pages/product.tsx       Size picker, Add to Cart, Buy Now
  │     src/pages/cart.tsx          Cart summary, checkout button
  │     src/pages/order-success.tsx Post-payment confirmation
  │     src/pages/admin.tsx         Product manager (auth required)
  │     src/pages/admin-orders.tsx  Order list (auth required)
  │     src/pages/terms.tsx         Terms of Service
  │     src/pages/privacy.tsx       Privacy Policy
  │     src/lib/cart.ts             localStorage cart
  │     src/lib/api.ts              All API calls
  │
  └── /api (Express API server — port 8080)
        routes/products.ts          GET/POST/PUT/DELETE /api/products
        routes/orders.ts            Stripe checkout, webhook, order CRUD
        routes/auth.ts              Login + token verify
        routes/health.ts            GET /api/healthz
        lib/auth.ts                 JWT sign/verify, requireAdmin middleware
        lib/db.ts                   PostgreSQL connection pool
        lib/fulfillment.ts          Printful + Tapstitch order submission
        lib/email.ts                Resend confirmation email
```

**Payment flow:**
```
Customer clicks Buy Now
  → POST /api/checkout/session  (prices validated server-side)
  → Stripe Checkout page (hosted by Stripe)
  → Stripe calls POST /api/webhook
  → Order saved to DB
  → Auto-submitted to Printful or Tapstitch
  → Confirmation email sent via Resend
  → Customer redirected to /order-success
```

---

## Security

Security was a primary design concern. Here is every layer of protection:

### Authentication
- Admin panel protected by JWT tokens (7-day expiry)
- Credentials loaded from `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars — **not hardcoded**
- JWT signed with `JWT_SECRET` env var — required in production, no insecure fallback
- Token stored in `localStorage`; all admin API calls require `Authorization: Bearer <token>`

### Rate Limiting (`express-rate-limit`)
| Endpoint | Limit | Window | Purpose |
|---|---|---|---|
| `POST /api/auth/login` | 5 requests | 15 minutes / IP | Blocks brute-force attacks |
| `POST /api/checkout/session` | 15 requests | 1 hour / IP | Prevents Stripe API abuse |
| All other `/api/*` | 300 requests | 1 minute / IP | General DDoS protection |

### Payment Security
- **Server-side price validation** — product prices are looked up from the database before creating the Stripe session. The client-supplied price is always discarded and replaced with the authoritative DB price. It is impossible for a customer to manipulate the price they pay.
- Stripe Checkout handles all card data — PrimeOpp never sees or stores card numbers
- Stripe webhook signature verified using `STRIPE_WEBHOOK_SECRET` before processing any event
- In production, unverified webhook calls are rejected with HTTP 400 (no `STRIPE_WEBHOOK_SECRET` = hard fail)

### Input Validation
- Cart quantity: must be a whole number 1–20
- Cart items: max 20 line items per checkout session
- Order status updates: whitelisted to 9 valid values only
- All DB queries use parameterized statements — no SQL injection possible
- Request body capped at 100KB for public endpoints (12MB for admin image uploads)

### Security Headers (`helmet`)
Automatically sets on every API response:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (HSTS)
- `Referrer-Policy: no-referrer`
- `X-DNS-Prefetch-Control: off`
- `X-Download-Options: noopen`
- `X-Permitted-Cross-Domain-Policies: none`

### CORS
- Development: open (all origins)
- Production: set `ALLOWED_ORIGINS=https://primeopp.com` — requests from any other origin are rejected

### Database
- Connection pool: max 20 connections, 5s connect timeout, 10s query timeout
- Pool errors surface in server logs instead of crashing silently

### Error Handling
- Webhook DB failure logs a `CRITICAL` message with the Stripe session ID for manual recovery — customer is never left without an order record silently
- Fulfillment errors write an explicit `fulfillment_status` to the order row
- Missing variant IDs block fulfillment with a clear error instead of sending garbage to the POD API
- Internal error details are never leaked to API responses

---

## Environment Variables

Set all of these before going live. In Replit, add them under **Secrets**.

### Required for payments
| Variable | Description | Where to get it |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key | Stripe Dashboard → Developers → API Keys |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret | Stripe Dashboard → Developers → Webhooks → your endpoint |

### Required for fulfillment
| Variable | Description | Where to get it |
|---|---|---|
| `PRINTFUL_API_KEY` | Printful store API key | Printful Dashboard → Settings → API |
| `TAPSTITCH_API_KEY` | Tapstitch API key | Tapstitch Dashboard → API |

> Only set the provider(s) you actually use. Missing keys cause that provider to be skipped — orders are saved to the DB but not auto-fulfilled.

### Required for email
| Variable | Description | Where to get it |
|---|---|---|
| `RESEND_API_KEY` | Resend API key | Resend Dashboard → API Keys |
| `FROM_EMAIL` | Sender address (must be on a verified Resend domain) | e.g. `orders@primeopp.com` |

### Required for admin access (production)
| Variable | Description | Notes |
|---|---|---|
| `ADMIN_USERNAME` | Admin login username | Choose anything |
| `ADMIN_PASSWORD` | Admin login password | Use a strong password |
| `JWT_SECRET` | Token signing secret | Random 32+ character string |

### Optional
| Variable | Description | Default |
|---|---|---|
| `ALLOWED_ORIGINS` | Comma-separated allowed CORS origins | Open (all origins) |
| `PORT` | API server port | `8080` |

---

## Running Locally

Everything runs via the Replit workflows. Two services start automatically:

| Service | URL | Command |
|---|---|---|
| Frontend (Vite) | Preview pane `/` | `pnpm --filter @workspace/primeopp run dev` |
| API Server | port 8080 `/api` | `pnpm --filter @workspace/api-server run dev` |

The frontend proxies all `/api` calls to the API server automatically (configured in `vite.config.ts`).

---

## Admin Panel

Visit `/admin/login` in the store. Default dev credentials: `admin` / `primeopp2025`
(Override with `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars in production.)

### Adding a POD product
1. Set type → **Print-on-Demand**
2. Enter title, category, price, description
3. Upload or paste an image URL
4. Set sizes (comma-separated: `S, M, L, XL, XXL`)
5. Choose fulfillment provider: **Printful** or **Tapstitch**
6. Enter the **Sync Variant ID** from your Printful/Tapstitch dashboard (required for auto-fulfillment — see below)
7. Optionally add color variants with individual pricing
8. Save

### Adding an affiliate product
1. Set type → **Affiliate**
2. Enter title, price (display only), image, description
3. Paste your affiliate link (must include your ref/tracking parameter)
4. Save — clicking the product card opens the affiliate link in a new tab

### Viewing orders
Click **Orders** in the admin header. Orders show status, customer, items, total, and fulfillment status.

---

## Printful Setup (Auto-Fulfillment)

For each POD product to auto-fulfill via Printful:

1. Log in to [Printful](https://printful.com) and create a product in your store
2. Link it to a Printful catalog item (t-shirt, hoodie, etc.)
3. Go to **Stores → [your store] → Products → [your product] → Sync Variants**
4. Copy the **Sync Variant ID** (a number like `123456789`)
5. Paste it into the **Printful Sync Variant ID** field in the PrimeOpp admin for that product

Each size/color combination in Printful has its own Sync Variant ID. If you only have one variant (one color, all sizes share one ID), paste that one ID.

---

## Tapstitch Setup (Auto-Fulfillment)

1. Create a product in your Tapstitch dashboard
2. Copy the **Variant ID** from the product page
3. Paste it into the **Tapstitch Variant ID** field in the PrimeOpp admin

---

## Go-Live Checklist

Before publishing:

- [ ] `STRIPE_SECRET_KEY` set (use live key, not test key)
- [ ] `STRIPE_WEBHOOK_SECRET` set — register `https://your-domain/api/webhook` in Stripe Dashboard with event `checkout.session.completed`
- [ ] `PRINTFUL_API_KEY` set (if using Printful)
- [ ] `TAPSTITCH_API_KEY` set (if using Tapstitch)
- [ ] `RESEND_API_KEY` set; domain verified in Resend
- [ ] `FROM_EMAIL` set to a verified sender address
- [ ] `ADMIN_USERNAME` and `ADMIN_PASSWORD` set to real values
- [ ] `JWT_SECRET` set to a random 32+ character string
- [ ] `ALLOWED_ORIGINS` set to `https://primeopp.com`
- [ ] Every POD product has a Printful or Tapstitch Variant ID set
- [ ] `support@primeopp.com` inbox active (or updated in `home.tsx`, `terms.tsx`, `privacy.tsx`)
- [ ] `@primeopp` Instagram and TikTok accounts created (or links updated in `home.tsx`)
- [ ] Tested a full checkout end-to-end in Stripe test mode

---

## Database Schema

Two tables managed directly via PostgreSQL:

### `products`
| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `type` | text | `pod` or `affiliate` |
| `title` | text | |
| `description` | text | |
| `price` | numeric | Base price in USD |
| `category` | text | e.g. `Tees`, `Shoes` |
| `thumbnail_url` | text | URL or base64 data URI |
| `external_link` | text | Affiliate link |
| `stock_level` | integer | |
| `shipping_info` | text | |
| `colors` | jsonb | `[{name, hex, price}]` |
| `sizes` | jsonb | `["S","M","L","XL","XXL"]` |
| `pod_provider` | text | `printful` or `tapstitch` |
| `printful_variant_id` | text | Required for Printful auto-fulfillment |
| `tapstitch_variant_id` | text | Required for Tapstitch auto-fulfillment |
| `created_at` | timestamptz | |

### `orders`
| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `stripe_session_id` | text UNIQUE | Idempotency key |
| `stripe_payment_intent` | text | |
| `status` | text | `pending`, `paid`, `processing`, `fulfilled`, `shipped`, `delivered`, `refunded`, `cancelled`, `fulfillment_failed` |
| `customer_email` | text | |
| `customer_name` | text | |
| `shipping_address` | jsonb | `{name, line1, city, state, postal_code, country}` |
| `items` | jsonb | Array of cart items |
| `subtotal` | numeric | |
| `total` | numeric | Includes shipping |
| `fulfillment_provider` | text | `printful`, `tapstitch`, or comma-joined for mixed carts |
| `fulfillment_order_id` | text | POD provider's order ID |
| `fulfillment_status` | text | `submitted`, `skipped`, `blocked: missing variant IDs for N item(s)`, etc. |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

## Deployment

Click **Publish** in Replit. The platform handles TLS, health checks, and load balancing.

The production build runs:
- Frontend: Vite production build (static files)
- API: `tsx ./src/index.ts` (or the esbuild bundle via `npm run build`)

Make sure all environment variables are set under **Secrets** before publishing.

---

## Project Structure

```
artifacts/
├── api-server/
│   └── src/
│       ├── app.ts               Express app setup (helmet, CORS, rate limiting)
│       ├── index.ts             Entry point
│       ├── routes/
│       │   ├── auth.ts          POST /api/auth/login, GET /api/auth/verify
│       │   ├── health.ts        GET /api/healthz
│       │   ├── orders.ts        Stripe checkout + webhook + order CRUD
│       │   └── products.ts      Full product CRUD
│       └── lib/
│           ├── auth.ts          JWT logic + requireAdmin middleware
│           ├── db.ts            PostgreSQL pool
│           ├── email.ts         Resend order confirmation
│           └── fulfillment.ts   Printful + Tapstitch submission
└── primeopp/
    └── src/
        ├── App.tsx              Routes
        ├── components/
        │   ├── Navbar.tsx       Top bar with cart count badge
        │   └── ProductCard.tsx  Product grid card
        ├── lib/
        │   ├── api.ts           All fetch calls to API
        │   └── cart.ts          localStorage cart management
        └── pages/
            ├── home.tsx         Homepage (hero, grids, brand section, footer)
            ├── product.tsx      Product detail (size picker, quantity, add to cart)
            ├── cart.tsx         Cart page
            ├── order-success.tsx Post-payment success
            ├── admin-login.tsx  Admin login form
            ├── admin.tsx        Product manager
            ├── admin-orders.tsx Order list
            ├── terms.tsx        Terms of Service
            ├── privacy.tsx      Privacy Policy
            └── not-found.tsx    404 page
```
