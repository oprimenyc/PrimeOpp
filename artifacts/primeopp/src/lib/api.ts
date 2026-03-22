// api.ts — helper functions for calling the backend API
// All API calls go to /api/... which routes to the Express server

// The product type matching our database schema
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
  created_at: string;
}

export interface ColorVariant {
  name: string;
  hex: string;
  price: number;
}

// Get the JWT token from localStorage (set when admin logs in)
function getToken(): string | null {
  return localStorage.getItem("primeopp_admin_token");
}

// Build auth headers for admin requests
function adminHeaders(): Record<string, string> {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// Fetch all products
export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch("/api/products");
  if (!res.ok) throw new Error("Failed to load products");
  return res.json() as Promise<Product[]>;
}

// Fetch one product by id
export async function fetchProduct(id: number): Promise<Product> {
  const res = await fetch(`/api/products/${id}`);
  if (!res.ok) throw new Error("Product not found");
  return res.json() as Promise<Product>;
}

// Create a product (admin only)
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

// Update a product (admin only)
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

// Delete a product (admin only)
export async function deleteProduct(id: number): Promise<void> {
  const res = await fetch(`/api/products/${id}`, {
    method: "DELETE",
    headers: adminHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete product");
}

// Admin login — returns and stores the token
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

// Check if admin token is valid
export async function verifyToken(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/verify", {
      headers: adminHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Log out — remove the token
export function adminLogout(): void {
  localStorage.removeItem("primeopp_admin_token");
}

// Quick check: does a token exist in localStorage?
export function isLoggedIn(): boolean {
  return Boolean(localStorage.getItem("primeopp_admin_token"));
}
