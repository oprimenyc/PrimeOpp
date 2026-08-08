// Sourcing Session + Review Queue — the fast in-store scan loop plus the
// deliberate review/decision workflow it feeds.
//
// SOURCE mode (no session open in review) is camera-first: scanning an item
// appends it to the queue and the camera keeps running so the operator can
// keep moving through a rack without waiting on a lookup or a decision.
//
// REVIEW mode is the dense queue: sort/filter, batch actions, and an honest
// BUY / PASS / WATCH recommendation derived only from real operator-entered
// acquisition cost/shipping plus whatever real market-price evidence exists
// (most items will read WATCH/INSUFFICIENT_DATA until a pricing provider is
// configured -- that is accurate, not a bug).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Camera, Loader2, Plus, RefreshCw, X } from "lucide-react";
import {
  addSourcingItem,
  batchUpdateSourcingItems,
  createListingFromSourcingItem,
  createSourcingSession,
  fetchSourcingItems,
  fetchSourcingSession,
  fetchSourcingSessions,
  updateSourcingItem,
  updateSourcingSession,
  verifyToken,
  type SourcingItemStatus,
  type SourcingSession,
  type SourcingSessionItem,
} from "@/lib/api";

type IntakeSource = "BARCODE" | "MANUAL_IDENTIFIER" | "SEARCH";
type ScannerState = "idle" | "unsupported" | "permission_denied" | "active" | "paused" | "stopped" | "error";

type BarcodeDetectorFormat = "code_128" | "code_39" | "ean_13" | "ean_8" | "qr_code" | "upc_a" | "upc_e";
type DetectedBarcode = { rawValue: string };
type BarcodeDetectorConstructor = new (options?: { formats?: BarcodeDetectorFormat[] }) => {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
};

const QUEUE_STATUSES: SourcingItemStatus[] = ["SCANNED", "IDENTIFYING", "QUEUED", "REVIEWING", "BUY", "PASS", "WATCH"];

function decisionBadgeClass(decision: string): string {
  if (decision === "BUY") return "border-emerald-700 text-emerald-300 bg-emerald-950/40";
  if (decision === "PASS") return "border-red-700 text-red-300 bg-red-950/40";
  if (decision === "WATCH") return "border-amber-700 text-amber-300 bg-amber-950/40";
  return "border-zinc-700 text-zinc-400";
}

function statusBadgeClass(status: string): string {
  if (status === "BUY" || status === "PURCHASED" || status === "LISTED" || status === "SOLD") return "border-emerald-800 text-emerald-300";
  if (status === "PASS" || status === "ARCHIVED") return "border-zinc-700 text-zinc-500";
  if (status === "WATCH") return "border-amber-800 text-amber-300";
  return "border-zinc-700 text-zinc-300";
}

function money(value: number | null): string {
  return value === null ? "--" : `$${value.toFixed(2)}`;
}

function SourcingPage() {
  const params = useParams<{ id?: string }>();
  const sessionId = params.id ? Number(params.id) : null;

  if (sessionId && Number.isInteger(sessionId) && sessionId > 0) {
    return <SessionDetail sessionId={sessionId} />;
  }
  return <SessionList />;
}

// ── Session list + create ───────────────────────────────────────────────────

function SessionList() {
  const [, setLocation] = useLocation();
  const [sessions, setSessions] = useState<SourcingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [label, setLabel] = useState("");
  const [locationName, setLocationName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const valid = await verifyToken();
    if (!valid) {
      setLocation("/admin/login");
      return;
    }
    setLoading(true);
    try {
      setSessions(await fetchSourcingSessions());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sourcing sessions");
    } finally {
      setLoading(false);
    }
  }, [setLocation]);

  useEffect(() => { void load(); }, [load]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!label.trim()) return;
    setCreating(true);
    try {
      const session = await createSourcingSession({ label: label.trim(), locationName: locationName.trim() || null });
      setLocation(`/admin/sourcing/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create sourcing session");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white px-6 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-red-600 text-[10px] tracking-[0.45em] font-black uppercase">Sourcing</p>
            <h1 className="text-4xl font-black uppercase">Sessions</h1>
          </div>
          <nav className="flex gap-4 text-xs uppercase tracking-widest">
            <a href="/admin" className="text-zinc-400 hover:text-white">Products</a>
            <a href="/admin/listings" className="text-zinc-400 hover:text-white">Listings</a>
            <a href="/admin/orders" className="text-zinc-400 hover:text-white">Orders</a>
            <a href="/admin/dashboard" className="text-zinc-400 hover:text-white">Dashboard</a>
          </nav>
        </div>

        {error && <p className="border-l-4 border-red-600 bg-zinc-950 px-4 py-3 text-red-400 mb-6 normal-case">{error}</p>}

        <form onSubmit={handleCreate} className="border border-zinc-900 bg-zinc-950 p-5 mb-8 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Session label</label>
            <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="ROSS -- Aug 8" className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm focus:border-red-600 outline-none" />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Location (optional)</label>
            <input value={locationName} onChange={(event) => setLocationName(event.target.value)} placeholder="Ross Dress for Less, 5th Ave" className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm focus:border-red-600 outline-none" />
          </div>
          <button type="submit" disabled={creating || !label.trim()} className="bg-red-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-[10px] font-black tracking-widest uppercase px-4 py-2.5 flex items-center gap-2">
            {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            Start Session
          </button>
        </form>

        {loading ? (
          <p className="text-zinc-600 text-sm normal-case">Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <p className="text-zinc-600 text-sm normal-case">No sourcing sessions yet. Start one above before your next trip.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sessions.map((session) => {
              const counts = session.itemCounts ?? session.item_counts ?? {};
              const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
              const buy = counts.BUY ?? 0;
              const watch = counts.WATCH ?? 0;
              const pass = counts.PASS ?? 0;
              const reviewing = (counts.SCANNED ?? 0) + (counts.QUEUED ?? 0) + (counts.REVIEWING ?? 0) + (counts.IDENTIFYING ?? 0);
              return (
                <a key={session.id} href={`/admin/sourcing/${session.id}`} className="border border-zinc-900 bg-zinc-950 p-5 hover:border-zinc-700 transition-colors block">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="font-black uppercase truncate">{session.label}</h2>
                    <span className={`text-[9px] font-black uppercase tracking-widest border px-2 py-1 ${session.status === "ACTIVE" ? "border-emerald-800 text-emerald-300" : "border-zinc-700 text-zinc-500"}`}>{session.status}</span>
                  </div>
                  {session.location_name && <p className="text-zinc-500 text-xs normal-case mb-3">{session.location_name}</p>}
                  <p className="text-zinc-600 text-[11px] normal-case mb-3">{new Date(session.started_at).toLocaleString()}</p>
                  <div className="flex gap-4 text-xs">
                    <span className="text-zinc-400">{total} scanned</span>
                    <span className="text-zinc-400">{reviewing} reviewing</span>
                    <span className="text-emerald-400">{buy} buy</span>
                    <span className="text-amber-400">{watch} watch</span>
                    <span className="text-zinc-500">{pass} pass</span>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

// ── Session detail: source mode + review queue ─────────────────────────────

function SessionDetail({ sessionId }: { sessionId: number }) {
  const [, setLocation] = useLocation();
  const [session, setSession] = useState<SourcingSession | null>(null);
  const [items, setItems] = useState<SourcingSessionItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<SourcingItemStatus[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const valid = await verifyToken();
    if (!valid) {
      setLocation("/admin/login");
      return;
    }
    try {
      const [sessionData, itemData] = await Promise.all([
        fetchSourcingSession(sessionId),
        fetchSourcingItems(sessionId),
      ]);
      setSession(sessionData);
      setItems(itemData);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load session");
    } finally {
      setLoading(false);
    }
  }, [sessionId, setLocation]);

  useEffect(() => { void load(); }, [load]);

  const visibleItems = useMemo(() => {
    if (!statusFilter) return items;
    return items.filter((item) => statusFilter.includes(item.status));
  }, [items, statusFilter]);

  const counts = useMemo(() => {
    const tally: Record<string, number> = {};
    for (const item of items) tally[item.status] = (tally[item.status] ?? 0) + 1;
    return tally;
  }, [items]);

  function upsertItem(updated: SourcingSessionItem) {
    setItems((current) => {
      const exists = current.some((item) => item.id === updated.id);
      return exists ? current.map((item) => (item.id === updated.id ? updated : item)) : [updated, ...current];
    });
  }

  async function handleItemUpdate(itemId: number, data: Parameters<typeof updateSourcingItem>[2]) {
    try {
      const updated = await updateSourcingItem(sessionId, itemId, data);
      upsertItem(updated);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to update item");
    }
  }

  async function handleBatch(action: "PASS" | "WATCH" | "ARCHIVE" | "QUEUE") {
    if (selected.size === 0) return;
    try {
      const result = await batchUpdateSourcingItems(sessionId, Array.from(selected), action);
      for (const updated of result.items) upsertItem(updated);
      setSelected(new Set());
      setMessage(`${result.updatedCount} item(s) marked ${action}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Batch action failed");
    }
  }

  async function handleCreateListing(itemId: number) {
    try {
      await createListingFromSourcingItem(sessionId, itemId);
      setMessage("Listing package created. Continue in Listings.");
      void load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to create listing");
    }
  }

  async function handleCloseSession() {
    if (!session) return;
    const updated = await updateSourcingSession(sessionId, { status: session.status === "ACTIVE" ? "CLOSED" : "ACTIVE" });
    setSession(updated);
  }

  if (loading) {
    return <main className="min-h-screen bg-black text-white px-6 py-8"><p className="text-zinc-600 text-sm normal-case">Loading session...</p></main>;
  }

  if (!session) {
    return <main className="min-h-screen bg-black text-white px-6 py-8"><p className="text-red-400 text-sm normal-case">{message || "Session not found."}</p></main>;
  }

  return (
    <main className="min-h-screen bg-black text-white px-4 py-6 md:px-6 md:py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <a href="/admin/sourcing" className="text-zinc-500 hover:text-white text-[10px] uppercase tracking-widest">&larr; All Sessions</a>
            <h1 className="text-3xl font-black uppercase mt-1">{session.label}</h1>
            {session.location_name && <p className="text-zinc-500 text-xs normal-case">{session.location_name}</p>}
          </div>
          <div className="flex items-center gap-3">
            <nav className="flex gap-3 text-xs uppercase tracking-widest">
              <a href="/admin/listings" className="text-zinc-400 hover:text-white">Listings</a>
              <a href="/admin/orders" className="text-zinc-400 hover:text-white">Orders</a>
            </nav>
            <button onClick={handleCloseSession} className="border border-zinc-700 px-3 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-colors">
              {session.status === "ACTIVE" ? "Close Session" : "Reopen"}
            </button>
          </div>
        </div>

        {message && <p className="border-l-4 border-red-600 bg-zinc-950 px-4 py-3 text-zinc-300 mb-6 normal-case text-sm">{message}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
          <SourceScanner sessionId={sessionId} onItemAdded={(item) => { upsertItem(item); setMessage(`Scanned: ${item.title ?? item.rawQuery}`); }} />

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
                <FilterChip active={statusFilter === null} onClick={() => setStatusFilter(null)}>All ({items.length})</FilterChip>
                <FilterChip active={!!statusFilter?.includes("BUY")} onClick={() => setStatusFilter(["BUY"])}>Buy ({counts.BUY ?? 0})</FilterChip>
                <FilterChip active={!!statusFilter?.includes("WATCH")} onClick={() => setStatusFilter(["WATCH"])}>Watch ({counts.WATCH ?? 0})</FilterChip>
                <FilterChip active={!!statusFilter && statusFilter.every((s) => QUEUE_STATUSES.includes(s)) && statusFilter.length > 1} onClick={() => setStatusFilter(["SCANNED", "QUEUED", "REVIEWING", "IDENTIFYING"])}>To Review ({(counts.SCANNED ?? 0) + (counts.QUEUED ?? 0) + (counts.REVIEWING ?? 0) + (counts.IDENTIFYING ?? 0)})</FilterChip>
                <FilterChip active={!!statusFilter?.includes("PASS")} onClick={() => setStatusFilter(["PASS"])}>Pass ({counts.PASS ?? 0})</FilterChip>
              </div>
              <button onClick={() => void load()} className="text-zinc-500 hover:text-white text-[10px] uppercase tracking-widest flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>

            {selected.size > 0 && (
              <div className="flex items-center gap-2 mb-3 border border-zinc-800 bg-zinc-950 px-3 py-2">
                <span className="text-xs text-zinc-400">{selected.size} selected</span>
                <button onClick={() => void handleBatch("WATCH")} className="border border-amber-800 text-amber-300 text-[10px] font-black uppercase tracking-widest px-2 py-1">Watch</button>
                <button onClick={() => void handleBatch("PASS")} className="border border-red-800 text-red-300 text-[10px] font-black uppercase tracking-widest px-2 py-1">Pass</button>
                <button onClick={() => void handleBatch("ARCHIVE")} className="border border-zinc-700 text-zinc-400 text-[10px] font-black uppercase tracking-widest px-2 py-1">Archive</button>
              </div>
            )}

            <div className="space-y-2">
              {visibleItems.length === 0 && <p className="text-zinc-600 text-sm normal-case">No items in this filter yet.</p>}
              {visibleItems.map((item) => (
                <ReviewQueueRow
                  key={item.id}
                  item={item}
                  selected={selected.has(item.id)}
                  onToggleSelect={() => setSelected((current) => {
                    const next = new Set(current);
                    if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                    return next;
                  })}
                  onUpdate={(data) => void handleItemUpdate(item.id, data)}
                  onCreateListing={() => void handleCreateListing(item.id)}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`border px-3 py-2 transition-colors ${active ? "bg-white text-black border-white" : "border-zinc-700 text-zinc-400 hover:text-white"}`}>
      {children}
    </button>
  );
}

// ── Source mode: continuous camera scan loop + manual fallback ─────────────

function SourceScanner({ sessionId, onItemAdded }: { sessionId: number; onItemAdded: (item: SourcingSessionItem) => void }) {
  const [scannerState, setScannerState] = useState<ScannerState>("idle");
  const [scannerMessage, setScannerMessage] = useState("Start the camera to scan barcodes continuously, or add items manually below.");
  const [manualQuery, setManualQuery] = useState("");
  const [manualSource, setManualSource] = useState<IntakeSource>("MANUAL_IDENTIFIER");
  const [acquisitionCost, setAcquisitionCost] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanCount, setScanCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<InstanceType<BarcodeDetectorConstructor> | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const lastValueRef = useRef<string>("");
  const lastValueAtRef = useRef<number>(0);

  const stopScanner = useCallback((state: ScannerState = "stopped") => {
    if (scanTimerRef.current !== null) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScannerState(state);
  }, []);

  const addItem = useCallback(async (rawQuery: string, source: IntakeSource) => {
    setBusy(true);
    try {
      const cost = acquisitionCost.trim() ? Number(acquisitionCost) : null;
      const item = await addSourcingItem(sessionId, { query: rawQuery.trim(), source, acquisitionCost: Number.isFinite(cost) ? cost : null });
      setScanCount((count) => count + 1);
      onItemAdded(item);
      return item;
    } catch (err) {
      setScannerMessage(err instanceof Error ? err.message : "Could not add scanned item.");
      return null;
    } finally {
      setBusy(false);
    }
  }, [sessionId, acquisitionCost, onItemAdded]);

  async function startScanner() {
    const BarcodeDetectorApi = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!BarcodeDetectorApi || !navigator.mediaDevices?.getUserMedia) {
      setScannerState("unsupported");
      setScannerMessage("Unsupported browser: local camera barcode scanning is not available here. Use manual entry below.");
      return;
    }

    try {
      stopScanner("idle");
      detectorRef.current = new BarcodeDetectorApi({ formats: ["upc_a", "upc_e", "ean_13", "ean_8", "code_128", "code_39", "qr_code"] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScannerState("active");
      setScannerMessage("Scanning. Align a barcode in view -- the camera keeps running after each scan.");

      scanTimerRef.current = window.setInterval(() => {
        const video = videoRef.current;
        const detector = detectorRef.current;
        if (!video || !detector || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
        detector.detect(video).then((barcodes) => {
          const decoded = barcodes.find((barcode) => barcode.rawValue.trim());
          if (!decoded) return;
          const value = decoded.rawValue.trim();
          const now = Date.now();
          // Debounce the same barcode staying in frame for a few seconds so
          // one physical item is not added to the queue repeatedly.
          if (value === lastValueRef.current && now - lastValueAtRef.current < 4000) return;
          lastValueRef.current = value;
          lastValueAtRef.current = now;
          setScannerMessage(`Decoded ${value}. Added to queue -- keep scanning.`);
          void addItem(value, "BARCODE");
        }).catch(() => {
          setScannerState("error");
          setScannerMessage("Scanner error. Stop and retry, or use manual entry.");
        });
      }, 350);
    } catch (err: unknown) {
      stopScanner("permission_denied");
      const denied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError");
      setScannerState(denied ? "permission_denied" : "error");
      setScannerMessage(denied ? "Camera permission denied. Enable camera access or use manual entry." : "Camera scanner could not start. Use manual entry.");
    }
  }

  useEffect(() => () => stopScanner("stopped"), [stopScanner]);

  async function handleManualSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!manualQuery.trim()) return;
    const added = await addItem(manualQuery, manualSource);
    if (added) setManualQuery("");
  }

  return (
    <aside className="border border-zinc-900 bg-zinc-950 p-4 lg:sticky lg:top-6 self-start">
      <h2 className="text-[10px] font-black tracking-[0.35em] uppercase text-zinc-500 mb-3">Source</h2>

      <div className="bg-black border border-zinc-800 aspect-video mb-3 relative overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline aria-label="Barcode scanner camera preview" />
        {scannerState !== "active" && (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-[10px] uppercase tracking-widest">
            {scannerState === "idle" ? "Camera off" : scannerState}
          </div>
        )}
      </div>

      <p className="text-zinc-500 text-[11px] normal-case mb-3">{scannerMessage}</p>

      <div className="flex gap-2 mb-4">
        {scannerState === "active" ? (
          <button onClick={() => stopScanner("stopped")} className="flex-1 border border-zinc-700 text-[10px] font-black uppercase tracking-widest px-3 py-2 hover:bg-white hover:text-black transition-colors flex items-center justify-center gap-2">
            <X className="w-3 h-3" /> Stop Camera
          </button>
        ) : (
          <button onClick={() => void startScanner()} className="flex-1 bg-red-600 text-[10px] font-black uppercase tracking-widest px-3 py-2 flex items-center justify-center gap-2">
            <Camera className="w-3 h-3" /> Start Camera Scan
          </button>
        )}
      </div>

      <div className="mb-3">
        <label className="text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">Acquisition cost (applies to scans)</label>
        <input value={acquisitionCost} onChange={(event) => setAcquisitionCost(event.target.value)} type="number" min="0" step="0.01" placeholder="19.99" className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm focus:border-red-600 outline-none" />
      </div>

      <form onSubmit={handleManualSubmit} className="space-y-2">
        <label className="text-[10px] tracking-widest uppercase text-zinc-500 block">Manual entry / search</label>
        <div className="flex gap-2">
          <select value={manualSource} onChange={(event) => setManualSource(event.target.value as IntakeSource)} className="bg-black border border-zinc-800 px-2 py-2 text-xs">
            <option value="MANUAL_IDENTIFIER">Identifier</option>
            <option value="SEARCH">Search</option>
          </select>
          <input value={manualQuery} onChange={(event) => setManualQuery(event.target.value)} placeholder="UPC, SKU, or product name" className="flex-1 bg-black border border-zinc-800 px-3 py-2 text-sm focus:border-red-600 outline-none" />
        </div>
        <button type="submit" disabled={busy || !manualQuery.trim()} className="w-full border border-zinc-700 disabled:text-zinc-600 text-[10px] font-black uppercase tracking-widest px-3 py-2 hover:bg-white hover:text-black transition-colors flex items-center justify-center gap-2">
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add to Queue
        </button>
      </form>

      <p className="text-zinc-600 text-[10px] normal-case mt-4">{scanCount} item(s) added this session. Camera frames stay in the browser -- no image is uploaded.</p>
    </aside>
  );
}

// ── Review queue row ─────────────────────────────────────────────────────

function ReviewQueueRow({ item, selected, onToggleSelect, onUpdate, onCreateListing }: {
  item: SourcingSessionItem;
  selected: boolean;
  onToggleSelect: () => void;
  onUpdate: (data: { acquisitionCost?: number | null; shippingEstimate?: number | null; status?: SourcingItemStatus }) => void;
  onCreateListing: () => void;
}) {
  const [cost, setCost] = useState(item.acquisitionCost !== null ? String(item.acquisitionCost) : "");
  const [shipping, setShipping] = useState(item.shippingEstimate !== null ? String(item.shippingEstimate) : "");

  function commitCost() {
    const parsed = cost.trim() ? Number(cost) : null;
    if (parsed !== item.acquisitionCost) onUpdate({ acquisitionCost: Number.isFinite(parsed) ? parsed : null });
  }
  function commitShipping() {
    const parsed = shipping.trim() ? Number(shipping) : null;
    if (parsed !== item.shippingEstimate) onUpdate({ shippingEstimate: Number.isFinite(parsed) ? parsed : null });
  }

  return (
    <div className={`border ${selected ? "border-red-700" : "border-zinc-900"} bg-zinc-950 p-3 flex flex-wrap items-center gap-3`}>
      <input type="checkbox" checked={selected} onChange={onToggleSelect} className="w-4 h-4 accent-red-600" />

      <div className="min-w-[160px] flex-1">
        <p className="font-bold uppercase text-sm truncate">{item.title ?? item.rawQuery}</p>
        <p className="text-zinc-500 text-[11px] normal-case">
          {item.identifierType ?? item.intakeSource} &middot; {item.lookupStatus === "FOUND" ? "matched in catalog" : "no catalog match"}
          {item.duplicateOfItemId && <span className="text-amber-400"> &middot; duplicate of #{item.duplicateOfItemId}</span>}
        </p>
      </div>

      <div className="w-24">
        <label className="text-[9px] text-zinc-600 uppercase block">Cost</label>
        <input value={cost} onChange={(event) => setCost(event.target.value)} onBlur={commitCost} type="number" min="0" step="0.01" className="w-full bg-black border border-zinc-800 px-2 py-1 text-xs" />
      </div>
      <div className="w-24">
        <label className="text-[9px] text-zinc-600 uppercase block">Shipping</label>
        <input value={shipping} onChange={(event) => setShipping(event.target.value)} onBlur={commitShipping} type="number" min="0" step="0.01" className="w-full bg-black border border-zinc-800 px-2 py-1 text-xs" />
      </div>

      <div className="w-40">
        <span className={`inline-block border text-[9px] font-black uppercase tracking-widest px-2 py-1 mb-1 ${decisionBadgeClass(item.decision.decision)}`}>{item.decision.decision}</span>
        <p className="text-zinc-500 text-[10px] normal-case">
          {item.decision.estimatedProfit !== null ? `${money(item.decision.estimatedProfit)} profit` : item.decision.reason}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <span className={`border text-[9px] font-black uppercase tracking-widest px-2 py-1 ${statusBadgeClass(item.status)}`}>{item.status}</span>
        <button onClick={() => onUpdate({ status: "BUY" })} className="border border-emerald-800 text-emerald-300 text-[9px] font-black uppercase px-2 py-1">Buy</button>
        <button onClick={() => onUpdate({ status: "WATCH" })} className="border border-amber-800 text-amber-300 text-[9px] font-black uppercase px-2 py-1">Watch</button>
        <button onClick={() => onUpdate({ status: "PASS" })} className="border border-zinc-700 text-zinc-400 text-[9px] font-black uppercase px-2 py-1">Pass</button>
        {item.status === "BUY" && !item.canonicalListingPackageId && (
          <button onClick={onCreateListing} className="bg-red-600 text-white text-[9px] font-black uppercase px-2 py-1">List It</button>
        )}
      </div>
    </div>
  );
}

export default SourcingPage;
