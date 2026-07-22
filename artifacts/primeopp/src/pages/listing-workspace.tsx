import { useEffect, useMemo, useState } from "react";
import { Ban, Camera, Copy, Download, Link, Loader2, Package, Plus, Search, ShieldCheck, X } from "lucide-react";
import { useLocation } from "wouter";
import {
  classifyProductIntake,
  createChannelConnection,
  createListingPackage,
  fetchChannelConnections,
  fetchChannels,
  verifyToken,
  type ChannelConnection,
  type ChannelDefinition,
  type ChannelListingDraft,
  type ListingExportPackage,
  type ListingPackageResponse,
  type ProductIntakeResponse,
} from "@/lib/api";

type IntakeSource = "BARCODE" | "SEARCH" | "MANUAL_IDENTIFIER";
type ListingSource = "SCAN" | "SEARCH" | "MANUAL_FALLBACK";

const fallbackChannels: ChannelDefinition[] = [
  { key: "general-resale", label: "General resale", category: "resale", draftsAvailable: true, exportsAvailable: true, oauthEnabled: false, publishEnabled: false, safetyMode: "seller_owned_account" },
  { key: "craft-market", label: "Craft market", category: "craft", draftsAvailable: true, exportsAvailable: true, oauthEnabled: false, publishEnabled: false, safetyMode: "seller_owned_account" },
  { key: "social-commerce", label: "Social commerce", category: "social", draftsAvailable: true, exportsAvailable: true, oauthEnabled: false, publishEnabled: false, safetyMode: "seller_owned_account" },
  { key: "local-pickup", label: "Local pickup", category: "local", draftsAvailable: true, exportsAvailable: true, oauthEnabled: false, publishEnabled: false, safetyMode: "seller_owned_account" },
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
  if (status.includes("CONNECTED") || status === "READY" || status === "EXPORTED") return "border-emerald-700 text-emerald-300";
  if (status === "FAILED" || status === "ERROR") return "border-red-700 text-red-300";
  if (status === "NOT_CONNECTED" || status === "DISABLED") return "border-zinc-700 text-zinc-400";
  return "border-amber-700 text-amber-300";
}

function listingSourceFor(source: IntakeSource): ListingSource {
  if (source === "BARCODE") return "SCAN";
  if (source === "SEARCH") return "SEARCH";
  return "MANUAL_FALLBACK";
}

function ListingWorkspacePage() {
  const [, setLocation] = useLocation();
  const [source, setSource] = useState<IntakeSource>("BARCODE");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [channels, setChannels] = useState<ChannelDefinition[]>(fallbackChannels);
  const [channelQuery, setChannelQuery] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<string[]>(["general-resale"]);
  const [connections, setConnections] = useState<ChannelConnection[]>([]);
  const [intakeResult, setIntakeResult] = useState<ProductIntakeResponse | null>(null);
  const [result, setResult] = useState<ListingPackageResponse | null>(null);
  const [message, setMessage] = useState("");
  const [loadingIntake, setLoadingIntake] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const valid = await verifyToken();
      if (!valid) {
        setLocation("/admin/login");
        return;
      }
      try {
        const [channelList, connectionList] = await Promise.all([
          fetchChannels(),
          fetchChannelConnections().catch(() => []),
        ]);
        setChannels(channelList.length ? channelList : fallbackChannels);
        setConnections(connectionList);
      } catch {
        setChannels(fallbackChannels);
        setConnections([]);
      }
    }
    void load();
  }, [setLocation]);

  const filteredChannels = useMemo(() => {
    const value = channelQuery.trim().toLowerCase();
    return channels.filter((channel) => {
      const matches = !value || channel.key.includes(value) || channel.label.toLowerCase().includes(value);
      return matches && !selectedChannels.includes(channel.key);
    });
  }, [channelQuery, channels, selectedChannels]);

  const marginPreview = useMemo(() => {
    const cost = money(form.costBasis);
    const price = money(form.targetPrice);
    if (cost === null || price === null) return null;
    return Math.round((price - cost) * 100) / 100;
  }, [form.costBasis, form.targetPrice]);

  function flash(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 4500);
  }

  function applyCandidate(result: ProductIntakeResponse) {
    const candidate = result.productCandidate;
    setForm((current) => ({
      ...current,
      identifier: result.normalizedIdentifier ?? current.identifier,
      title: candidate.title ?? current.title,
      description: candidate.description ?? current.description,
      category: candidate.category ?? current.category,
      imageUrl: candidate.imageUrl ?? current.imageUrl,
    }));
  }

  async function handleIntake(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim()) {
      flash("Enter a UPC, EAN, GTIN, SKU, style code, or product-name search.");
      return;
    }
    setLoadingIntake(true);
    setResult(null);
    try {
      const response = await classifyProductIntake({ query: query.trim(), source });
      setIntakeResult(response);
      applyCandidate(response);
      flash(response.valid ? "Identifier classified. Complete missing listing fields manually." : "Identifier needs review before package creation.");
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "Product intake failed.");
    } finally {
      setLoadingIntake(false);
    }
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

  async function connectChannel(channel: string) {
    setConnecting(channel);
    try {
      const response = await createChannelConnection(channel);
      setConnections((current) => [response.connection, ...current]);
      flash(response.reason);
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "Connection shell could not be created.");
    } finally {
      setConnecting(null);
    }
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

  async function handlePackageSubmit(event: React.FormEvent) {
    event.preventDefault();
    const identifier = form.identifier.trim() || intakeResult?.normalizedIdentifier || query.trim();
    if (!identifier) {
      flash("Run product intake or enter a manual identifier first.");
      return;
    }
    if (selectedChannels.length === 0) {
      flash("Select at least one draft/export channel.");
      return;
    }

    setSaving(true);
    try {
      const response = await createListingPackage({
        source: listingSourceFor(source),
        identifier,
        identifierType: intakeResult?.identifierType ?? null,
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
          <h1 className="text-2xl font-black uppercase tracking-widest">PRIMEOPP</h1>
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
                <ShieldCheck className="h-5 w-5 text-red-600" />
                Safety Boundary
              </h2>
              <p className="mt-2 max-w-4xl text-sm leading-relaxed text-zinc-400">
                PrimeOpp prepares listing packages and channel drafts. You publish through your own marketplace accounts. PrimeOpp does not handle buyer payments, payouts, escrow, fulfillment, or disputes.
              </p>
            </div>
            <div className="flex items-center gap-2 border border-zinc-700 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-300">
              <Ban className="h-4 w-4 text-red-600" />
              External publish disabled
            </div>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr]">
          <section className="space-y-8">
            <form onSubmit={handleIntake}>
              <h3 className="mb-4 border-b-2 border-white pb-3 text-lg font-black uppercase tracking-widest">Product Intake</h3>
              <div className="mb-5 grid gap-3 sm:grid-cols-3">
                {[
                  { key: "BARCODE" as const, label: "Scan barcode", icon: Camera },
                  { key: "SEARCH" as const, label: "Search", icon: Search },
                  { key: "MANUAL_IDENTIFIER" as const, label: "Manual identifier", icon: Plus },
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

              {source === "BARCODE" && (
                <div className="mb-4 border border-dashed border-zinc-700 bg-zinc-950 p-4 text-sm font-bold uppercase tracking-widest text-zinc-400">
                  <div className="flex items-center gap-3">
                    <Camera className="h-5 w-5 text-red-600" />
                    Camera scanner not connected yet
                  </div>
                </div>
              )}

              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
                UPC / EAN / GTIN / SKU / style code / product name
              </label>
              <div className="flex gap-2">
                <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-600" placeholder="Enter identifier or product search text" />
                <button type="submit" disabled={loadingIntake} className="flex min-w-36 items-center justify-center gap-2 bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-widest transition-colors hover:bg-white hover:text-black disabled:opacity-50">
                  {loadingIntake ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Identify
                </button>
              </div>
            </form>

            <section>
              <h3 className="mb-4 border-b-2 border-white pb-3 text-lg font-black uppercase tracking-widest">Identification Result</h3>
              <div className="grid gap-3 border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
                {intakeResult ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <p><span className="text-zinc-500">Normalized:</span> {intakeResult.normalizedIdentifier ?? "NONE"}</p>
                      <p><span className="text-zinc-500">Identifier type:</span> {intakeResult.identifierType}</p>
                      <p><span className="text-zinc-500">Valid:</span> {intakeResult.valid ? "TRUE" : "FALSE"}</p>
                      <p><span className="text-zinc-500">Confidence:</span> {intakeResult.classification.confidence}</p>
                    </div>
                    <p><span className="text-zinc-500">Reason:</span> {intakeResult.classification.reason}</p>
                    <p><span className="text-zinc-500">Enrichment status:</span> {intakeResult.enrichmentStatus}. Provider lookup is not wired; no fake product data was created.</p>
                    <p><span className="text-zinc-500">Provider calls:</span> NO</p>
                  </>
                ) : (
                  <p>Run product intake to classify a barcode, identifier, style code, or search phrase.</p>
                )}
              </div>
            </section>

            <form onSubmit={handlePackageSubmit}>
              <h3 className="mb-4 border-b-2 border-white pb-3 text-lg font-black uppercase tracking-widest">Canonical Listing Package</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <input value={form.identifier} onChange={(event) => setForm({ ...form, identifier: event.target.value })} className="border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-600" placeholder="Identifier" />
                <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-600" placeholder="Editable title" />
                <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-600" placeholder="Category" />
                <input value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value })} className="border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-600" placeholder="Condition" />
                <input value={form.sizeVariant} onChange={(event) => setForm({ ...form, sizeVariant: event.target.value })} className="border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-600" placeholder="Size or variant" />
                <input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} className="border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-600" placeholder="Image URL, if real" />
              </div>
              <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-4 min-h-28 w-full resize-none border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-600" placeholder="Description" />
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <input value={form.costBasis} onChange={(event) => setForm({ ...form, costBasis: event.target.value })} className="border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-600" placeholder="Cost basis" type="number" min="0" step="0.01" />
                <input value={form.targetPrice} onChange={(event) => setForm({ ...form, targetPrice: event.target.value })} className="border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-600" placeholder="Target price" type="number" min="0" step="0.01" />
                <div className="border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm">
                  <span className="text-zinc-500">Profit preview</span>
                  <span className={`ml-3 font-black ${marginPreview !== null && marginPreview < 0 ? "text-red-400" : "text-emerald-300"}`}>
                    {marginPreview === null ? "Needs cost and price" : `$${marginPreview.toFixed(2)}`}
                  </span>
                </div>
              </div>
              <input value={form.shippingProfile} onChange={(event) => setForm({ ...form, shippingProfile: event.target.value })} className="mt-4 w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-600" placeholder="Shipping profile" />
              <button type="submit" disabled={saving} className="mt-5 w-full bg-red-600 px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-white transition-colors hover:bg-white hover:text-black disabled:opacity-50">
                {saving ? "Creating..." : "Create Listing Package"}
              </button>
            </form>
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
                      <button key={channel.key} type="button" onClick={() => addChannel(channel.key)} className="border border-zinc-700 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-300 hover:border-red-600">
                        {channel.label}
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
                <p className="mt-4 text-xs leading-relaxed text-zinc-500">Drafts and exports can be generated without a connection. Provider publish remains disabled.</p>
              </div>
            </section>

            <section>
              <h3 className="mb-4 border-b-2 border-white pb-3 text-lg font-black uppercase tracking-widest">Connect Existing Account</h3>
              <div className="border border-zinc-800 bg-zinc-950 p-4">
                <p className="mb-4 text-xs leading-relaxed text-zinc-400">OAuth not configured yet. Draft/export mode available.</p>
                <div className="grid gap-2">
                  {selectedChannels.map((channel) => {
                    const connection = connections.find((item) => item.channel === channel);
                    const status = connection?.connection_status ?? "NOT_CONNECTED";
                    return (
                      <div key={channel} className="border border-zinc-800 p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="font-black uppercase tracking-widest">{channel}</p>
                          <span className={`border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${statusClass(status)}`}>{status}</span>
                        </div>
                        <p className="mb-3 text-xs text-zinc-500">Connect account and explicitly authorize publish before live provider actions.</p>
                        <button type="button" onClick={() => connectChannel(channel)} disabled={connecting === channel} className="flex w-full items-center justify-center gap-2 border border-zinc-700 px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-300 hover:border-white hover:text-white disabled:opacity-50">
                          {connecting === channel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link className="h-4 w-4" />}
                          Connect Existing Account
                        </button>
                        <div className="mt-3 grid gap-1 text-xs text-zinc-500">
                          <p>Monitoring only: {connection?.monitoring_only ?? true ? "TRUE" : "FALSE"}</p>
                          <p>Publish authorized: {connection?.publish_authorized ? "TRUE" : "FALSE"}</p>
                          <p>Token storage: {connection?.token_storage_status ?? "NOT_IMPLEMENTED"}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </aside>
        </div>

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
              {result.exports.map((item: ListingExportPackage) => (
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
