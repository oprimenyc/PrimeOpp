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
  pod_provider: "printful" | "tapstitch";
  created_at: string;
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

export interface CheckoutSessionResponse {
  url: string;
  session_id: string;
}

export interface SessionVerification {
  status: string;
  customer_email: string | null;
  customer_name: string | null;
  amount_total: number | null;
  shipping: unknown;
}

import type { CartItem } from "@/lib/cart";

function getToken(): string | null {
  return localStorage.getItem("primeopp_admin_token");
}

function adminHeaders(): Record<string, string> {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

export async function createProduct(data: Partial<Product>): Promise<Product> {
  const res = await fetch("/api/products", {
    method: "POST",
    headers: adminHeaders(),
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
  });
  if (!res.ok) throw new Error("Failed to delete product");
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function adminLogin(username: string, password: string): Promise<void> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json() as { error: string };
    throw new Error(err.error ?? "Login failed");
  }
  const data = await res.json() as { token: string };
  localStorage.setItem("primeopp_admin_token", data.token);
}

export async function verifyToken(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/verify", { headers: adminHeaders() });
    return res.ok;
  } catch {
    return false;
  }
}

export function adminLogout(): void {
  localStorage.removeItem("primeopp_admin_token");
}

export function isLoggedIn(): boolean {
  return Boolean(localStorage.getItem("primeopp_admin_token"));
}

// ─── Checkout ─────────────────────────────────────────────────────────────────

export async function createCheckoutSession(
  items: CartItem[]
): Promise<CheckoutSessionResponse> {
  const apiItems = items.map((i) => ({
    product_id: i.product_id,
    title: i.title,
    quantity: i.quantity,
    size: i.size,
    color: i.color,
    price: i.price,
    pod_provider: i.pod_provider,
  }));

  const res = await fetch("/api/checkout/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: apiItems,
      cancel_url: `${window.location.origin}/cart`,
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

// ─── Orders (admin) ───────────────────────────────────────────────────────────

export async function fetchOrders(): Promise<Order[]> {
  const res = await fetch("/api/orders", { headers: adminHeaders() });
  if (!res.ok) throw new Error("Failed to load orders");
  return res.json() as Promise<Order[]>;
}

export async function updateOrderStatus(id: number, status: string): Promise<Order> {
  const res = await fetch(`/api/orders/${id}/status`, {
    method: "PATCH",
    headers: adminHeaders(),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update order");
  return res.json() as Promise<Order>;
}
