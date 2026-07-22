import { useEffect, useMemo, useState } from "react";
import { Ban, Camera, Copy, Download, Link, Package, Plus, Search, X } from "lucide-react";
import { useLocation } from "wouter";
import {
  createListingPackage,
  fetchAccountConnectionShells,
  verifyToken,
  type AccountConnectionShell,
  type ChannelListingDraft,
  type ListingExportPackage,
  type ListingPackageResponse,
} from "@/lib/api";

type IntakeSource = "SCAN" | "SEARCH" | "MANUAL_FALLBACK";

const suggestedChannels = [
  "general-resale",
  "craft-market",
  "social-commerce",
  "local-pickup",
  "collectibles",
  "apparel-resale",
];

const emptyForm = {
  identifier: "",
  title: "",
  description: "",
  category: "",
  condition: "",
  sizeVariant: "",
  costBasis: "",
  targetPrice: "",
  shippingProfile: "",
  imageUrl: "",
};

function money(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function statusClass(status: string): string {
  if (status === "READY" || status === "EXPORTED") return "border-emerald-700 text-emerald-300";
  if (status === "FAILED") return "border-red-700 text-red-300";
  if (status === "DISABLED") return "border-zinc-700 text-zinc-400";
  return "border-amber-700 text-amber-300";
}

function ListingWorkspacePage() {
  const [, setLocation] = useLocation();
  const [source, setSource] = useState<IntakeSource>("SCAN");
  const [form, setForm] = useState(emptyForm);
  const [channelQuery, setChannelQuery] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<string[]>(["general-resale"]);
  const [connections, setConnections] = useState<AccountConnectionShell[]>([]);
  const [result, setResult] = useState<ListingPackageResponse | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const valid = await verifyToken();
      if (!valid) {
        setLocation("/admin/login");
        return;
      }
      try {
        setConnections(await fetchAccountConnectionShells());
      } catch {
        setConnections([]);
      }
    }
    void checkAuth();
  }, [setLocation]);

  const filteredChannels = useMemo(() => {
    const query = channelQuery.trim().toLowerCase();
    return suggestedChannels.filter((channel) => channel.includes(query) && !selectedChannels.includes(channel));
  }, [channelQuery, selectedChannels]);

  const marginPreview = useMemo(() => {
    const cost = money(form.costBasis);
    const price = money(form.targetPrice);
    if (cost === null || price === null) return null;
    return Math.round((price - cost) * 100) / 100;
  }, [form.costBasis, form.targetPrice]);

  function flash(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 4000);
  }

  function addChannel(channel: string) {
    const normalized = channel.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!normalized || selectedChannels.includes(normalized)) return;
    setSelectedChannels((current) => [...current, normalized]);
    setChannelQuery("");
  }

  function removeChannel(channel: string) {
    setSelectedChannels((current) => current.filter((item) => item !== channel));
  }

  async function copyText(value: string) {
    await navigator.clipboard.writeText(value);
    flash("Copied to clipboard.");
  }

  function downloadJson(item: ListingExportPackage) {
    const blob = new Blob([JSON.stringify(item.export_payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `primeopp-listing-${item.channel}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.identifier.trim()) {
      flash("Identifier is required.");
      return;
    }
    if (selectedChannels.length === 0) {
      flash("Select at least one draft channel.");
      return;
    }

    setSaving(true);
    try {
      const response = await createListingPackage({
        source,
        identifier: form.identifier.trim(),
        product: {
          title: form.title.trim() || null,
          description: form.description.trim() || null,
          images: form.imageUrl.trim() ? [form.imageUrl.trim()] : [],
          category: form.category.trim() || null,
          condition: form.condition.trim() || null,
          sizeVariant: form.sizeVariant.trim() || null,
          costBasis: money(form.costBasis),
          targetPrice: money(form.targetPrice),
          shippingProfile: form.shippingProfile.trim() || null,
        },
        selectedChannels,
        createExports: true,
      });
      setResult(response);
      flash("Listing package created. External publish remains disabled.");
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "Listing package could not be created.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b-4 border-red-600 bg-black px-6 py-5">
        <div>
          <h1 className="text-2xl font-black tracking-widest uppercase">PRIMEOPP</h1>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.4em] text-red-600">Listing Workspace</p>
        </div>
        <div className="flex gap-3">
          <a href="/admin" className="border border-zinc-700 px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-white hover:text-black">Products</a>
          <a href="/admin/orders" className="border border-zinc-700 px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-white hover:text-black">Orders</a>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {message && (
          <div className="mb-6 border-l-4 border-red-600 bg-zinc-950 px-5 py-3 text-sm font-bold tracking-widest">{message}</div>
        )}

        <section className="mb-8 border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black uppercase tracking-widest">
                <Package className="h-5 w-5 text-red-600" />
                Listing package - not published
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
                PrimeOpp creates local listing packages, draft payloads, and exports. Seller publishes through their own marketplace account. Direct publish requires connected account and explicit approval.
              </p>
            </div>
            <div className="flex items-center gap-2 border border-zinc-700 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-300">
              <Ban className="h-4 w-4 text-red-600" />
              External publish disabled
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-8">
            <div>
              <h3 className="mb-4 border-b-2 border-white pb-3 text-lg font-black uppercase tracking-widest">Intake</h3>
              <div className="mb-5 grid gap-3 sm:grid-cols-3">
                {[
                  { key: "SCAN" as const, label: "Camera Scan", icon: Camera },
                  { key: "SEARCH" as const, label: "Search", icon: Search },
                  { key: "MANUAL_FALLBACK" as const, label: "Manual Fallback", icon: Plus },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setSource(item.key)}
                      className={`flex items-center justify-center gap-2 border px-4 py-3 text-xs font-black uppercase tracking-widest transition-colors ${source === item.key ? "border-red-600 bg-red-600 text-white" : "border-zinc-700 text-zinc-400 hover:border-white hover:text-white"}`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {source === "SCAN" && (
                <div className="mb-4 border border-dashed border-zinc-700 bg-zinc-950 p-4">
                  <label className="flex cursor-pointer items-center justify-center gap-3 text-sm font-bold uppercase tracking-widest text-zinc-300">
                    <Camera className="h-5 w-5 text-red-600" />
                    Capture product image
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={() => flash("Camera capture received. Identifier decoding is not enabled in this build; use search or manual fallback to finish the package.")}
                    />
                  </label>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Identifier *</label>
                  <input value={form.identifier} onChange={(event) => setForm({ ...form, identifier: event.target.value })} className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-600" placeholder="scan, search result, or fallback identifier" />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Image URL</label>
                  <input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-600" placeholder="https://..." />
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-4 border-b-2 border-white pb-3 text-lg font-black uppercase tracking-widest">Canonical Package</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-600" placeholder="Title" />
                <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-600" placeholder="Category" />
                <input value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value })} className="border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-600" placeholder="Condition" />
                <input value={form.sizeVariant} onChange={(event) => setForm({ ...form, sizeVariant: event.target.value })} className="border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-600" placeholder="Size or variant" />
              </div>
              <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-4 min-h-28 w-full resize-none border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-600" placeholder="Description" />
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <input value={form.costBasis} onChange={(event) => setForm({ ...form, costBasis: event.target.value })} className="border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-600" placeholder="Cost basis" type="number" min="0" step="0.01" />
                <input value={form.targetPrice} onChange={(event) => setForm({ ...form, targetPrice: event.target.value })} className="border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-600" placeholder="Target price" type="number" min="0" step="0.01" />
                <div className="border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm">
                  <span className="text-zinc-500">Margin</span>
                  <span className={`ml-3 font-black ${marginPreview !== null && marginPreview < 0 ? "text-red-400" : "text-emerald-300"}`}>
                    {marginPreview === null ? "Needs cost and price" : `$${marginPreview.toFixed(2)}`}
                  </span>
                </div>
              </div>
              <input value={form.shippingProfile} onChange={(event) => setForm({ ...form, shippingProfile: event.target.value })} className="mt-4 w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-600" placeholder="Shipping profile" />
            </div>
          </section>

          <aside className="space-y-8">
            <section>
              <h3 className="mb-4 border-b-2 border-white pb-3 text-lg font-black uppercase tracking-widest">Channel Drafts / Exports</h3>
              <div className="border border-zinc-800 bg-zinc-950 p-4">
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Search or add channel</label>
                <div className="flex gap-2">
                  <input value={channelQuery} onChange={(event) => setChannelQuery(event.target.value)} className="min-w-0 flex-1 border border-zinc-700 bg-black px-3 py-2 text-sm outline-none focus:border-red-600" placeholder="channel key" />
                  <button type="button" onClick={() => addChannel(channelQuery)} className="flex h-10 w-10 items-center justify-center bg-red-600 text-white transition-colors hover:bg-white hover:text-black" title="Add channel">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {filteredChannels.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {filteredChannels.map((channel) => (
                      <button key={channel} type="button" onClick={() => addChannel(channel)} className="border border-zinc-700 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-300 hover:border-red-600">
                        {channel}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedChannels.map((channel) => (
                    <span key={channel} className="inline-flex items-center gap-2 border border-red-900 bg-red-950/30 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-200">
                      {channel}
                      <button type="button" onClick={() => removeChannel(channel)} title="Remove channel">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-4 border-b-2 border-white pb-3 text-lg font-black uppercase tracking-widest">Connected Accounts</h3>
              <div className="border border-zinc-800 bg-zinc-950 p-4">
                <button type="button" disabled className="mb-4 flex w-full items-center justify-center gap-2 border border-zinc-700 px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-500">
                  <Link className="h-4 w-4" />
                  Connect Existing Account
                </button>
                {connections.length === 0 ? (
                  <div className="grid gap-2 text-xs text-zinc-400">
                    <p>Status: NOT_CONNECTED</p>
                    <p>Monitoring: ON</p>
                    <p>Publish authorized: FALSE</p>
                  </div>
                ) : connections.map((connection) => (
                  <div key={connection.id} className="mb-2 border border-zinc-800 p-3 text-xs text-zinc-400">
                    <p className="font-black uppercase tracking-widest text-white">{connection.channel}</p>
                    <p>Status: {connection.connection_status}</p>
                    <p>Monitoring: {connection.monitoring_only ? "ON" : "OFF"}</p>
                    <p>Publish authorized: {connection.publish_authorized ? "TRUE" : "FALSE"}</p>
                  </div>
                ))}
              </div>
            </section>

            <button type="submit" disabled={saving} className="w-full bg-red-600 px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-white transition-colors hover:bg-white hover:text-black disabled:opacity-50">
              {saving ? "Creating..." : "Create Listing Package"}
            </button>
          </aside>
        </form>

        {result && (
          <section className="mt-10 space-y-6">
            <h3 className="border-b-2 border-white pb-3 text-lg font-black uppercase tracking-widest">Draft Output</h3>
            <div className="grid gap-4 lg:grid-cols-2">
              {result.channelDrafts.map((draft: ChannelListingDraft) => (
                <div key={draft.id} className="border border-zinc-800 bg-zinc-950 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="font-black uppercase tracking-widest">{draft.channel}</h4>
                    <span className={`border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${statusClass(draft.channel_status)}`}>{draft.channel_status}</span>
                  </div>
                  <p className="mb-3 text-xs leading-relaxed text-zinc-400">{draft.publish_disabled_reason}</p>
                  <pre className="max-h-52 overflow-auto border border-zinc-900 bg-black p-3 text-xs text-zinc-300">{JSON.stringify(draft.channel_payload, null, 2)}</pre>
                  <button type="button" onClick={() => copyText(JSON.stringify(draft.channel_payload, null, 2))} className="mt-3 inline-flex items-center gap-2 border border-zinc-700 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-300 hover:border-white hover:text-white">
                    <Copy className="h-3.5 w-3.5" />
                    Copy Fields
                  </button>
                </div>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {result.exports.map((item) => (
                <div key={item.id} className="border border-zinc-800 bg-zinc-950 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="font-black uppercase tracking-widest">{item.channel} export</h4>
                    <span className="border border-zinc-700 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-300">{item.export_format}</span>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => copyText(JSON.stringify(item.export_payload, null, 2))} className="inline-flex items-center gap-2 border border-zinc-700 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-300 hover:border-white hover:text-white">
                      <Copy className="h-3.5 w-3.5" />
                      Copy JSON
                    </button>
                    <button type="button" onClick={() => downloadJson(item)} className="inline-flex items-center gap-2 border border-zinc-700 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-300 hover:border-white hover:text-white">
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default ListingWorkspacePage;
