// productStore.ts
// Handles saving and loading products from the browser's localStorage.
// This means your product changes are saved automatically and stay
// even when you refresh the page!

import { products as defaultProducts, type Product } from "@/data/products";

// The "key" used to store your products — like a folder name
const STORAGE_KEY = "primeopp_products";

// Get all products — returns your saved products, or the defaults if none saved yet
export function getProducts(): Product[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as Product[];
  } catch {
    // If something goes wrong reading storage, fall back to defaults
  }
  return defaultProducts;
}

// Save the full list of products
export function saveProducts(products: Product[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

// Generate a new unique ID (just takes the highest existing ID and adds 1)
export function generateId(products: Product[]): number {
  if (products.length === 0) return 1;
  return Math.max(...products.map((p) => p.id)) + 1;
}

// Reset back to the original default products
export function resetToDefaults(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export type { Product };
