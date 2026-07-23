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

export interface ListingPackageRequest {
  source: "SCAN" | "SEARCH" | "MANUAL_FALLBACK";
  identifier: string;
  identifierType?: string | null;
  productId?: number | null;
  product: {
    title?: string | null;
    description?: string | null;
    images?: string[] | null;
    category?: string | null;
    condition?: string | null;
    sizeVariant?: string | null;
    costBasis?: number | null;
    targetPrice?: number | null;
    shippingProfile?: string | null;
  };
  selectedChannels: string[];
  createExports: boolean;
}

export interface ProductIntakeRequest {
  query: string;
  source: "BARCODE" | "MANUAL_IDENTIFIER" | "SEARCH";
}

export interface ProductIntakeResponse {
  normalizedIdentifier: string | null;
  identifierType: "UPC_A" | "EAN_13" | "GTIN" | "ISBN" | "SKU" | "STYLE_CODE" | "PRODUCT_NAME" | "UNKNOWN";
  valid: boolean;
  classification: {
    type: string;
    confidence: "HIGH" | "MEDIUM" | "LOW" | "AMBIGUOUS";
    reason: string;
  };
  lookupStatus: "FOUND" | "NOT_FOUND" | "NOT_WIRED" | "PROVIDER_REQUIRED" | "FAILED";
  lookupSource: "PRODUCT_IDENTIFIER_MAP" | "LOCAL_CATALOG_TITLE_SEARCH" | "NONE";
  matchedIdentifier: string | null;
  matchedProductId: string | null;
  enrichment: null;
  enrichmentStatus: "AVAILABLE" | "NOT_WIRED" | "PROVIDER_REQUIRED" | "FAILED";
  productCandidate: {
    title?: string;
    brand?: string;
    description?: string;
    imageUrl?: string;
    category?: string;
    identifiers: Record<string, string>;
  };
  confidence: "HIGH" | "MEDIUM" | "LOW" | "AMBIGUOUS";
  canCreateListingPackage: boolean;
  providerCalls: false;
  publishEnabled: false;
}

export interface ProductIdentifierMappingRequest {
  productId: number;
  identifier: string;
  identifierType: "UPC" | "EAN" | "GTIN" | "SKU" | "STYLE_CODE" | "ISBN" | "OTHER";
  source: "MANUAL" | "IMPORT" | "LOCAL_CATALOG" | "GENERATED_REFERENCE";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  isPrimary: boolean;
}

export interface ProductIdentifierMappingResponse {
  mapping: {
    id: string | number;
    product_id: string | number;
    identifier: string;
    identifier_type: string;
    normalized_identifier: string;
    source: string;
    confidence: string;
    is_primary: boolean;
  };
  normalizedIdentifier: string;
  providerCalls: false;
  publishEnabled: false;
}

export interface ChannelListingDraft {
  id: string | number;
  canonical_listing_id: string | number;
  channel: string;
  account_connection_id: string | number | null;
  channel_status: "DRAFT" | "READY" | "APPROVAL_REQUIRED" | "EXPORTED" | "DISABLED" | "FAILED";
  channel_payload: Record<string, unknown>;
  last_validation_error: string | null;
  publish_disabled_reason: string;
}

export interface ListingExportPackage {
  id: string | number;
  canonical_listing_id: string | number;
  channel: string;
  export_format: "COPY_FIELDS" | "CSV" | "JSON" | "API_DRAFT_DISABLED";
  export_payload: Record<string, unknown>;
  created_at: string;
}

export interface ListingPackageResponse {
  canonicalListingPackageId: string | number;
  canonicalListingPackage: Record<string, unknown>;
  channelDrafts: ChannelListingDraft[];
  exports: ListingExportPackage[];
  externalPublishEnabled: false;
  approvalRequired: true;
  liabilityMode: "seller_publishes_on_own_accounts";
}

export interface AccountConnectionShell {
  id: string | number;
  owner_scope: string;
  channel: string;
  connection_status: "NOT_CONNECTED" | "MONITORING_ONLY" | "AUTH_REQUIRED" | "PUBLISH_DISABLED";
  monitoring_only: boolean;
  publish_authorized: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChannelDefinition {
  key: string;
  label: string;
  category: string;
  draftsAvailable: true;
  exportsAvailable: true;
  oauthEnabled: false;
  publishEnabled: false;
  safetyMode: "seller_owned_account";
}

export interface ChannelConnection {
  id: string | number;
  user_id: string | number | null;
  channel: string;
  display_name: string | null;
  connection_status: "NOT_CONNECTED" | "AUTH_REQUIRED" | "CONNECTED_MONITORING_ONLY" | "CONNECTED_DRAFTS_ONLY" | "PUBLISH_DISABLED" | "ERROR";
  scopes_requested: string[];
  scopes_granted: string[];
  token_storage_status: "NOT_STORED" | "ENCRYPTED" | "EXTERNAL_SECRET_STORE" | "NOT_IMPLEMENTED";
  monitoring_only: boolean;
  publish_authorized: boolean;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChannelConnectionCreateResponse {
  connectionId: string | number;
  channel: string;
  connectionStatus: "AUTH_REQUIRED";
  monitoringOnly: true;
  publishAuthorized: false;
  oauthEnabled: false;
  reason: string;
  tokenStorageStatus: "NOT_IMPLEMENTED";
  providerCalls: false;
  publishEnabled: false;
  connection: ChannelConnection;
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

// ─── Order lookup (customer, public) ─────────────────────────────────────────

export interface OrderLookupResult {
  id: number;
  status: string;
  fulfillment_status: string | null;
  created_at: string;
  total: number | string | null;
  items: Array<{ title: string; quantity: number; size: string; color: string }>;
  shipping_address: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  } | null;
}

export async function lookupOrder(id: number, email: string): Promise<OrderLookupResult> {
  const res = await fetch("/api/orders/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(err?.error ?? "Order not found");
  }
  return res.json() as Promise<OrderLookupResult>;
}

// ─── Contact ──────────────────────────────────────────────────────────────────

export async function submitContactMessage(data: {
  name: string;
  email: string;
  order_id?: number | null;
  subject?: string;
  message: string;
}): Promise<void> {
  const res = await fetch("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(err?.error ?? "Message could not be submitted");
  }
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

export async function createListingPackage(data: ListingPackageRequest): Promise<ListingPackageResponse> {
  const res = await fetch("/api/listings/packages", {
    method: "POST",
    headers: adminHeaders(),
    credentials: "same-origin",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(err?.error ?? "Failed to create listing package");
  }
  return res.json() as Promise<ListingPackageResponse>;
}

export async function classifyProductIntake(data: ProductIntakeRequest): Promise<ProductIntakeResponse> {
  const res = await fetch("/api/products/intake", {
    method: "POST",
    headers: adminHeaders(),
    credentials: "same-origin",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null) as { error?: string } | ProductIntakeResponse | null;
    if (err && "classification" in err) return err;
    throw new Error(err?.error ?? "Product intake could not classify that value.");
  }
  return res.json() as Promise<ProductIntakeResponse>;
}

export async function saveProductIdentifierMapping(data: ProductIdentifierMappingRequest): Promise<ProductIdentifierMappingResponse> {
  const res = await fetch("/api/product-identifiers", {
    method: "POST",
    headers: adminHeaders(),
    credentials: "same-origin",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(err?.error ?? "Failed to save identifier mapping");
  }
  return res.json() as Promise<ProductIdentifierMappingResponse>;
}

export async function fetchAccountConnectionShells(): Promise<AccountConnectionShell[]> {
  const res = await fetch("/api/listings/account-connections", { headers: adminHeaders(), credentials: "same-origin" });
  if (!res.ok) throw new Error("Failed to load account connection shells");
  return res.json() as Promise<AccountConnectionShell[]>;
}

export async function fetchChannels(): Promise<ChannelDefinition[]> {
  const res = await fetch("/api/channels", { credentials: "same-origin" });
  if (!res.ok) throw new Error("Failed to load channels");
  const data = await res.json() as { channels: ChannelDefinition[] };
  return data.channels;
}

export async function fetchChannelConnections(): Promise<ChannelConnection[]> {
  const res = await fetch("/api/channel-connections", { headers: adminHeaders(), credentials: "same-origin" });
  if (!res.ok) throw new Error("Failed to load channel connections");
  const data = await res.json() as { connections: ChannelConnection[] };
  return data.connections;
}

export async function createChannelConnection(channel: string): Promise<ChannelConnectionCreateResponse> {
  const res = await fetch("/api/channel-connections", {
    method: "POST",
    headers: adminHeaders(),
    credentials: "same-origin",
    body: JSON.stringify({ channel }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(err?.error ?? "Could not create channel connection shell.");
  }
  return res.json() as Promise<ChannelConnectionCreateResponse>;
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
