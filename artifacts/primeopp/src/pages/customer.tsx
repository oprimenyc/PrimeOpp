import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Seo } from "@/components/Seo";
import { fetchLoyalty, fetchProducts, lookupOrder, type OrderLookupResult, type Product } from "@/lib/api";
import { getWishlist, removeFromWishlist } from "@/lib/wishlist";

export function AccountPage() {
  const [email, setEmail] = useState("");
  const [loyalty, setLoyalty] = useState<Awaited<ReturnType<typeof fetchLoyalty>> | null>(null);
  const [error, setError] = useState("");

  async function lookupRewards() {
    setError("");
    try {
      setLoyalty(await fetchLoyalty(email));
    } catch {
      setError("Rewards could not be loaded.");
    }
  }

  return (
    <Shell title="Account" description="Manage your PrimeOpp rewards and customer details.">
      <div className="max-w-xl">
        <p className="text-zinc-400 normal-case mb-6">Customer accounts are optional. Enter your checkout email to view reward points, VIP level, referrals, and redemption status.</p>
        <div className="grid grid-cols-[1fr_auto] gap-2 mb-6">
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="bg-zinc-950 border border-zinc-800 px-4 py-3 text-sm text-white normal-case outline-none focus:border-red-600" />
          <button onClick={() => void lookupRewards()} className="bg-red-600 text-white px-5 text-xs font-black tracking-widest uppercase hover:bg-white hover:text-black transition-colors">Lookup</button>
        </div>
        {error && <p className="text-red-500 text-sm normal-case">{error}</p>}
        {loyalty && (
          <div className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <RewardStat label="Points" value={String(loyalty.account.points_balance)} />
              <RewardStat label="VIP Level" value={loyalty.account.vip_level} />
              <RewardStat label="Referral" value={loyalty.account.referral_code ?? "Pending"} />
            </div>
            <div className="border border-zinc-900 bg-zinc-950 p-5">
              <p className="text-[10px] tracking-[0.35em] text-zinc-500 font-black uppercase mb-4">Points History</p>
              {loyalty.history.length === 0 ? (
                <p className="text-zinc-600 text-sm normal-case">Earn points with your next order, birthday reward, review, or referral.</p>
              ) : loyalty.history.map((entry, index) => (
                <div key={`${entry.reason}-${index}`} className="flex justify-between border-b border-zinc-900 py-3 last:border-0">
                  <span className="text-zinc-400 text-sm normal-case">{entry.reason}</span>
                  <span className="text-red-600 font-black">{entry.points}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

export function CustomerOrdersPage() {
  const [orderId, setOrderId] = useState("");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<OrderLookupResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setOrder(null);
    const id = Number(orderId);
    if (!Number.isInteger(id) || id <= 0) {
      setError("Enter a valid order number.");
      return;
    }
    setLoading(true);
    try {
      setOrder(await lookupOrder(id, email));
    } catch {
      setError("No order found for that order number and email. Double-check both and try again, or contact support.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell title="Orders" description="Look up a PrimeOpp order.">
      <p className="text-zinc-400 normal-case mb-6">Enter your order number and the email used at checkout to view its status.</p>
      <form onSubmit={(event) => void handleLookup(event)} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 mb-6 max-w-2xl">
        <input value={orderId} onChange={(event) => setOrderId(event.target.value)} placeholder="Order number" inputMode="numeric" className="bg-zinc-950 border border-zinc-800 px-4 py-3 text-sm text-white normal-case outline-none focus:border-red-600" />
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" className="bg-zinc-950 border border-zinc-800 px-4 py-3 text-sm text-white normal-case outline-none focus:border-red-600" />
        <button disabled={loading} className="bg-red-600 text-white px-5 text-xs font-black tracking-widest uppercase hover:bg-white hover:text-black transition-colors disabled:opacity-50">{loading ? "Looking up..." : "Find Order"}</button>
      </form>
      {error && <p className="text-red-500 text-sm normal-case mb-6">{error}</p>}
      {order && (
        <div className="border border-zinc-900 bg-zinc-950 p-5 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <RewardStat label="Order" value={`#${order.id}`} />
            <RewardStat label="Status" value={order.status} />
            <RewardStat label="Fulfillment" value={order.fulfillment_status ?? "Pending"} />
          </div>
          <p className="text-zinc-600 text-[10px] tracking-[0.35em] font-black uppercase mb-3">Items</p>
          <div className="mb-4">
            {(order.items ?? []).map((item, index) => (
              <div key={`${item.title}-${index}`} className="flex justify-between border-b border-zinc-900 py-2 last:border-0 text-sm normal-case">
                <span className="text-zinc-400">{item.title} {item.size ? `· ${item.size}` : ""} {item.color ? `· ${item.color}` : ""} × {item.quantity}</span>
              </div>
            ))}
          </div>
          {order.shipping_address && (
            <p className="text-zinc-500 text-xs normal-case">
              Shipping to {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postal_code}
            </p>
          )}
          {order.total !== null && (
            <p className="text-white font-black mt-3">Total: ${Number(order.total).toFixed(2)}</p>
          )}
        </div>
      )}
    </Shell>
  );
}

export function WishlistPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [ids, setIds] = useState<number[]>([]);

  function refresh() {
    const wishlistIds = getWishlist();
    setIds(wishlistIds);
    fetchProducts()
      .then((all) => setProducts(wishlistIds.map((id) => all.find((product) => product.id === id)).filter(Boolean) as Product[]))
      .catch(() => setProducts([]));
  }

  useEffect(() => {
    refresh();
    window.addEventListener("wishlist-updated", refresh);
    return () => window.removeEventListener("wishlist-updated", refresh);
  }, []);

  return (
    <Shell title="Wishlist" description="Save PrimeOpp products for later.">
      <p className="text-zinc-500 normal-case mb-6">Wishlist items are saved locally in this browser only — they won't follow you to another device.</p>
      {ids.length === 0 ? (
        <p className="text-zinc-400 normal-case">Nothing saved yet. Tap "Save to Wishlist" on any product page.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {products.map((p) => (
            <div key={p.id} className="border border-zinc-800 p-5 hover:border-red-600 flex flex-col gap-3">
              <a href={`/product/${p.id}`} className="text-white font-bold">{p.title}</a>
              <button
                onClick={() => removeFromWishlist(p.id)}
                className="text-[10px] tracking-widest uppercase text-zinc-500 hover:text-red-600 self-start"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

export function RecentlyViewedPage() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const ids = getRecentProductIds();
    fetchProducts()
      .then((all) => setProducts(ids.map((id) => all.find((product) => product.id === id)).filter(Boolean) as Product[]))
      .catch(() => setProducts([]));
  }, []);

  return (
    <Shell title="Recently Viewed" description="Products you viewed recently.">
      {products.length === 0 ? (
        <p className="text-zinc-400 normal-case">Products you view will appear here.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {products.map((product) => (
            <a key={product.id} href={`/product/${product.id}`} className="border border-zinc-800 p-5 hover:border-red-600">
              <span className="text-white font-bold">{product.title}</span>
            </a>
          ))}
        </div>
      )}
    </Shell>
  );
}

function getRecentProductIds(): number[] {
  try {
    const parsed = JSON.parse(localStorage.getItem("primeopp_recent_products") ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is number => Number.isInteger(item)) : [];
  } catch {
    return [];
  }
}

function Shell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-28">
      <Seo title={title} description={description} />
      <div className="max-w-4xl mx-auto">
        <p className="text-red-600 text-[10px] tracking-[0.45em] font-black uppercase mb-4">Customer</p>
        <h1 className="text-5xl font-black uppercase mb-6">{title}</h1>
        {children}
      </div>
    </main>
  );
}

function RewardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-900 bg-zinc-950 p-5">
      <p className="text-zinc-600 text-[9px] tracking-[0.35em] font-black uppercase mb-2">{label}</p>
      <p className="text-white text-xl font-black uppercase">{value}</p>
    </div>
  );
}
