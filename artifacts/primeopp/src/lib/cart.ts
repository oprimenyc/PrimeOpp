// cart.ts — local cart management (stored in localStorage)

export interface CartItem {
  product_id: number;
  title: string;
  thumbnail_url: string | null;
  price: number;
  quantity: number;
  size: string;
  color: string;
}

const CART_KEY = "primeopp_cart";

export function getCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CartItem[];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]): void {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function addToCart(item: CartItem): CartItem[] {
  const cart = getCart();
  // Check if same product+size+color already in cart
  const idx = cart.findIndex(
    (c) => c.product_id === item.product_id && c.size === item.size && c.color === item.color
  );
  if (idx >= 0) {
    cart[idx].quantity += item.quantity;
  } else {
    cart.push(item);
  }
  saveCart(cart);
  return cart;
}

export function removeFromCart(product_id: number, size: string, color: string): CartItem[] {
  const cart = getCart().filter(
    (c) => !(c.product_id === product_id && c.size === size && c.color === color)
  );
  saveCart(cart);
  return cart;
}

export function updateQuantity(product_id: number, size: string, color: string, quantity: number): CartItem[] {
  const cart = getCart().map((c) => {
    if (c.product_id === product_id && c.size === size && c.color === color) {
      return { ...c, quantity };
    }
    return c;
  }).filter((c) => c.quantity > 0);
  saveCart(cart);
  return cart;
}

export function clearCart(): void {
  localStorage.removeItem(CART_KEY);
}

export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}
