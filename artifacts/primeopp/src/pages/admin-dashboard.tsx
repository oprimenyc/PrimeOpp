import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "wouter";
import {
  fetchAbandonedCarts,
  fetchAdminDashboard,
  fetchAdminReviews,
  fetchAuditLog,
  fetchRevenueDashboard,
  moderateReview,
  verifyToken,
  type AbandonedCartSummary,
  type AdminDashboard,
  type AdminReview,
  type AuditLogEntry,
  type RevenueDashboard,
} from "@/lib/api";

function AdminDashboardPage() {
  const [, setLocation] = useLocation();
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [revenue, setRevenue] = useState<RevenueDashboard | null>(null);
  const [abandonedCarts, setAbandonedCarts] = useState<AbandonedCartSummary[]>([]);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [error, setError] = useState("");
  const [auditError, setAuditError] = useState("");

  useEffect(() => {
    async function load() {
      const valid = await verifyToken();
      if (!valid) {
        setLocation("/admin/login");
        return;
      }
      try {
        const summary = await fetchAdminDashboard();
        setDashboard(summary);
        const revenueSummary = await fetchRevenueDashboard();
        setRevenue(revenueSummary);
        setAbandonedCarts(await fetchAbandonedCarts());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      }

      try {
        setReviews(await fetchAdminReviews());
      } catch {
        setReviews([]);
      }

      try {
        const audit = await fetchAuditLog();
        setAuditLog(audit);
        setAuditError("");
      } catch {
        setAuditLog([]);
        setAuditError("Audit log unavailable for this role.");
      }
    }
    void load();
  }, [setLocation]);

  return (
    <main className="min-h-screen bg-black text-white px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-red-600 text-[10px] tracking-[0.45em] font-black uppercase">Admin</p>
            <h1 className="text-4xl font-black uppercase">Dashboard</h1>
          </div>
          <nav className="flex gap-4 text-xs uppercase tracking-widest">
            <a href="/admin" className="text-zinc-400 hover:text-white">Products</a>
            <a href="/admin/sourcing" className="text-zinc-400 hover:text-white">Sourcing</a>
            <a href="/admin/listings" className="text-zinc-400 hover:text-white">Listings</a>
            <a href="/admin/orders" className="text-zinc-400 hover:text-white">Orders</a>
          </nav>
        </div>

        {error && <p className="border-l-4 border-red-600 bg-zinc-950 px-4 py-3 text-red-400 mb-6">{error}</p>}

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
          <Stat label="Revenue" value={`$${Number(dashboard?.revenue ?? 0).toFixed(2)}`} />
          <Stat label="Order States" value={String(dashboard?.orders.length ?? 0)} />
          <Stat label="Product Types" value={String(dashboard?.products.length ?? 0)} />
          <Stat label="Fulfillment Queues" value={String(dashboard?.fulfillmentJobs.length ?? 0)} />
        </section>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
          <Stat label="AOV" value={`$${Number(revenue?.aov ?? 0).toFixed(2)}`} />
          <Stat label="Repeat Customers" value={String(revenue?.repeat_customers ?? 0)} />
          <Stat label="Abandoned Cart %" value={`${Number(revenue?.abandoned_cart_rate ?? 0).toFixed(1)}%`} />
          <Stat label="Refund Rate" value={`${Number(revenue?.refund_rate ?? 0).toFixed(1)}%`} />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          <Panel title="Top Products">
            {(revenue?.top_products ?? []).length === 0 ? <Empty /> : revenue?.top_products.map((product) => (
              <Row key={product.title} label={product.title} value={`${product.units} units`} />
            ))}
          </Panel>
          <Panel title="Abandoned Cart Recovery">
            <Row label="Active cart value" value={`$${Number(revenue?.abandoned_cart_value ?? 0).toFixed(2)}`} />
            <Row label="Tracked carts" value={String(abandonedCarts.length)} />
            {(revenue?.coupon_usage ?? []).slice(0, 3).map((coupon) => (
              <Row key={coupon.name} label={coupon.code ?? coupon.name} value={`${coupon.usage_count} uses`} />
            ))}
          </Panel>
        </section>

        <section className="mb-10">
          <Panel title="Review Moderation">
            {reviews.filter((review) => review.status === "pending").length === 0 ? <Empty /> : reviews.filter((review) => review.status === "pending").slice(0, 6).map((review) => (
              <div key={review.id} className="border-b border-zinc-900 pb-4 last:border-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-red-600 text-xs">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p>
                    <p className="text-white font-black uppercase mt-1">{review.title}</p>
                    <p className="text-zinc-500 text-xs normal-case">{review.product_title} by {review.customer_name}</p>
                    <p className="text-zinc-400 text-sm normal-case mt-2">{review.body}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => void handleModerateReview(review.id, "approved")} className="bg-red-600 text-white text-[10px] font-black tracking-widest uppercase px-3 py-2">Approve</button>
                    <button onClick={() => void handleModerateReview(review.id, "rejected")} className="border border-zinc-800 text-zinc-400 text-[10px] font-black tracking-widest uppercase px-3 py-2">Reject</button>
                  </div>
                </div>
              </div>
            ))}
          </Panel>
        </section>

        <section className="border border-zinc-900 bg-zinc-950">
          <div className="px-5 py-4 border-b border-zinc-900">
            <h2 className="text-xs font-black tracking-[0.35em] uppercase text-zinc-500">Audit Log</h2>
            {auditError && <p className="text-[11px] text-zinc-600 normal-case mt-2">{auditError}</p>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <tbody>
                {auditLog.map((entry) => (
                  <tr key={entry.id} className="border-b border-zinc-900">
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{new Date(entry.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-white">{entry.action}</td>
                    <td className="px-4 py-3 text-zinc-400">{entry.entity_type}{entry.entity_id ? ` #${entry.entity_id}` : ""}</td>
                    <td className="px-4 py-3 text-zinc-500 normal-case">{entry.actor_email ?? "system"}</td>
                  </tr>
                ))}
                {auditLog.length === 0 && (
                  <tr><td className="px-4 py-8 text-zinc-600 text-center" colSpan={4}>No audit events yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );

  async function handleModerateReview(id: string, status: "approved" | "rejected") {
    await moderateReview(id, status);
    setReviews((current) => current.map((review) => review.id === id ? { ...review, status } : review));
  }
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border border-zinc-900 bg-zinc-950">
      <div className="px-5 py-4 border-b border-zinc-900">
        <h2 className="text-xs font-black tracking-[0.35em] uppercase text-zinc-500">{title}</h2>
      </div>
      <div className="p-5 space-y-3">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-zinc-400 normal-case truncate">{label}</span>
      <span className="text-white font-black whitespace-nowrap">{value}</span>
    </div>
  );
}

function Empty() {
  return <p className="text-zinc-600 text-sm normal-case">No data yet.</p>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-900 bg-zinc-950 p-5">
      <p className="text-zinc-600 text-[9px] tracking-[0.35em] font-black uppercase mb-2">{label}</p>
      <p className="text-2xl font-black">{value}</p>
    </div>
  );
}

export default AdminDashboardPage;
