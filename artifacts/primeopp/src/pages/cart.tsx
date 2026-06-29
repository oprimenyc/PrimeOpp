import { useEffect, useState } from "react";
import { getCart, removeFromCart, updateQuantity, cartTotal, cartCount, type CartItem } from "@/lib/cart";
import { createCheckoutSession, fetchProducts, quoteDiscount, trackAbandonedCart, type DiscountQuote, type Product } from "@/lib/api";
import ProductCard from "@/components/ProductCard";

function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState<DiscountQuote | null>(null);
  const [upsells, setUpsells] = useState<Product[]>([]);

  useEffect(() => {
    setCart(getCart());
    fetchProducts().then((products) => setUpsells(products.slice(0, 8))).catch(() => setUpsells([]));
  }, []);

  useEffect(() => {
    if (cart.length === 0) return;
    const id = window.setTimeout(() => {
      void trackAbandonedCart(cart, email || null);
    }, 700);
    return () => window.clearTimeout(id);
  }, [cart, email]);

  function handleRemove(item: CartItem) {
    setCart(removeFromCart(item.product_id, item.size, item.color));
  }

  function handleQty(item: CartItem, delta: number) {
    setCart(updateQuantity(item.product_id, item.size, item.color, item.quantity + delta));
  }

  async function handleCheckout() {
    if (cart.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const { url } = await createCheckoutSession(cart, coupon || undefined);
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed. Please try again.");
      setLoading(false);
    }
  }

  async function applyDiscount() {
    if (cart.length === 0) return;
    setError("");
    try {
      setDiscount(await quoteDiscount(cart, coupon || undefined));
    } catch (err) {
      setDiscount(null);
      setError(err instanceof Error ? err.message : "Discount failed. Please try again.");
    }
  }

  const total = cartTotal(cart);
  const discountAmount = discount?.discount?.amount ?? 0;
  const discountedTotal = Math.max(0, total - discountAmount);
  const count = cartCount(cart);
  const cartProductIds = new Set(cart.map((item) => item.product_id));
  const visibleUpsells = upsells.filter((product) => !cartProductIds.has(product.id)).slice(0, 4);
  const freeShippingProgress = Math.min(100, (total / 100) * 100);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-zinc-900 px-6 py-4 flex items-center justify-between">
        <a href="/" className="text-xs text-zinc-500 tracking-widest uppercase hover:text-white transition-colors">
          Back to shop
        </a>
        <span className="text-white font-black text-sm tracking-widest uppercase">Your Cart</span>
        <span className="text-zinc-500 text-xs tracking-widest uppercase">{count} item{count !== 1 ? "s" : ""}</span>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12">
        {cart.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-zinc-600 text-sm tracking-widest uppercase mb-6">Your cart is empty</p>
            <a
              href="/"
              className="bg-red-600 text-white font-black text-xs px-8 py-4 tracking-[0.3em] uppercase hover:bg-white hover:text-black transition-colors inline-block"
            >
              Shop Now
            </a>
          </div>
        ) : (
          <>
            <div className="space-y-0 mb-8">
              {cart.map((item) => (
                <div key={`${item.product_id}-${item.size}-${item.color}`} className="flex gap-4 py-5 border-b border-zinc-900">
                  <div className="w-20 h-20 bg-zinc-950 flex-shrink-0 overflow-hidden">
                    {item.thumbnail_url ? (
                      <img src={item.thumbnail_url} alt={item.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">Item</div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm tracking-wide uppercase truncate">{item.title}</p>
                    <p className="text-zinc-500 text-xs tracking-widest uppercase mt-1">
                      {[item.size, item.color].filter(Boolean).join(" / ")}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <button onClick={() => handleQty(item, -1)} className="w-7 h-7 border border-zinc-700 text-zinc-400 hover:border-white hover:text-white text-xs font-black transition-colors">-</button>
                      <span className="text-white text-sm font-bold w-5 text-center">{item.quantity}</span>
                      <button onClick={() => handleQty(item, 1)} className="w-7 h-7 border border-zinc-700 text-zinc-400 hover:border-white hover:text-white text-xs font-black transition-colors">+</button>
                      <button onClick={() => handleRemove(item)} className="ml-3 text-zinc-600 text-xs tracking-widest uppercase hover:text-red-600 transition-colors">
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <p className="text-white font-black text-sm">${(item.price * item.quantity).toFixed(2)}</p>
                    {item.quantity > 1 && <p className="text-zinc-600 text-xs mt-1">${item.price.toFixed(2)} each</p>}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-zinc-950 border border-zinc-900 p-6">
              <div className="flex justify-between items-center mb-3">
                <span className="text-zinc-500 text-xs tracking-widest uppercase">Subtotal</span>
                <span className="text-white font-bold">${total.toFixed(2)}</span>
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-[10px] tracking-widest uppercase text-zinc-500 mb-2">
                  <span>{total >= 100 ? "Free shipping unlocked" : `$${(100 - total).toFixed(2)} from free shipping`}</span>
                  <span>{Math.round(freeShippingProgress)}%</span>
                </div>
                <div className="h-2 bg-zinc-900 overflow-hidden">
                  <div className="h-full bg-red-600 transition-all" style={{ width: `${freeShippingProgress}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-2 mb-4">
                <input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="FIRST15 or VIP20" className="bg-black border border-zinc-800 px-3 py-3 text-xs text-white outline-none focus:border-red-600" />
                <button onClick={() => void applyDiscount()} className="bg-zinc-900 border border-zinc-800 px-4 text-xs font-black tracking-widest uppercase hover:border-red-600">Apply</button>
              </div>

              {discount?.discount && (
                <div className="flex justify-between items-center mb-3">
                  <span className="text-zinc-500 text-xs tracking-widest uppercase">{discount.discount.name}</span>
                  <span className="text-red-600 font-bold">-${discountAmount.toFixed(2)}</span>
                </div>
              )}

              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email for cart recovery + rewards" className="w-full bg-black border border-zinc-800 px-3 py-3 text-xs text-white outline-none focus:border-red-600 mb-4 normal-case" />

              <div className="flex justify-between items-center mb-3">
                <span className="text-zinc-500 text-xs tracking-widest uppercase">Shipping</span>
                <span className="text-zinc-400 text-xs">{discount?.free_shipping || total >= 100 ? "Free shipping eligible" : "Calculated at checkout"}</span>
              </div>
              <div className="border-t border-zinc-800 pt-4 mt-4 flex justify-between items-center">
                <span className="text-white font-black text-sm tracking-widest uppercase">Total</span>
                <span className="text-red-600 font-black text-xl">${discountedTotal.toFixed(2)}</span>
              </div>

              {error && (
                <div className="mt-4 bg-zinc-900 border-l-4 border-red-600 px-4 py-3">
                  <p className="text-red-400 text-xs normal-case">{error}</p>
                </div>
              )}

              <button
                onClick={() => void handleCheckout()}
                disabled={loading}
                className="w-full mt-6 bg-red-600 text-white font-black text-sm py-5 tracking-[0.3em] uppercase hover:bg-white hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Redirecting to checkout..." : `Checkout - $${discountedTotal.toFixed(2)}`}
              </button>

              {visibleUpsells.length > 0 && (
                <div className="mt-8 border-t border-zinc-900 pt-6">
                  <p className="text-[10px] tracking-[0.35em] text-zinc-500 font-black uppercase mb-4">Checkout Upsells</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {visibleUpsells.slice(0, 2).map((product) => <MiniUpsell key={product.id} product={product} />)}
                  </div>
                </div>
              )}

              <p className="text-center text-zinc-600 text-xs mt-4 normal-case tracking-wider">
                Secure checkout powered by Stripe
              </p>
            </div>

            <div className="flex justify-center gap-6 mt-8">
              <a href="/terms" className="text-zinc-700 text-xs tracking-widest uppercase hover:text-zinc-400 transition-colors">Terms</a>
              <a href="/privacy" className="text-zinc-700 text-xs tracking-widest uppercase hover:text-zinc-400 transition-colors">Privacy</a>
            </div>
          </>
        )}
      </div>

      {visibleUpsells.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 pb-16">
          <h2 className="text-xl font-black tracking-[0.25em] uppercase mb-5">Cart Upsells</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {visibleUpsells.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function MiniUpsell({ product }: { product: Product }) {
  return (
    <a href={`/product/${product.id}`} className="flex gap-3 border border-zinc-900 bg-black p-3 hover:border-red-600 transition-colors">
      {product.thumbnail_url && <img src={product.thumbnail_url} alt={product.title} loading="lazy" decoding="async" className="w-14 h-14 object-cover" />}
      <span className="min-w-0">
        <span className="block text-white text-xs font-black uppercase truncate">{product.title}</span>
        <span className="block text-red-600 text-xs mt-1">${Number(product.price ?? 0).toFixed(2)}</span>
      </span>
    </a>
  );
}

export default CartPage;
