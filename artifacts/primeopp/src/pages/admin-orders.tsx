// Admin Orders page — /admin/orders
// View and manage all customer orders

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { fetchOrders, updateOrderStatus, verifyToken, adminLogout, type Order } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-500 border-yellow-500",
  paid: "text-blue-400 border-blue-400",
  fulfilled: "text-green-500 border-green-500",
  shipped: "text-green-400 border-green-400",
  cancelled: "text-red-500 border-red-500",
  refunded: "text-zinc-500 border-zinc-500",
};

const STATUS_OPTIONS = ["pending", "paid", "fulfilled", "shipped", "cancelled", "refunded"];

function AdminOrdersPage() {
  const [, setLocation] = useLocation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    async function checkAuth() {
      const valid = await verifyToken();
      if (!valid) { setLocation("/admin/login"); return; }
      await loadOrders();
    }
    void checkAuth();
  }, [setLocation]);

  async function loadOrders() {
    setLoading(true);
    try {
      const data = await fetchOrders();
      setOrders(data);
    } catch {
      flash("❌ Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  function flash(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3500);
  }

  async function handleStatusChange(orderId: number, status: string) {
    try {
      const updated = await updateOrderStatus(orderId, status);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      flash(`✅ Order #${orderId} marked as ${status}`);
    } catch {
      flash("❌ Failed to update order status");
    }
  }

  function handleLogout() {
    void adminLogout();
    setLocation("/admin/login");
  }

  const totalRevenue = orders
    .filter((o) => o.status !== "cancelled" && o.status !== "refunded")
    .reduce((sum, o) => sum + (o.total ?? 0), 0);

  return (
    <div className="min-h-screen bg-black text-white">

      {/* Top bar */}
      <div className="border-b border-zinc-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-white font-black text-sm tracking-widest uppercase">PRIMEOPP ADMIN</span>
          <nav className="hidden md:flex items-center gap-4">
            <a href="/admin" className="text-xs text-zinc-500 tracking-widest uppercase hover:text-white transition-colors">Products</a>
            <a href="/admin/sourcing" className="text-xs text-zinc-500 tracking-widest uppercase hover:text-white transition-colors">Sourcing</a>
            <a href="/admin/dashboard" className="text-xs text-zinc-500 tracking-widest uppercase hover:text-white transition-colors">Dashboard</a>
            <span className="text-xs text-white tracking-widest uppercase border-b border-red-600 pb-0.5">Orders</span>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <a href="/" className="text-xs text-zinc-600 tracking-widest uppercase hover:text-white transition-colors">← Store</a>
          <button onClick={handleLogout} className="text-xs text-zinc-600 tracking-widest uppercase hover:text-red-600 transition-colors">Logout</button>
        </div>
      </div>

      <div className="px-6 py-8">

        {/* Flash message */}
        {message && (
          <div className="mb-6 bg-zinc-900 border-l-4 border-red-600 px-4 py-3">
            <p className="text-white text-xs tracking-wider">{message}</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Orders", value: orders.length },
            { label: "Revenue", value: `$${totalRevenue.toFixed(2)}` },
            { label: "Pending", value: orders.filter((o) => o.status === "pending" || o.status === "paid").length },
            { label: "Fulfilled", value: orders.filter((o) => o.status === "fulfilled" || o.status === "shipped").length },
          ].map((stat) => (
            <div key={stat.label} className="bg-zinc-950 border border-zinc-900 p-5">
              <p className="text-zinc-600 text-[9px] font-bold tracking-[0.4em] uppercase mb-2">{stat.label}</p>
              <p className="text-white text-2xl font-black">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Orders table */}
        <div className="bg-zinc-950 border border-zinc-900 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-900 flex items-center justify-between">
            <p className="text-[10px] font-bold tracking-[0.4em] text-zinc-500 uppercase">All Orders</p>
            <button
              onClick={() => void loadOrders()}
              className="text-[10px] text-zinc-600 tracking-widest uppercase hover:text-white transition-colors"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center">
              <p className="text-zinc-600 text-xs tracking-widest uppercase animate-pulse">Loading orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-zinc-700 text-xs tracking-widest uppercase">No orders yet</p>
              <p className="text-zinc-800 text-xs mt-2 normal-case">Orders will appear here after customers pay</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-900">
                    {["#", "Customer", "Items", "Total", "Status", "Provider", "Date", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[9px] font-bold tracking-[0.3em] text-zinc-600 uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <>
                      <tr
                        key={order.id}
                        className="border-b border-zinc-900 hover:bg-zinc-900 cursor-pointer transition-colors"
                        onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                      >
                        <td className="px-4 py-4 text-zinc-500 font-mono">#{order.id}</td>
                        <td className="px-4 py-4">
                          <p className="text-white font-bold">{order.customer_name ?? "—"}</p>
                          <p className="text-zinc-600 normal-case">{order.customer_email}</p>
                        </td>
                        <td className="px-4 py-4 text-zinc-400">
                          {Array.isArray(order.items) ? order.items.length : 0} item{Array.isArray(order.items) && order.items.length !== 1 ? "s" : ""}
                        </td>
                        <td className="px-4 py-4 text-white font-black">
                          ${(order.total ?? 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`text-[9px] font-bold tracking-[0.2em] uppercase border px-2 py-1 ${STATUS_COLORS[order.status] ?? "text-zinc-500 border-zinc-700"}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-zinc-600 uppercase text-[9px] tracking-widest">
                          {order.fulfillment_status ?? "—"}
                        </td>
                        <td className="px-4 py-4 text-zinc-500 whitespace-nowrap normal-case">
                          {new Date(order.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-4">
                          <select
                            value={order.status}
                            onChange={(e) => { e.stopPropagation(); void handleStatusChange(order.id, e.target.value); }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-zinc-900 border border-zinc-700 text-white text-[10px] px-2 py-1 uppercase tracking-wider"
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                      </tr>

                      {/* Expanded row */}
                      {expandedId === order.id && (
                        <tr key={`${order.id}-detail`} className="border-b border-zinc-900 bg-zinc-950">
                          <td colSpan={8} className="px-6 py-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                              {/* Items */}
                              <div>
                                <p className="text-[9px] font-bold tracking-[0.3em] text-zinc-600 uppercase mb-3">Items Ordered</p>
                                <div className="space-y-2">
                                  {(Array.isArray(order.items) ? order.items : []).map((item, i) => (
                                    <div key={i} className="flex justify-between">
                                      <div>
                                        <span className="text-white font-bold">{item.title}</span>
                                        <span className="text-zinc-500 ml-2 normal-case">
                                          {[item.size, item.color].filter(Boolean).join(" / ")}
                                        </span>
                                        <span className="text-zinc-600 ml-2">×{item.quantity}</span>
                                      </div>
                                      <span className="text-white">${(item.price * item.quantity).toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Shipping + fulfillment */}
                              <div className="space-y-4">
                                {order.shipping_address && (
                                  <div>
                                    <p className="text-[9px] font-bold tracking-[0.3em] text-zinc-600 uppercase mb-2">Ship To</p>
                                    <p className="text-zinc-300 normal-case text-xs leading-relaxed">
                                      {order.shipping_address.name}<br />
                                      {order.shipping_address.line1}<br />
                                      {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postal_code}<br />
                                      {order.shipping_address.country}
                                    </p>
                                  </div>
                                )}
                                {order.fulfillment_order_id && (
                                  <div>
                                    <p className="text-[9px] font-bold tracking-[0.3em] text-zinc-600 uppercase mb-1">Fulfillment ID</p>
                                    <p className="text-zinc-400 font-mono text-xs normal-case">{order.fulfillment_order_id}</p>
                                  </div>
                                )}
                                {order.stripe_payment_intent && (
                                  <div>
                                    <p className="text-[9px] font-bold tracking-[0.3em] text-zinc-600 uppercase mb-1">Stripe Payment</p>
                                    <p className="text-zinc-400 font-mono text-xs normal-case">{order.stripe_payment_intent}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminOrdersPage;
