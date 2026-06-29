// api.ts — all backend API calls for PrimeOpp

export interface Product {
  id: number;
  type: "pod" | "affiliate";
  title: string;
  description: string | null;
  price: number | null;
  category: string | null;
  thumbnail_url: string | null;
  external_link: string | null;
  stock_level: number | null;
  shipping_info: string | null;
  colors: ColorVariant[];
  sizes: string[];
  pod_provider: "printful" | "tapstitch" | null;
  printful_variant_id: string | null;
  tapstitch_variant_id: string | null;
  created_at: string;
  average_rating?: number | string | null;
  review_count?: number | string | null;
}

export interface ColorVariant {
  name: string;
  hex: string;
  price: number;
}

export interface Order {
  id: number;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  status: string;
  customer_email: string;
  customer_name: string | null;
  shipping_address: {
    name: string;
    line1: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  } | null;
  items: Array<{
    product_id: number;
    title: string;
    quantity: number;
    size: string;
    color: string;
    price: number;
    pod_provider: string;
  }>;
  subtotal: number | null;
  total: number | null;
  pod_provider: string | null;
  fulfillment_order_id: string | null;
  fulfillment_status: string | null;
  created_at: string;
}

export interface AdminDashboard {
  orders: Array<{ status: string; count: string }>;
  revenue: number;
  products: Array<{ type: string; count: string }>;
  fulfillmentJobs: Array<{ status: string; count: string }>;
}

export interface AuditLogEntry {
  id: number;
  created_at: string;
  actor_email: string | null;
  actor_ip: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
}

export interface ProductReview {
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
}

export interface ProductReviewsResponse {
  average_rating: number;
  review_count: number;
  reviews: ProductReview[];
}

export interface ProductRecommendations {
  frequently_bought_together: Product[];
  related_products: Product[];
  complete_the_look: Product[];
  customers_also_bought: Product[];
  cart_upsell: Product[];
  checkout_upsell: Product[];
  post_purchase_upsell: Product[];
}

export interface DiscountQuote {
  discount: null | {
    code: string | null;
    name: string;
    discount_type: string;
    value_type: string;
    value: string;
    minimum_subtotal: string;
    amount: number;
  };
  free_shipping: boolean;
  subtotal: number;
  total: number;
  eligible: Array<{ name: string; amount: number; discount_type: string; code: string | null }>;
}

export interface RevenueDashboard {
  revenue: number;
  orders: number;
  conversion_rate: number | null;
  aov: number;
  repeat_customers: number;
  ltv: number;
  top_products: Array<{ title: string; units: string }>;
  abandoned_cart_rate: number;
  abandoned_cart_value: number;
  refund_rate: number;
  upsell_conversion: number;
  coupon_usage: Array<{ code: string | null; name: string; usage_count: number }>;
}

export interface AbandonedCartSummary {
  id: string;
  email: string | null;
  items: CartItem[];
  subtotal: string;
  status: string;
  recovery_email_count: number;
  updated_at: string;
}

export interface AdminReview {
  id: string;
  product_id: number;
  product_title: string;
  customer_email: string;
  customer_name: string;
  rating: number;
  title: string;
  body: string;
  photo_url: string | null;
  is_verified_purchase: boolean;
  status: string;
  helpful_count: number;
  created_at: string;
}

export interface CheckoutSessionResponse {
  url: string;
  session_id: string;
}

export interface SessionVerification {
  status: string;
  customer_email: string | null;
  customer_name: string | null;
  amount_total: number | null;
  shipping: {
    address?: {
      line1?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
    name?: string;
  } | null;
}

import type { CartItem } from "@/lib/cart";

let csrfToken: string | null = null;

function adminHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
  };
}

// ─── Products ─────────────────────────────────────────────────────────────────

export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch("/api/products");
  if (!res.ok) throw new Error("Failed to load products");
  return res.json() as Promise<Product[]>;
}

export async function fetchProduct(id: number): Promise<Product> {
  const res = await fetch(`/api/products/${id}`);
  if (!res.ok) throw new Error("Product not found");
  return res.json() as Promise<Product>;
}

export async function fetchProductReviews(productId: number, sort = "newest", q = ""): Promise<ProductReviewsResponse> {
  const params = new URLSearchParams({ sort });
  if (q) params.set("q", q);
  const res = await fetch(`/api/products/${productId}/reviews?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load reviews");
  return res.json() as Promise<ProductReviewsResponse>;
}

export async function submitProductReview(productId: number, data: {
  customer_email: string;
  customer_name: string;
  rating: number;
  title: string;
  body: string;
  photo_url?: string | null;
}): Promise<void> {
  const res = await fetch(`/api/products/${productId}/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Review could not be submitted");
}

export async function markReviewHelpful(reviewId: string): Promise<{ helpful_count: number }> {
  const res = await fetch(`/api/reviews/${reviewId}/helpful`, { method: "POST" });
  if (!res.ok) throw new Error("Could not vote on review");
  return res.json() as Promise<{ helpful_count: number }>;
}

export async function fetchProductRecommendations(productId: number): Promise<ProductRecommendations> {
  const res = await fetch(`/api/products/${productId}/recommendations`);
  if (!res.ok) throw new Error("Failed to load recommendations");
  return res.json() as Promise<ProductRecommendations>;
}

export async function createProduct(data: Partial<Product>): Promise<Product> {
  const res = await fetch("/api/products", {
    method: "POST",
    headers: adminHeaders(),
    credentials: "same-origin",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json() as { error: string };
    throw new Error(err.error ?? "Failed to create product");
  }
  return res.json() as Promise<Product>;
}

export async function updateProduct(id: number, data: Partial<Product>): Promise<Product> {
  const res = await fetch(`/api/products/${id}`, {
    method: "PUT",
    headers: adminHeaders(),
    credentials: "same-origin",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json() as { error: string };
    throw new Error(err.error ?? "Failed to update product");
  }
  return res.json() as Promise<Product>;
}

export async function deleteProduct(id: number): Promise<void> {
  const res = await fetch(`/api/products/${id}`, {
    method: "DELETE",
    headers: adminHeaders(),
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error("Failed to delete product");
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function adminLogin(username: string, password: string): Promise<void> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ email: username, password }),
  });
  if (!res.ok) {
    const err = await res.json() as { error: string };
    throw new Error(err.error ?? "Login failed");
  }
  const data = await res.json() as { csrfToken: string };
  csrfToken = data.csrfToken;
}

export async function verifyToken(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/verify", { credentials: "same-origin" });
    if (res.ok) {
      const data = await res.json() as { csrfToken?: string };
      csrfToken = data.csrfToken ?? csrfToken;
    }
    return res.ok;
  } catch {
    return false;
  }
}

export async function adminLogout(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    headers: adminHeaders(),
    credentials: "same-origin",
  }).catch(() => undefined);
  csrfToken = null;
}

export function isLoggedIn(): boolean {
  return false;
}

// ─── Checkout ─────────────────────────────────────────────────────────────────

export async function createCheckoutSession(
  items: CartItem[],
  discountCode?: string,
): Promise<CheckoutSessionResponse> {
  const apiItems = items.map((i) => ({
    product_id: i.product_id,
    title: i.title,
    quantity: i.quantity,
    size: i.size,
    color: i.color,
    price: i.price,
    pod_provider: i.pod_provider,
    printful_variant_id: i.printful_variant_id ?? null,
    tapstitch_variant_id: i.tapstitch_variant_id ?? null,
  }));

  const res = await fetch("/api/checkout/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: apiItems,
      cancel_url: `${window.location.origin}/cart`,
      discount_code: discountCode,
    }),
  });
  if (!res.ok) {
    const err = await res.json() as { error: string };
    throw new Error(err.error ?? "Failed to create checkout session");
  }
  return res.json() as Promise<CheckoutSessionResponse>;
}

export async function verifyCheckoutSession(sessionId: string): Promise<SessionVerification> {
  const res = await fetch(`/api/checkout/session/${sessionId}`);
  if (!res.ok) throw new Error("Could not verify session");
  return res.json() as Promise<SessionVerification>;
}

function getCartToken(): string {
  const key = "primeopp_cart_token";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const token = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(key, token);
  return token;
}

export async function trackAbandonedCart(items: CartItem[], email?: string | null): Promise<void> {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  await fetch("/api/abandoned-cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cart_token: getCartToken(),
      email: email ?? null,
      items,
      subtotal,
    }),
  }).catch(() => undefined);
}

export async function quoteDiscount(items: CartItem[], code?: string): Promise<DiscountQuote> {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const res = await fetch("/api/discounts/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      subtotal,
      items: items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
      })),
    }),
  });
  if (!res.ok) throw new Error("Discount could not be applied");
  return res.json() as Promise<DiscountQuote>;
}

export async function fetchLoyalty(email: string): Promise<{
  account: { points_balance: number; lifetime_points: number; vip_level: string; referral_code: string | null };
  history: Array<{ points: number; reason: string; created_at: string }>;
}> {
  const res = await fetch(`/api/loyalty/${encodeURIComponent(email)}`);
  if (!res.ok) throw new Error("Could not load rewards");
  return res.json() as Promise<{
    account: { points_balance: number; lifetime_points: number; vip_level: string; referral_code: string | null };
    history: Array<{ points: number; reason: string; created_at: string }>;
  }>;
}

// ─── Orders (admin) ───────────────────────────────────────────────────────────

export async function fetchOrders(): Promise<Order[]> {
  const res = await fetch("/api/orders", { headers: adminHeaders(), credentials: "same-origin" });
  if (!res.ok) throw new Error("Failed to load orders");
  return res.json() as Promise<Order[]>;
}

export async function updateOrderStatus(id: number, status: string): Promise<Order> {
  const res = await fetch(`/api/orders/${id}/status`, {
    method: "PATCH",
    headers: adminHeaders(),
    credentials: "same-origin",
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update order");
  return res.json() as Promise<Order>;
}

export async function fetchAdminDashboard(): Promise<AdminDashboard> {
  const res = await fetch("/api/admin/dashboard", { headers: adminHeaders(), credentials: "same-origin" });
  if (!res.ok) throw new Error("Failed to load dashboard");
  return res.json() as Promise<AdminDashboard>;
}

export async function fetchAuditLog(): Promise<AuditLogEntry[]> {
  const res = await fetch("/api/admin/audit-log", { headers: adminHeaders(), credentials: "same-origin" });
  if (!res.ok) throw new Error("Failed to load audit log");
  return res.json() as Promise<AuditLogEntry[]>;
}

export async function fetchRevenueDashboard(): Promise<RevenueDashboard> {
  const res = await fetch("/api/admin/revenue", { headers: adminHeaders(), credentials: "same-origin" });
  if (!res.ok) throw new Error("Failed to load revenue dashboard");
  return res.json() as Promise<RevenueDashboard>;
}

export async function fetchAbandonedCarts(): Promise<AbandonedCartSummary[]> {
  const res = await fetch("/api/admin/abandoned-carts", { headers: adminHeaders(), credentials: "same-origin" });
  if (!res.ok) throw new Error("Failed to load abandoned carts");
  return res.json() as Promise<AbandonedCartSummary[]>;
}

export async function fetchAdminReviews(): Promise<AdminReview[]> {
  const res = await fetch("/api/admin/reviews", { headers: adminHeaders(), credentials: "same-origin" });
  if (!res.ok) throw new Error("Failed to load reviews");
  return res.json() as Promise<AdminReview[]>;
}

export async function moderateReview(id: string, status: "pending" | "approved" | "rejected"): Promise<void> {
  const res = await fetch(`/api/admin/reviews/${id}`, {
    method: "PATCH",
    headers: adminHeaders(),
    credentials: "same-origin",
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to moderate review");
}
