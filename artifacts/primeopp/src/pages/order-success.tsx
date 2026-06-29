// Order success page — /order-success?session_id=xxx
// Shown after Stripe redirects back after payment

import { useEffect, useState } from "react";
import { clearCart } from "@/lib/cart";
import { fetchProducts, verifyCheckoutSession, type Product } from "@/lib/api";
import ProductCard from "@/components/ProductCard";

interface SessionData {
  status: string;
  customer_email: string | null;
  customer_name: string | null;
  amount_total: number | null;
  shipping?: {
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

function OrderSuccessPage() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [upsells, setUpsells] = useState<Product[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");

    if (!sessionId) {
      setError("No session ID found.");
      setLoading(false);
      return;
    }

    // Clear the cart now that order is placed
    clearCart();
    window.dispatchEvent(new Event("cart-updated"));

    async function fetchSession() {
      try {
        const data = await verifyCheckoutSession(sessionId!);
        setSession(data);
      } catch {
        setError("Could not verify order. Your payment went through — check your email for confirmation.");
      } finally {
        setLoading(false);
      }
    }
    void fetchSession();
    fetchProducts().then((products) => setUpsells(products.slice(0, 4))).catch(() => setUpsells([]));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-zinc-400 text-sm tracking-widest uppercase animate-pulse">Confirming your order...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">

      {error ? (
        <div className="max-w-md w-full text-center">
          <div className="text-4xl mb-6">⚠️</div>
          <p className="text-yellow-500 font-bold text-sm tracking-widest uppercase mb-4">Order Received</p>
          <p className="text-zinc-400 text-sm normal-case leading-relaxed">{error}</p>
          <a href="/" className="inline-block mt-8 text-xs text-zinc-500 tracking-widest uppercase hover:text-white transition-colors">
            ← Back to store
          </a>
        </div>
      ) : (
        <div className="max-w-md w-full">

          {/* Big checkmark */}
          <div className="w-20 h-20 bg-red-600 flex items-center justify-center mb-8 mx-auto">
            <span className="text-white text-4xl font-black">✓</span>
          </div>

          <div className="text-center mb-10">
            <p className="text-[10px] tracking-[0.4em] text-red-600 uppercase mb-3">Payment Confirmed</p>
            <h1 className="text-4xl font-black tracking-wide uppercase">
              ORDER<br />PLACED!
            </h1>
            {session?.customer_name && (
              <p className="text-zinc-400 text-sm normal-case mt-3">Thanks, {session.customer_name}!</p>
            )}
          </div>

          {/* Order details box */}
          <div className="bg-zinc-950 border border-zinc-900 p-6 space-y-4 mb-8">

            {session?.customer_email && (
              <div>
                <p className="text-zinc-600 text-[10px] tracking-[0.3em] uppercase mb-1">Confirmation sent to</p>
                <p className="text-white text-sm normal-case">{session.customer_email}</p>
              </div>
            )}

            {session?.amount_total && (
              <div>
                <p className="text-zinc-600 text-[10px] tracking-[0.3em] uppercase mb-1">Total charged</p>
                <p className="text-red-600 font-black text-lg">${(session.amount_total / 100).toFixed(2)}</p>
              </div>
            )}

            {session?.shipping?.address?.city && (
              <div>
                <p className="text-zinc-600 text-[10px] tracking-[0.3em] uppercase mb-1">Shipping to</p>
                <p className="text-zinc-300 text-sm normal-case">
                  {session.shipping.address.line1}, {session.shipping.address.city},{" "}
                  {session.shipping.address.state} {session.shipping.address.postal_code}
                </p>
              </div>
            )}
          </div>

          {/* What happens next */}
          <div className="border-l-4 border-red-600 pl-5 mb-8 space-y-3">
            <p className="text-zinc-500 text-[10px] tracking-[0.3em] uppercase">What happens next</p>
            <p className="text-zinc-400 text-sm normal-case">1. Your item goes to production (1–3 days)</p>
            <p className="text-zinc-400 text-sm normal-case">2. It ships with tracking (3–7 days)</p>
            <p className="text-zinc-400 text-sm normal-case">3. You'll get a tracking email when it ships</p>
          </div>

          <a
            href="/"
            className="block w-full text-center bg-zinc-900 border border-zinc-800 text-white font-black text-xs py-4 tracking-[0.3em] uppercase hover:border-zinc-600 hover:bg-zinc-800 transition-colors"
          >
            Continue Shopping
          </a>

          {upsells.length > 0 && (
            <section className="mt-12">
              <p className="text-zinc-500 text-[10px] tracking-[0.3em] uppercase mb-4">Post-Purchase Picks</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {upsells.slice(0, 2).map((product) => <ProductCard key={product.id} product={product} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export default OrderSuccessPage;
