# PrimeOpp — What It Actually Is Right Now

Live site: https://primeopp-production-a554.up.railway.app

## 1. What PrimeOpp Is Supposed to Be

Based on the code that actually exists (not old summaries), PrimeOpp is
being built as two layers:

- **A storefront** that sells print-on-demand apparel and affiliate-linked
  products, run by you as a single operator.
- **A much bigger, separate "product intelligence" system** — barcode
  identification, product enrichment, a canonical product catalog, and even
  a marketplace/cross-listing engine — that has been built as real,
  independently-tested code, but has never been connected to the storefront.

## 2. What Users Can Actually Do Today

**A customer can**: browse products, view product detail pages, add to a
browser-local wishlist, put items in a cart, check out (only once you set
real Stripe keys — right now checkout politely says "not configured"
instead of taking payment), look up an order by order number + email, and
submit a contact-form message.

**You (the admin) can**: log in, create/edit/delete products by typing
every field in by hand, manage orders and retry failed fulfillment,
approve or reject customer reviews, and view a revenue/dashboard summary.

**Nobody can**: scan a barcode (there's no such button or page anywhere),
sign up as a seller (there's no such thing as a seller account), or publish
a product through any kind of review/approval step (products go live the
instant you save them — there's no draft state).

## 3. What Is Live Now

The storefront, the admin dashboard, order management, wishlist, order
lookup, contact form, and the discount/promo engine (it can be *redeemed*
at checkout, though there's no admin screen to *create* a new discount code
yet — that currently requires a direct database edit). All of this is
deployed and was smoke-tested against the real live URL.

## 4. What Exists But Is Disconnected

Three separate backend code libraries, all genuinely well-built and
unit-tested, none of them wired to the live storefront:

- **Product intake** — takes a barcode/identifier or manual entry and
  normalizes it. 134 passing tests. Never called by anything live.
- **Product enrichment** — takes a normalized product and fills in brand,
  category, images, confidence scores from external sources. Real, tested.
  Never called by anything live.
- **Commerce-core** — a "canonical product" model meant to unify products
  across many sales channels, plus pricing/inventory/profit logic. 269
  passing tests. Never called by anything live.

There's also a **marketplace/cross-listing engine** and a **deal/pricing
intelligence engine**, both further along in ambition but further from
proven — the marketplace one in particular has zero tests written for it.

## 5. What Is Fake / Mock / Demo Only

- `mockup-sandbox` — a leftover design-mockup preview tool from an earlier
  build phase. It's not a product feature and was never meant to be one.

Nothing else in the live app is faked. Where something isn't finished
(Stripe, email, POD provider calls), the code is honest about it — it
returns a clear "not configured" response rather than pretending to
succeed.

## 6. What Is Missing

- **A barcode scanner of any kind** — no camera scanning, no manual
  barcode-entry field, no lookup against any product database. This is the
  single biggest gap between "what PrimeOpp sounds like it should do" and
  "what it does today."
- **A marketplace** — there are no sellers, no seller onboarding, no
  multi-vendor anything. Right now PrimeOpp is one store, not a platform
  other sellers use.
- **A listing approval workflow** — because there's no draft state, there's
  nothing to approve.
- **A way to create discount codes from the admin dashboard** — the engine
  that redeems them is live; the screen to create one isn't.

## 7. Pricing Scheme Found

Simple, honest retail pricing: you type a price per product (and can
override it per color). There's a real discount/promo engine (percent,
fixed-amount, free-shipping, buy-one-get-one, volume-based, first-order,
referral codes) that already works at checkout. There is no subscription
model and no marketplace commission — the only "commission" language in
the app is a legal disclosure about affiliate links, not a real fee your
code calculates.

## 8. Marketplace Model Found

None. PrimeOpp today is a single-seller storefront (you), not a
marketplace where other people list and sell products.

## 9. Barcode Scanner Truth

It doesn't exist yet, anywhere — not live, not as a local dev feature, not
even as a stub UI. What *does* exist, buried in the disconnected
product-intake library, is real, working, tested logic that can validate
whether a barcode's check digit is correct and classify it as UPC/EAN/GTIN/
ISBN. That logic has never been given an actual barcode to check, because
nothing feeds it one yet.

## 10. Product Listing Truth

Products are created one at a time, by you, by hand, through the admin
form. There's no automatic enrichment, no pricing intelligence, and no
review/approval step — whatever you type in goes live immediately.

## 11. What to Build/Deploy Next

See `PRIMEOPP_NEXT_PRODUCT_BUILD_PLAN.md` for the full reasoning and a
ready-to-paste prompt. Short version: the highest-leverage next step is
connecting the *simplest possible* version of a real barcode flow — even
just a manual barcode-entry field that runs the already-tested
identifier-classification logic — since a full camera scanner, a
marketplace, and Stripe activation are each bigger, separate investments
that don't depend on each other.
