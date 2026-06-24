# PrimeOpp — Phase 2 Audit: Operations & Enterprise Admin Review

> **Audit Date:** 2026-06-24  
> **Scope:** Internal business operations, fulfillment management, staff workflows, long-term scalability  
> **Basis:** Full codebase review + Phase 1 Production Readiness Audit  
> **Auditor Roles:** Principal Software Architect · DevOps Engineer · E-Commerce Operations Specialist

---

## Operational Scores

| Dimension | Score | Grade |
|---|---|---|
| **Operations** | **8 / 100** | F |
| **Fulfillment Reliability** | **22 / 100** | F |
| **Support Readiness** | **5 / 100** | F |
| **Finance Controls** | **0 / 100** | F |
| **Disaster Recovery** | **3 / 100** | F |

**Honest assessment:** PrimeOpp currently has a single admin user with one screen for product CRUD and one screen for a raw order list. None of the enterprise operational infrastructure evaluated in this audit exists. The scores above reflect that reality — not poor implementation, but the complete absence of these systems.

This is normal for a new platform. The purpose of this audit is to define what must exist at each scale threshold.

---

## 1. Operations Portal & Role-Based Access Control (RBAC)

### Current State

**Gap: No RBAC exists.** There is a single role — `admin` — with a single shared credential set (`ADMIN_USERNAME` / `ADMIN_PASSWORD`). Every person with access has identical, unrestricted permissions.

### Required Roles (Gap Analysis)

| Role | Description | Currently Exists |
|---|---|---|
| Super Admin | Full system access, security settings, user management | ❌ Merged into single admin |
| Admin | Product management, pricing, all orders | ❌ This is the current "admin" |
| Operations Manager | Fulfillment queue, provider management, no pricing | ❌ |
| Fulfillment Agent | View + action on fulfillment queue only | ❌ |
| Customer Support | Read orders, issue refunds (within limit), add notes | ❌ |
| Marketing Manager | Product visibility, analytics, no order data | ❌ |
| Finance | Revenue reports, refunds, chargebacks, no operational data | ❌ |

### Permission Matrix (What Needs Enforcing)

| Action | Super Admin | Admin | Ops Manager | Fulfillment | Support | Marketing | Finance |
|---|---|---|---|---|---|---|---|
| Change security settings | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage user roles | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Edit product pricing | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Delete products | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View all orders | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Issue refunds | ✅ | ✅ | ❌ | ❌ | ✅ (≤$50) | ❌ | ✅ |
| Retry fulfillment | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Reassign provider | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View financial reports | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| View customer PII | ✅ | ✅ | ✅ | ❌ | ✅ (masked) | ❌ | ❌ |
| Modify order status | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

### Role Escalation Vulnerabilities

**🔴 CRITICAL — Entire permission system is flat**
- All authenticated admin sessions have identical authority.
- A shared password means credential rotation requires coordinating every person with access.
- No principle of least privilege enforced anywhere.

### Recommended Implementation

Replace the single-credential JWT system with a user table:

```sql
CREATE TABLE admin_users (
  id          SERIAL PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,       -- bcrypt, not plaintext
  role        TEXT NOT NULL CHECK (role IN (
    'super_admin','admin','ops_manager',
    'fulfillment_agent','support','marketing','finance'
  )),
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  last_login  TIMESTAMPTZ
);
```

JWT payload becomes: `{ user_id, role, iat, exp }`. Middleware checks role against a permission map per endpoint.

---

## 2. Artwork Review System

### Current State

**Gap: No artwork review system exists.** Products are published immediately when an admin saves them. There is no moderation workflow of any kind.

### Missing Functionality

| Feature | Status | Risk Without It |
|---|---|---|
| Pending review queue | ❌ | Any artwork goes live instantly |
| Approve / Reject actions | ❌ | No moderation gate |
| Request customer changes | ❌ | No communication loop |
| Internal review notes | ❌ | No reviewer collaboration |
| Artwork status history | ❌ | No audit trail |
| Re-review workflow | ❌ | Can't escalate edge cases |
| Bypass prevention | ❌ | Products can enter production with no review |

### Why This Matters for POD Specifically

A POD platform that accepts uploaded designs **must** moderate for:
- Copyright / trademark infringement (printing a Nike logo = legal liability)
- NSFW / prohibited content (Printful and Tapstitch both have acceptable use policies)
- Print quality issues (low-DPI images produce complaints)

### Recommended Schema

```sql
CREATE TYPE artwork_status AS ENUM (
  'pending','approved','rejected','changes_requested','re_review'
);

ALTER TABLE products ADD COLUMN artwork_status artwork_status DEFAULT 'pending';
ALTER TABLE products ADD COLUMN artwork_notes TEXT; -- internal reviewer notes

CREATE TABLE artwork_review_log (
  id          SERIAL PRIMARY KEY,
  product_id  INTEGER REFERENCES products(id),
  reviewer_id INTEGER REFERENCES admin_users(id),
  action      artwork_status NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**Gate at fulfillment:** In `fulfillment.ts`, add:
```typescript
if (item.artwork_status !== 'approved') {
  return { status: 'blocked: artwork not approved' };
}
```

---

## 3. Fulfillment Operations Dashboard

### Current State

**Gap: No fulfillment dashboard exists.** The admin order list shows raw database rows with no operational tools. Failed fulfillments are visible only as a text string in a `fulfillment_status` column.

### Missing Functionality

| Feature | Status | Risk Without It |
|---|---|---|
| Fulfillment queue (grouped by provider) | ❌ | No at-a-glance operational view |
| Failed fulfillment queue | ❌ | Failures buried in order list |
| Retry fulfillment button | ❌ | Manual DB intervention required |
| Reassign fulfillment provider | ❌ | Stuck if one provider is down |
| Production status tracking | ❌ | No visibility post-submission |
| Shipping exception tracking | ❌ | Returns/lost packages invisible |
| Supplier outage monitoring | ❌ | No early warning system |

### Failed Fulfillment Recovery

Currently: When Printful returns a 5xx error, `fulfillment_status` = `"request_failed"`. No notification. No retry. The order sits in the DB with a failed status until someone manually queries for it.

At 100 orders/day, this is a guarantee that some percentage of orders will never ship without manual intervention.

**Minimum viable fix — Retry Endpoint:**
```typescript
// POST /api/orders/:id/retry-fulfillment (admin only)
router.post("/orders/:id/retry-fulfillment", requireAdmin, async (req, res) => {
  const order = await query("SELECT * FROM orders WHERE id=$1", [id]);
  const results = await fulfillOrder(order.items, order.shipping_address, order.customer_email);
  await query("UPDATE orders SET fulfillment_status=$1 WHERE id=$2", [results[0].status, id]);
  res.json({ results });
});
```

### Duplicate Fulfillment Prevention

Currently: If the Stripe webhook fires twice (Stripe retries on timeout), `ON CONFLICT (stripe_session_id) DO UPDATE` prevents duplicate order rows. However, fulfillment runs every time the webhook fires — so two Stripe webhook deliveries = two fulfillment submissions = two packages shipped = double cost.

**Fix:** Check `fulfillment_status` before submitting:
```typescript
if (order.fulfillment_status === 'submitted') {
  console.warn('[Webhook] Fulfillment already submitted for order', orderId, '— skipping duplicate');
  return;
}
```

---

## 4. Customer Service Console

### Current State

**Gap: No customer service tools exist.** The admin panel has an order list. That is all.

### Missing Functionality

| Feature | Status | Risk Without It |
|---|---|---|
| Customer lookup by email | ❌ | Support must scroll order list |
| Order lookup by ID | ❌ | No direct search |
| Conversation history | ❌ | No internal comms log |
| Refund request handling | ❌ | Manual Stripe dashboard |
| Replacement order creation | ❌ | Manual re-entry |
| Shipping issue management | ❌ | No tracking integration |
| Internal staff notes per order | ❌ | No context for handoffs |

### PII Masking

**🟠 HIGH — No PII masking for lower-privilege roles**

When any staff member views an order, they see the full customer email, full name, and full shipping address. GDPR and internal security best practices require that staff only see the PII necessary for their function.

Example: A fulfillment agent needs the shipping address to verify an address query. They do not need the customer's email address.

**Fix:** Mask sensitive fields based on role in the API response:
```typescript
function maskOrder(order: Order, role: string) {
  if (role === 'fulfillment_agent') {
    return { ...order, customer_email: '***@***.***' };
  }
  return order;
}
```

### Minimum Viable Support Tools (What to Build First)

1. `GET /api/orders?email=customer@example.com` — search by customer email
2. `POST /api/orders/:id/notes` — append internal note (logged with staff ID + timestamp)
3. `POST /api/orders/:id/refund` — trigger Stripe refund + update status (permission-gated)
4. `POST /api/orders/:id/replace` — create a new fulfillment submission for the same items

---

## 5. Finance & Accounting

### Current State

**Gap: Zero financial infrastructure exists.** There are no financial reports, no revenue tracking, no reconciliation with Stripe, and no margin analysis.

### Missing Functionality

| Feature | Status |
|---|---|
| Revenue dashboard (daily/weekly/monthly) | ❌ |
| Tax reporting | ❌ |
| Refund reporting | ❌ |
| Chargeback reporting | ❌ |
| Supplier cost tracking | ❌ |
| Gross margin reporting | ❌ |
| Payout reconciliation vs Stripe | ❌ |

### Reconciliation Risk

Currently there is no way to verify that every payment in Stripe has a corresponding order in the database. If the webhook fails (see Phase 1, item #1 — metadata truncation), the mismatch is invisible.

**Minimum viable reconciliation query:**
```sql
-- Run against Stripe export CSV + DB to find mismatches
SELECT s.session_id, s.amount_total, o.id
FROM stripe_sessions_export s  -- import from Stripe dashboard CSV
LEFT JOIN orders o ON o.stripe_session_id = s.session_id
WHERE o.id IS NULL;  -- payments with no order record
```

### Tax Compliance

POD platforms shipping physical goods must collect sales tax in US states where they have nexus. This is **not optional** — failure to collect sales tax is the seller's legal liability.

**Stripe Tax** (Stripe's built-in tax calculation) can be enabled with one line:
```typescript
const session = await stripe.checkout.sessions.create({
  automatic_tax: { enabled: true }, // add this
  // ...
});
```
This handles US sales tax, EU VAT, and Canadian GST automatically.

### Chargeback Alerting

Stripe fires `charge.dispute.created` when a chargeback is opened. Currently, this event is silently ignored. A chargeback means:
- Funds are immediately frozen
- $15 dispute fee charged
- If lost: full order value clawed back

**Fix:** Handle `charge.dispute.created` in the webhook:
```typescript
if (event.type === 'charge.dispute.created') {
  const dispute = event.data.object;
  await alertCritical('Chargeback opened', { charge: dispute.charge, amount: dispute.amount });
  await query(
    "UPDATE orders SET status='disputed' WHERE stripe_payment_intent=$1",
    [dispute.payment_intent]
  );
}
```

---

## 6. Inventory & Supplier Management

### Current State

**Gap: No supplier management infrastructure.** Provider is a field on each product (`printful` or `tapstitch`). There is no health monitoring, failover capability, or pricing sync.

### Missing Functionality

| Feature | Status | Risk Without It |
|---|---|---|
| Supplier health monitoring | ❌ | No warning before provider is down |
| Product-to-provider mapping | ⚠️ PARTIAL | Field exists, no UI to bulk-manage |
| Provider failover capability | ❌ | One provider down = products fail silently |
| Supplier pricing updates | ❌ | Manual price updates only |
| Supplier outage alerts | ❌ | Staff discover outage when customers complain |

### Provider Outage Handling

Currently: If Printful's API is down, `fulfillment_status` = `"request_failed"`. Checkout still accepts orders for Printful products (provider health is not checked at checkout time). Orders queue up unprocessed.

**Fix — Health check endpoint:**
```typescript
export async function checkPrintfulHealth(): Promise<boolean> {
  try {
    const res = await fetch("https://api.printful.com/stores", {
      headers: { Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}` },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
```

Run this every 5 minutes. If unhealthy, set a flag that checkout can read. Display a "Extended shipping times" notice to customers. Don't block checkout — just set expectations.

### Provider Failover

If a product has both `printful_variant_id` and `tapstitch_variant_id` set, and Printful is down, the fulfillment logic could automatically route to Tapstitch. Currently there is no fallback routing.

**Fix in `fulfillment.ts`:**
```typescript
if (printfulIsDown && item.tapstitch_variant_id) {
  item.pod_provider = 'tapstitch'; // automatic failover
}
```

---

## 7. Internal Notification System

### Current State

**Gap: No notification system exists.** All events log to `console.error()`. In Replit's production environment, these logs are visible in the deployment log viewer, but there is no alerting, no Slack integration, no email alerts, and no on-call routing.

### Missing Alerts

| Alert | Trigger | Currently Sent | Severity |
|---|---|---|---|
| Failed payment | `payment_intent.payment_failed` | ❌ | Medium |
| Fulfillment failure | `fulfillment_status LIKE 'failed%'` | ❌ | 🔴 Critical |
| Chargeback opened | `charge.dispute.created` | ❌ | 🔴 Critical |
| Refund issued | `charge.refunded` | ❌ | Medium |
| Inventory issue | `stock_level = 0` | ❌ | Medium |
| Supplier outage | Provider health check fails | ❌ | 🔴 Critical |
| Security event | Failed login × 5 / new IP for admin | ❌ | High |
| Admin login anomaly | Login from new country/device | ❌ | High |
| Order save failure | Webhook DB write fails | ⚠️ LOGGED | 🔴 Critical (not alerted) |

### Minimum Viable Notification System

A single webhook-to-Slack or webhook-to-Discord function covers most alert needs with zero infrastructure:

```typescript
// lib/alert.ts
export async function sendAlert(
  level: 'info' | 'warning' | 'critical',
  title: string,
  details: Record<string, unknown>
): Promise<void> {
  const webhookUrl = process.env['SLACK_WEBHOOK_URL'];
  if (!webhookUrl) {
    console.error(`[ALERT][${level.toUpperCase()}] ${title}`, details);
    return;
  }
  const emoji = level === 'critical' ? '🚨' : level === 'warning' ? '⚠️' : 'ℹ️';
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `${emoji} *${title}*\n\`\`\`${JSON.stringify(details, null, 2)}\`\`\``,
    }),
  }).catch(() => {}); // non-fatal — never crash the webhook handler
}
```

Replace every `console.error("[Webhook] CRITICAL:...")` with `sendAlert('critical', ...)`.

---

## 8. Audit Logging & Compliance

### Current State

**Gap: No audit log exists.** There is no record of what admin action was taken, by whom, from where, or when.

### Required Audit Events (All Missing)

| Event | Currently Logged |
|---|---|
| Admin login success | ❌ |
| Admin login failure | ❌ |
| Admin logout | ❌ |
| Product created | ❌ |
| Product updated (with diff) | ❌ |
| Product deleted | ❌ |
| Pricing change (old → new) | ❌ |
| Order status change | ❌ |
| Refund issued | ❌ |
| Fulfillment retry | ❌ |
| User role changed | ❌ |

### Recommended Schema

```sql
CREATE TABLE audit_log (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  actor_id     INTEGER,                    -- admin_users.id
  actor_ip     INET NOT NULL,
  actor_email  TEXT NOT NULL,
  action       TEXT NOT NULL,              -- 'product.update', 'order.refund', etc.
  entity_type  TEXT NOT NULL,              -- 'product', 'order', 'user'
  entity_id    TEXT NOT NULL,
  old_value    JSONB,                      -- previous state snapshot
  new_value    JSONB                       -- new state snapshot
);

-- Immutability: no UPDATE or DELETE permissions on this table for the app DB user
-- Only INSERT is allowed. Deletes must go through a separate privileged process.
REVOKE UPDATE, DELETE ON audit_log FROM app_user;
```

### Implementation Pattern

Wrap every admin mutation in an audit wrapper:

```typescript
async function auditedUpdate(
  req: Request,
  action: string,
  entityType: string,
  entityId: string | number,
  oldValue: unknown,
  newValue: unknown
) {
  await query(
    `INSERT INTO audit_log (actor_ip, actor_email, action, entity_type, entity_id, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      req.ip,
      req.user?.email ?? 'unknown',
      action,
      entityType,
      String(entityId),
      JSON.stringify(oldValue),
      JSON.stringify(newValue),
    ]
  );
}
```

---

## 9. Business Continuity

### Current State

**Gap: No business continuity planning, documentation, or tooling exists.**

### Backup Validation

| Item | Status |
|---|---|
| Database backups exist | ❓ (Replit-managed, unconfirmed) |
| Backup restoration tested | ❌ Never tested |
| Backup frequency known | ❌ Not documented |
| Point-in-time recovery possible | ❓ Unknown |
| Orders reconcilable from Stripe if DB lost | ⚠️ Partially (Stripe has session data, but items are in metadata — see Phase 1 Critical #1) |

**Action required before launch:** Contact Replit support and confirm: (1) backup frequency, (2) retention period, (3) restore SLA. Document this in a runbook.

### Incident Response Runbooks (All Missing)

#### Runbook 1: Stripe Outage
1. No action on checkout — Stripe Checkout will display Stripe's own error page
2. Monitor https://status.stripe.com
3. No orders will be lost — failed sessions are not created
4. When Stripe recovers, pending carts can proceed normally
5. Check for any webhooks queued during outage (Stripe retries for 72h) — they will auto-process

#### Runbook 2: Printful Outage
1. Orders continue to be accepted and saved to DB with `fulfillment_status = 'skipped'` or `'request_failed'`
2. Check https://status.printful.com
3. When Printful recovers, use the admin "Retry Fulfillment" button on all failed orders
4. If outage exceeds 48h, consider reassigning affected products to Tapstitch

#### Runbook 3: Database Loss
1. **If Replit backup exists:** Restore from latest backup. Expected data loss = time since last backup.
2. **Partial recovery from Stripe:** All paid Stripe sessions can be retrieved via `GET /v1/checkout/sessions`. Re-process each to rebuild order records.
3. **Known gap:** Item details are stored in Stripe metadata (see Phase 1 Critical #1 — after fix, they'll be in a pre-created pending order, making this easier)

#### Runbook 4: Compromised Admin Credentials
1. Immediately rotate `ADMIN_PASSWORD` and `JWT_SECRET` in Replit Secrets
2. Restarting the server invalidates all existing JWTs (since new `JWT_SECRET` is used)
3. Review audit log for unauthorized actions in the past 7 days
4. If audit log doesn't exist yet: review `orders` table for any unexpected status changes or deletions

---

## 10. Scaling Blockers by Traffic Tier

### 100 Orders/Day

At this scale, PrimeOpp can technically operate, but will require manual intervention daily.

| Blocker | Impact |
|---|---|
| No fulfillment retry automation | ~5-10% of orders may silently fail per day; staff must manually check |
| No monitoring/alerting | Critical failures discovered by customers, not staff |
| Stripe metadata bug (Phase 1 #1) | Random orders have no items; unfulfillable |
| Single admin account | One person must handle all operations |
| No customer lookup | Support requests require scrolling order list |
| Synchronous fulfillment in webhook | Occasional Stripe timeouts → duplicate fulfillment submissions |

**Verdict: DO NOT LAUNCH at 100 orders/day without fixing Phase 1 Criticals 1–4 and adding fulfillment retry.**

---

### 1,000 Orders/Day (~$50K-$150K/month GMV)

This is where the absence of operational infrastructure becomes a daily operational crisis.

| Blocker | Impact |
|---|---|
| No RBAC | Cannot hire support staff or fulfillment agents safely |
| No fulfillment queue / retry automation | 50–100 failed fulfillments/day require manual DB queries |
| No customer service console | Support handles 50–100 tickets/day with no tools |
| `SELECT * FROM products` with no limit | 1,000 product catalog = slow homepage |
| In-memory rate limiting | Rate limits bypass-able via server restart |
| Orders table grows to 30,000 rows | `SELECT * FROM orders LIMIT 200` is still a full scan without indexes |
| No DB indexes | All queries degrade to sequential scans |
| No finance reconciliation | Monthly Stripe reconciliation is a multi-hour manual process |
| Synchronous fulfillment in webhook | Under load, webhooks start timing out at Stripe's 30s limit |
| Single admin account shared among staff | Cannot attribute changes to individuals |

**Verdict: At 1,000/day, you need RBAC, async fulfillment, fulfillment retry automation, DB indexes, and customer service tooling. This is 4–8 weeks of focused engineering.**

---

### 10,000 Orders/Day (~$500K-$1.5M/month GMV)

Infrastructure fundamentally cannot support this without significant rearchitecture.

| Blocker | Impact |
|---|---|
| Single PostgreSQL instance | DB becomes the bottleneck; connection pool max of 20 exhausted |
| No job queue (BullMQ/Redis) | Webhook handler is synchronous; hundreds of concurrent webhook deliveries overload the process |
| No caching layer | Product catalog fetched from DB on every request; 10,000 concurrent users = 10,000 DB queries/minute |
| No CDN for images | Image payloads served from origin on every product page load |
| No horizontal scaling | Single API server instance; one crash = total downtime |
| No read replicas | Reporting queries compete with fulfillment writes on same DB connection pool |
| Single fulfillment provider per order | No automatic load balancing or failover between Printful/Tapstitch |
| Tax compliance | At this GMV, automated tax collection (Stripe Tax) is legally mandatory in 40+ US states |
| No audit log | At this scale, a compliance audit or legal dispute requires forensic records |
| No 2FA | Admin account compromise = catastrophic at this revenue level |

**Verdict: At 10,000/day, this is an enterprise platform. Requires: Redis job queue, DB read replicas, CDN, horizontal API scaling, and a full engineering team to build/maintain the operational stack.**

---

### 100,000 Orders/Day (~$5M-$15M/month GMV)

At this scale, the application as designed is not the bottleneck — business operations are.

| Blocker | Impact |
|---|---|
| PostgreSQL alone cannot handle write throughput | Requires sharding or a purpose-built order management system (OMS) |
| Printful/Tapstitch capacity | Wholesale API rate limits; need dedicated account managers and SLAs |
| Single email provider (Resend) | ~100K transactional emails/day requires enterprise Resend plan + dedicated IPs |
| No fraud detection | At this volume, sophisticated fraud attacks are inevitable; Stripe Radar alone is insufficient |
| No ML-based price optimization | Manual pricing cannot compete with dynamic pricing at scale |
| No returns portal | Customer-facing returns management becomes full-time jobs |
| Compliance | GDPR Data Protection Officer may be legally required; PCI SAQ A-EP review |
| Support volume | 100K orders/day → ~2,000–5,000 support contacts/day; requires helpdesk software (Zendesk, Intercom) |
| Financial reporting | Real-time revenue dashboards, multi-currency support, automated tax filings across 50+ jurisdictions |

**Verdict: 100,000/day is Printful/Merch by Amazon territory. The entire tech stack would need to be rebuilt as a distributed system with dedicated teams for fulfillment ops, finance, compliance, and engineering.**

---

## Summary: What to Build and When

### Before Launch (Week 1)
1. Fix Phase 1 Criticals (metadata limit, product validation, JWT cookie, credentials)
2. Add DB indexes
3. Add fulfillment async + retry endpoint
4. Add Sentry + UptimeRobot monitoring
5. Add Slack/Discord webhook for CRITICAL alerts

### Month 1 (0 → 100 orders/day)
6. Add `admin_users` table with role column (start with 2 roles: super_admin, admin)
7. Add `audit_log` table; log product and order changes
8. Add customer email search to order list
9. Add internal notes field per order
10. Add refund endpoint + admin UI button
11. Add fulfillment retry button in admin panel
12. Add `charge.refunded` and `charge.dispute.created` webhook handlers

### Month 2–3 (100 → 1,000 orders/day)
13. Add fulfillment cron job (retry failed orders every 15 minutes)
14. Implement full RBAC with 5–7 roles
15. Add operations dashboard (fulfillment queue, failed queue, provider health)
16. Add basic finance dashboard (revenue by day, refunds, fulfillment costs)
17. Enable Stripe Tax (one line of code; massive legal risk if skipped)
18. Add supplier health monitoring with automatic failover
19. Migrate to Redis-backed job queue for async fulfillment (BullMQ)
20. Add customer service console with PII masking by role

### Month 4–6 (1,000 → 10,000 orders/day)
21. Add Redis caching for product catalog
22. CDN for product images (move from base64 to object storage)
23. Add DB read replicas
24. Add horizontal API server scaling
25. Full audit log with diff tracking
26. Full finance reconciliation with Stripe
27. Artwork review workflow (if accepting user-uploaded designs)

---

## What's Genuinely Working

Despite the operational gaps, the core transaction infrastructure is solid:

- ✅ Payments are real and Stripe-verified
- ✅ Orders are saved with idempotency protection
- ✅ Fulfillment routes correctly to Printful or Tapstitch based on product config
- ✅ Variant ID validation prevents garbage submissions
- ✅ Rate limiting protects the API
- ✅ All SQL is parameterized
- ✅ Server-side price validation prevents price manipulation

The platform can safely process real orders today at low volume with manual oversight. The operational infrastructure described in this audit is what separates a $1K/month store from a $1M/month business.
