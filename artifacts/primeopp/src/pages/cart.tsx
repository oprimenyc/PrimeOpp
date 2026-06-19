// Cart page — /cart
// Shows items in localStorage cart, lets user proceed to Stripe checkout

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { getCart, removeFromCart, updateQuantity, cartTotal, cartCount, type CartItem } from "@/lib/cart";
import { createCheckoutSession } from "@/lib/api";

function CartPage() {
  const [, setLocation] = useLocation();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setCart(getCart());
  }, []);

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
      const { url } = await createCheckoutSession(cart);
      if (url) {
        window.location.href = url; // Redirect to Stripe Checkout
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed. Please try again.");
      setLoading(false);
    }
  }

  const total = cartTotal(cart);
  const count = cartCount(cart);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-zinc-900 px-6 py-4 flex items-center justify-between">
        <a href="/" className="text-xs text-zinc-500 tracking-widest uppercase hover:text-white transition-colors">
          ← Keep Shopping
        </a>
        <span className="text-white font-black text-sm tracking-widest uppercase">YOUR CART</span>
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
            {/* Items */}
            <div className="space-y-0 mb-8">
              {cart.map((item) => (
                <div
                  key={`${item.product_id}-${item.size}-${item.color}`}
                  className="flex gap-4 py-5 border-b border-zinc-900"
                >
                  {/* Thumbnail */}
                  <div className="w-20 h-20 bg-zinc-950 flex-shrink-0 overflow-hidden">
                    {item.thumbnail_url ? (
                      <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">👕</div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm tracking-wide uppercase truncate">{item.title}</p>
                    <p className="text-zinc-500 text-xs tracking-widest uppercase mt-1">
                      {[item.size, item.color].filter(Boolean).join(" / ")}
                    </p>

                    {/* Qty controls */}
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => handleQty(item, -1)}
                        className="w-7 h-7 border border-zinc-700 text-zinc-400 hover:border-white hover:text-white text-xs font-black transition-colors"
                      >
                        −
                      </button>
                      <span className="text-white text-sm font-bold w-5 text-center">{item.quantity}</span>
                      <button
                        onClick={() => handleQty(item, 1)}
                        className="w-7 h-7 border border-zinc-700 text-zinc-400 hover:border-white hover:text-white text-xs font-black transition-colors"
                      >
                        +
                      </button>
                      <button
                        onClick={() => handleRemove(item)}
                        className="ml-3 text-zinc-600 text-xs tracking-widest uppercase hover:text-red-600 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="flex-shrink-0 text-right">
                    <p className="text-white font-black text-sm">${(item.price * item.quantity).toFixed(2)}</p>
                    {item.quantity > 1 && (
                      <p className="text-zinc-600 text-xs mt-1">${item.price.toFixed(2)} each</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="bg-zinc-950 border border-zinc-900 p-6">
              <div className="flex justify-between items-center mb-3">
                <span className="text-zinc-500 text-xs tracking-widest uppercase">Subtotal</span>
                <span className="text-white font-bold">${total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-zinc-500 text-xs tracking-widest uppercase">Shipping</span>
                <span className="text-zinc-400 text-xs">Calculated at checkout</span>
              </div>
              <div className="border-t border-zinc-800 pt-4 mt-4 flex justify-between items-center">
                <span className="text-white font-black text-sm tracking-widest uppercase">Total</span>
                <span className="text-red-600 font-black text-xl">${total.toFixed(2)}</span>
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
                {loading ? "REDIRECTING TO CHECKOUT..." : `CHECKOUT — $${total.toFixed(2)}`}
              </button>

              <p className="text-center text-zinc-600 text-xs mt-4 normal-case tracking-wider">
                🔒 Secure checkout powered by Stripe
              </p>
            </div>

            {/* Legal links */}
            <div className="flex justify-center gap-6 mt-8">
              <a href="/terms" className="text-zinc-700 text-xs tracking-widest uppercase hover:text-zinc-400 transition-colors">Terms</a>
              <a href="/privacy" className="text-zinc-700 text-xs tracking-widest uppercase hover:text-zinc-400 transition-colors">Privacy</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default CartPage;
