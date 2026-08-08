import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ban, Camera, Copy, Download, Link, Loader2, Package, Plus, Search, ShieldCheck, X } from "lucide-react";
import { useLocation } from "wouter";
import {
  calculateFees,
  classifyProductIntake,
  createChannelConnection,
  createListingPackage,
  updateListingPackage,
  fetchChannelConnections,
  fetchChannels,
  fetchMarketPricing,
  fetchOAuthProviders,
  fetchPlatformPricingStatus,
  fetchRetailers,
  lookupStoreAvailability,
  saveProductIdentifierMapping,
  startOAuth,
  verifyToken,
  SOURCING_LISTING_HANDOFF_KEY,
  type ChannelConnection,
  type ChannelDefinition,
  type ChannelListingDraft,
  type FeeCalculation,
  type ListingExportPackage,
  type ListingPackageResponse,
  type OAuthProviderStatus,
  type PlatformPriceResult,
  type PlatformPricingStatus,
  type ProductIntakeResponse,
  type RetailerAdapterStatus,
  type SourcingListingHandoff,
  type StoreLookupResult,
} from "@/lib/api";

type IntakeSource = "BARCODE" | "SEARCH" | "MANUAL_IDENTIFIER";
type ListingSource = "SCAN" | "SEARCH" | "MANUAL_FALLBACK";
type ScannerState = "idle" | "unsupported" | "permission_denied" | "active" | "paused" | "stopped" | "decoded" | "error";

type BarcodeDetectorFormat =
  | "aztec"
  | "code_128"
  | "code_39"
  | "code_93"
  | "codabar"
  | "data_matrix"
  | "ean_13"
  | "ean_8"
  | "itf"
  | "pdf417"
  | "qr_code"
  | "upc_a"
  | "upc_e";

type DetectedBarcode = { rawValue: string };

type BarcodeDetectorConstructor = new (options?: { formats?: BarcodeDetectorFormat[] }) => {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
};

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
  productId: "",
};

function mappingTypeFor(identifierType: ProductIntakeResponse["identifierType"] | null | undefined): "UPC" | "EAN" | "GTIN" | "SKU" | "STYLE_CODE" | "ISBN" | "OTHER" {
  if (identifierType === "UPC_A") return "UPC";
  if (identifierType === "EAN_13") return "EAN";
  if (identifierType === "GTIN") return "GTIN";
  if (identifierType === "SKU") return "SKU";
  if (identifierType === "STYLE_CODE") return "STYLE_CODE";
  if (identifierType === "ISBN") return "ISBN";
  return "OTHER";
}

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
  const [savingMapping, setSavingMapping] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [scannerState, setScannerState] = useState<ScannerState>("idle");
  const [scannerMessage, setScannerMessage] = useState("Ready to scan with this browser's local barcode detector.");
  // Retail intelligence: store availability
  const [retailers, setRetailers] = useState<RetailerAdapterStatus[]>([]);
  const [selectedRetailers, setSelectedRetailers] = useState<string[]>([]);
  const [postalCode, setPostalCode] = useState("");
  const [radiusMiles, setRadiusMiles] = useState("25");
  const [storeResult, setStoreResult] = useState<StoreLookupResult | null>(null);
  const [loadingStores, setLoadingStores] = useState(false);
  // Retail intelligence: market pricing + fees
  const [pricingPlatforms, setPricingPlatforms] = useState<PlatformPricingStatus[]>([]);
  const [selectedPricingPlatforms, setSelectedPricingPlatforms] = useState<string[]>([]);
  const [condition, setCondition] = useState("UNKNOWN");
  const [marketResults, setMarketResults] = useState<PlatformPriceResult[]>([]);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [feeResult, setFeeResult] = useState<FeeCalculation | null>(null);
  const [feePercent, setFeePercent] = useState("13");
  const [paymentPercent, setPaymentPercent] = useState("2.9");
  const [shippingMode, setShippingMode] = useState<"SELLER_ENTERED" | "UNKNOWN">("UNKNOWN");
  const [shippingAmount, setShippingAmount] = useState("");
  const [calculatingFees, setCalculatingFees] = useState(false);
  // OAuth providers
  const [oauthProviders, setOauthProviders] = useState<OAuthProviderStatus[]>([]);
  const [oauthNote, setOauthNote] = useState<Record<string, string>>({});
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<InstanceType<BarcodeDetectorConstructor> | null>(null);
  const scanTimerRef = useRef<number | null>(null);

  useEffect(() => {
    async function load() {
      const valid = await verifyToken();
      if (!valid) {
        setLocation("/admin/login");
        return;
      }
      try {
        const [channelList, connectionList, retailerList, pricingList, providerList] = await Promise.all([
          fetchChannels(),
          fetchChannelConnections().catch(() => []),
          fetchRetailers().catch(() => []),
          fetchPlatformPricingStatus().catch(() => []),
          fetchOAuthProviders().catch(() => []),
        ]);
        setChannels(channelList.length ? channelList : fallbackChannels);
        setConnections(connectionList);
        setRetailers(retailerList);
        setPricingPlatforms(pricingList);
        setOauthProviders(providerList);
      } catch {
        setChannels(fallbackChannels);
        setConnections([]);
      }
    }
    void load();
  }, [setLocation]);

  // Pick up a listing package just created from a Sourcing "List It" action
  // (see pages/sourcing.tsx). This is a one-shot session handoff, not a
  // persisted-draft feature: it hydrates the exact same `result` this page
  // would have produced from its own intake form, so BUY -> LIST opens
  // straight on Draft Output instead of making the operator re-enter data
  // the sourcing scan already collected.
  useEffect(() => {
    const raw = sessionStorage.getItem(SOURCING_LISTING_HANDOFF_KEY);
    if (!raw) return;
    sessionStorage.removeItem(SOURCING_LISTING_HANDOFF_KEY);
    try {
      const handoff: SourcingListingHandoff = JSON.parse(raw);
      const pkg = handoff.result.canonicalListingPackage as Record<string, unknown>;
      setForm((current) => ({
        ...current,
        identifier: String(pkg.source_identifier ?? current.identifier),
        title: String(pkg.title ?? current.title),
        description: String(pkg.description ?? current.description),
        category: String(pkg.category ?? current.category),
        condition: String(pkg.condition ?? current.condition),
        sizeVariant: pkg.size_variant != null ? String(pkg.size_variant) : current.sizeVariant,
        costBasis: pkg.cost_basis != null ? String(pkg.cost_basis) : current.costBasis,
        targetPrice: pkg.target_price != null ? String(pkg.target_price) : current.targetPrice,
        shippingProfile: pkg.shipping_profile != null ? String(pkg.shipping_profile) : current.shippingProfile,
        productId: pkg.product_id != null ? String(pkg.product_id) : current.productId,
      }));
      setResult(handoff.result);
      flash(`Continued from Sourcing: ${handoff.sourceLabel}. Draft below is already saved -- edit and re-save if needed.`);
    } catch {
      // Malformed/stale handoff payload -- ignore it rather than surface a
      // confusing error; the operator can still use the page normally.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      productId: result.matchedProductId ?? candidate.identifiers.localProductId ?? current.productId,
    }));
  }

  const stopScanner = useCallback((state: ScannerState = "stopped") => {
    if (scanTimerRef.current !== null) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScannerState(state);
    if (state === "stopped") setScannerMessage("Scanner stopped. Manual identifier fallback remains available.");
  }, []);

  const runIntake = useCallback(async (rawQuery: string, rawSource: IntakeSource) => {
    if (!rawQuery.trim()) {
      flash("Enter a UPC, EAN, GTIN, SKU, style code, or product-name search.");
      return;
    }
    setLoadingIntake(true);
    setResult(null);
    try {
      const response = await classifyProductIntake({ query: rawQuery.trim(), source: rawSource });
      setIntakeResult(response);
      applyCandidate(response);
      if (response.lookupStatus === "FOUND") {
        flash("Product found in local catalog. Review and edit fields before package creation.");
      } else {
        flash(response.valid ? "Identifier classified. Complete missing listing fields manually." : "Identifier needs review before package creation.");
      }
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "Product intake failed.");
    } finally {
      setLoadingIntake(false);
    }
  }, []);

  async function handleIntake(event: React.FormEvent) {
    event.preventDefault();
    await runIntake(query, source);
  }

  async function startScanner() {
    setSource("BARCODE");
    const BarcodeDetectorApi = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!BarcodeDetectorApi || !navigator.mediaDevices?.getUserMedia) {
      setScannerState("unsupported");
      setScannerMessage("Unsupported browser: local BarcodeDetector camera scanning is not available here.");
      return;
    }

    try {
      stopScanner("idle");
      detectorRef.current = new BarcodeDetectorApi({ formats: ["upc_a", "upc_e", "ean_13", "ean_8", "code_128", "code_39", "qr_code"] });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScannerState("active");
      setScannerMessage("Scanner active. Align one barcode in the camera view.");

      scanTimerRef.current = window.setInterval(() => {
        const video = videoRef.current;
        const detector = detectorRef.current;
        if (!video || !detector || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
        detector.detect(video).then((barcodes) => {
          const decoded = barcodes.find((barcode) => barcode.rawValue.trim());
          if (!decoded) return;
          const value = decoded.rawValue.trim();
          setQuery(value);
          setForm((current) => ({ ...current, identifier: value }));
          setScannerMessage(`Decoded ${value}. Running product intake.`);
          stopScanner("decoded");
          void runIntake(value, "BARCODE");
        }).catch(() => {
          setScannerState("error");
          setScannerMessage("Scanner error. Stop and retry, or use manual identifier fallback.");
        });
      }, 350);
    } catch (err: unknown) {
      stopScanner("permission_denied");
      const denied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError");
      setScannerState(denied ? "permission_denied" : "error");
      setScannerMessage(denied ? "Permission denied. Enable camera access or use manual identifier fallback." : "Camera scanner could not start. Use manual identifier fallback.");
    }
  }

  function pauseScanner() {
    if (scanTimerRef.current !== null) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    setScannerState("paused");
    setScannerMessage("Scanner paused. Resume scanning or stop the camera.");
  }

  function resumeScanner() {
    if (streamRef.current) {
      void startScanner();
    }
  }

  useEffect(() => () => stopScanner("stopped"), [stopScanner]);

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

    // EDIT vs CREATE: if a canonical package is already open -- either
    // handed off from Sourcing's BUY -> LIST action, or from an earlier save
    // in this same session -- saving again must update THAT package, never
    // create a second one. runIntake() (a new scan/search/manual identifier)
    // already clears `result`, so starting a genuinely new listing still
    // takes the create path exactly as before.
    const existingPackageId = result?.canonicalListingPackageId;

    setSaving(true);
    try {
      const payload = {
        source: listingSourceFor(source),
        identifier,
        identifierType: intakeResult?.identifierType ?? null,
        productId: form.productId.trim() ? Number(form.productId) : null,
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
      };
      const response = existingPackageId !== undefined
        ? await updateListingPackage(existingPackageId, payload)
        : await createListingPackage(payload);
      setResult(response);
      flash(existingPackageId !== undefined
        ? "Listing package updated. External publish remains disabled."
        : "Listing package created. External publish remains disabled.");
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "Listing package could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function toggleFrom(list: string[], setter: (v: string[]) => void, value: string) {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  async function handleStoreLookup() {
    if (selectedRetailers.length === 0) {
      flash("Select at least one retailer for store availability.");
      return;
    }
    setLoadingStores(true);
    try {
      const productId = form.productId.trim() ? Number(form.productId) : intakeResult?.matchedProductId ? Number(intakeResult.matchedProductId) : null;
      const response = await lookupStoreAvailability({
        productId,
        normalizedIdentifier: intakeResult?.normalizedIdentifier ?? (form.identifier.trim() || null),
        identifierType: intakeResult?.identifierType ?? null,
        retailers: selectedRetailers,
        location: { postalCode: postalCode.trim() || null, radiusMiles: money(radiusMiles) },
      });
      setStoreResult(response);
      flash("Store availability lookup returned honest per-retailer states. No provider was called.");
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "Store lookup failed.");
    } finally {
      setLoadingStores(false);
    }
  }

  async function handleMarketPricing() {
    if (selectedPricingPlatforms.length === 0) {
      flash("Select at least one marketplace for pricing.");
      return;
    }
    setLoadingPricing(true);
    try {
      const productId = form.productId.trim() ? Number(form.productId) : intakeResult?.matchedProductId ? Number(intakeResult.matchedProductId) : null;
      const response = await fetchMarketPricing({
        productId,
        normalizedIdentifier: intakeResult?.normalizedIdentifier ?? (form.identifier.trim() || null),
        identifierType: intakeResult?.identifierType ?? null,
        platforms: selectedPricingPlatforms,
        condition,
      });
      setMarketResults(response.results);
      flash("Selected-platform pricing returned. Active and sold prices stay separate.");
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "Market pricing failed.");
    } finally {
      setLoadingPricing(false);
    }
  }

  async function handleCalculateFees() {
    const price = money(form.targetPrice);
    if (price === null) {
      flash("Enter a target list price before calculating fees.");
      return;
    }
    setCalculatingFees(true);
    try {
      const response = await calculateFees({
        listPrice: price,
        feeSchedule: {
          percentageFee: (money(feePercent) ?? 0) / 100,
          fixedFee: 0.3,
          paymentProcessingPercent: (money(paymentPercent) ?? 0) / 100,
          paymentProcessingFixed: 0.3,
        },
        shipping: { mode: shippingMode, amount: shippingMode === "UNKNOWN" ? null : money(shippingAmount) },
        costBasis: money(form.costBasis),
      });
      setFeeResult(response.calculation);
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "Fee calculation failed.");
    } finally {
      setCalculatingFees(false);
    }
  }

  async function handleStartOAuth(provider: string) {
    setConnecting(provider);
    try {
      const response = await startOAuth(provider);
      if (response.status === "READY" && response.authorizationUrl) {
        setOauthNote((current) => ({ ...current, [provider]: "Authorization URL ready. Open it in your own browser to authorize." }));
      } else if (response.status === "NOT_CONFIGURED") {
        setOauthNote((current) => ({ ...current, [provider]: `NOT_CONFIGURED. Required env: ${(response.requiredEnv ?? []).join(", ")}` }));
      } else {
        setOauthNote((current) => ({ ...current, [provider]: response.reason ?? response.status }));
      }
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "OAuth start failed.");
    } finally {
      setConnecting(null);
    }
  }

  async function handleSaveMapping() {
    const identifier = form.identifier.trim() || intakeResult?.normalizedIdentifier || query.trim();
    const productId = Number(form.productId);
    if (!identifier || !Number.isInteger(productId) || productId <= 0) {
      flash("Enter an existing local product ID before saving an identifier mapping.");
      return;
    }
    setSavingMapping(true);
    try {
      const response = await saveProductIdentifierMapping({
        productId,
        identifier,
        identifierType: mappingTypeFor(intakeResult?.identifierType),
        source: "MANUAL",
        confidence: intakeResult?.confidence === "LOW" ? "LOW" : intakeResult?.confidence === "HIGH" ? "HIGH" : "MEDIUM",
        isPrimary: true,
      });
      setForm((current) => ({ ...current, identifier: response.normalizedIdentifier }));
      flash("Identifier mapping saved locally. No provider call was made.");
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "Identifier mapping could not be saved.");
    } finally {
      setSavingMapping(false);
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
          <a href="/admin/sourcing" className="border border-zinc-700 px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-white hover:text-black">Sourcing</a>
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
                PrimeOpp provides product, inventory, pricing, and listing intelligence. Store availability and market prices may change. You publish through your own marketplace accounts. PrimeOpp does not handle buyer payments, seller payouts, escrow, fulfillment, or disputes.
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
                <div className="mb-4 border border-zinc-800 bg-zinc-950 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-black uppercase tracking-widest">
                        <Camera className="h-5 w-5 text-red-600" />
                        Scan barcode
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{scannerMessage}</p>
                    </div>
                    <span className={`border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${statusClass(scannerState)}`}>{scannerState}</span>
                  </div>
                  <div className="overflow-hidden border border-zinc-900 bg-black">
                    <video ref={videoRef} className="aspect-video w-full bg-black object-cover" muted playsInline aria-label="Barcode scanner camera preview" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={startScanner} disabled={scannerState === "active"} className="inline-flex items-center gap-2 bg-red-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-white hover:text-black disabled:opacity-50">
                      <Camera className="h-4 w-4" />
                      Start Camera Scan
                    </button>
                    <button type="button" onClick={pauseScanner} disabled={scannerState !== "active"} className="border border-zinc-700 px-4 py-2 text-xs font-black uppercase tracking-widest text-zinc-300 hover:border-white hover:text-white disabled:opacity-50">
                      Pause
                    </button>
                    <button type="button" onClick={resumeScanner} disabled={scannerState !== "paused"} className="border border-zinc-700 px-4 py-2 text-xs font-black uppercase tracking-widest text-zinc-300 hover:border-white hover:text-white disabled:opacity-50">
                      Resume
                    </button>
                    <button type="button" onClick={() => stopScanner("stopped")} disabled={!streamRef.current} className="border border-zinc-700 px-4 py-2 text-xs font-black uppercase tracking-widest text-zinc-300 hover:border-white hover:text-white disabled:opacity-50">
                      Stop
                    </button>
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
                      <p><span className="text-zinc-500">Confidence:</span> {intakeResult.confidence}</p>
                      <p><span className="text-zinc-500">Lookup status:</span> {intakeResult.lookupStatus}</p>
                      <p><span className="text-zinc-500">Lookup source:</span> {intakeResult.lookupSource}</p>
                    </div>
                    <p><span className="text-zinc-500">Reason:</span> {intakeResult.classification.reason}</p>
                    <p><span className="text-zinc-500">Enrichment status:</span> {intakeResult.enrichmentStatus}. {intakeResult.lookupStatus === "FOUND" ? "Fields were prefilled from real local catalog data." : "No fake product data was created."}</p>
                    <p><span className="text-zinc-500">Provider calls:</span> NO</p>
                  </>
                ) : (
                  <p>Run product intake to classify a barcode, identifier, style code, or search phrase.</p>
                )}
              </div>
            </section>

            <section>
              <h3 className="mb-4 border-b-2 border-white pb-3 text-lg font-black uppercase tracking-widest">Identifier Mapping</h3>
              <div className="grid gap-4 border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Existing local product ID</label>
                    <input value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })} className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-600" placeholder="required to save mapping" type="number" min="1" step="1" />
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Identifier type</label>
                    <div className="border border-zinc-800 bg-black px-4 py-3 font-black uppercase tracking-widest">{mappingTypeFor(intakeResult?.identifierType)}</div>
                  </div>
                </div>
                <div className="grid gap-2 text-xs text-zinc-500">
                  <p>Normalized value: {form.identifier || intakeResult?.normalizedIdentifier || "UNMAPPED"}</p>
                  <p>Source/confidence: MANUAL / {intakeResult?.confidence ?? "MEDIUM"}</p>
                  <p>Status: {intakeResult?.matchedProductId ? `Mapped to product ${intakeResult.matchedProductId}` : "Identifier is unmapped until saved against an existing local product."}</p>
                  <p>No provider call. No fake match. Package creation can continue while unmapped.</p>
                </div>
                <button type="button" onClick={handleSaveMapping} disabled={savingMapping} className="inline-flex items-center justify-center gap-2 border border-zinc-700 px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-300 hover:border-white hover:text-white disabled:opacity-50">
                  {savingMapping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                  Save identifier mapping
                </button>
              </div>
            </section>

            <form onSubmit={handlePackageSubmit}>
              <h3 className="mb-4 border-b-2 border-white pb-3 text-lg font-black uppercase tracking-widest">Canonical Listing Package</h3>
              {intakeResult && (
                <div className="mb-4 border border-zinc-800 bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-400">
                  Prefill source: {intakeResult.lookupSource} / {intakeResult.lookupStatus}. Confidence: {intakeResult.confidence}. All fields remain editable before draft/export creation.
                </div>
              )}
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
                {result?.canonicalListingPackageId !== undefined
                  ? (saving ? "Updating..." : "Update Listing Package")
                  : (saving ? "Creating..." : "Create Listing Package")}
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

        {/* ── Store Availability ─────────────────────────────────────────── */}
        <section className="mt-10">
          <h3 className="mb-4 border-b-2 border-white pb-3 text-lg font-black uppercase tracking-widest">Store Availability</h3>
          <div className="border border-zinc-800 bg-zinc-950 p-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Postal code</label>
                <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-600" placeholder="e.g. 10001" />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Radius (miles)</label>
                <input value={radiusMiles} onChange={(e) => setRadiusMiles(e.target.value)} className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-600" type="number" min="0" max="500" />
              </div>
              <div className="flex items-end">
                <button type="button" onClick={handleStoreLookup} disabled={loadingStores} className="flex w-full items-center justify-center gap-2 bg-red-600 px-4 py-3 text-xs font-black uppercase tracking-widest hover:bg-white hover:text-black disabled:opacity-50">
                  {loadingStores ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Find Stores
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {retailers.map((retailer) => (
                <button key={retailer.key} type="button" onClick={() => toggleFrom(selectedRetailers, setSelectedRetailers, retailer.key)} className={`border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${selectedRetailers.includes(retailer.key) ? "border-red-600 bg-red-950/40 text-red-200" : "border-zinc-700 text-zinc-400 hover:border-white"}`} title={retailer.status === "NOT_CONFIGURED" ? `Requires: ${retailer.requiredEnv.join(", ")}` : retailer.status}>
                  {retailer.label} · {retailer.status}
                </button>
              ))}
            </div>
            {storeResult && (
              <div className="mt-4 grid gap-3">
                {storeResult.results.map((r) => (
                  <div key={r.retailer} className="border border-zinc-800 bg-black p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="font-black uppercase tracking-widest">{r.retailer}</p>
                      <span className={`border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${statusClass(r.lookupStatus)}`}>{r.lookupStatus}</span>
                    </div>
                    {r.stores.length === 0 ? (
                      <p className="text-xs text-zinc-500">
                        {r.lookupStatus === "NOT_CONFIGURED" ? `No configured inventory source. Required env: ${(r.requiredEnv ?? []).join(", ") || "provider credentials"}.` : "No supported store observations. Quantity is never invented from a status."}
                      </p>
                    ) : (
                      <div className="grid gap-2">
                        {r.stores.map((s) => (
                          <div key={s.externalStoreId} className="grid gap-1 border border-zinc-900 p-2 text-xs text-zinc-300 sm:grid-cols-2">
                            <p><span className="text-zinc-500">Store:</span> {s.storeName}</p>
                            <p><span className="text-zinc-500">Availability:</span> {s.availabilityStatus}</p>
                            <p><span className="text-zinc-500">Quantity:</span> {s.quantity === null ? "N/A (nullable)" : s.quantity} ({s.quantityConfidence})</p>
                            <p><span className="text-zinc-500">Local price:</span> {s.localPrice === null ? "N/A" : `$${s.localPrice.toFixed(2)}`}</p>
                            <p><span className="text-zinc-500">Observed:</span> {s.observedAt ?? "UNKNOWN"} · {s.freshness}</p>
                            <p><span className="text-zinc-500">Source:</span> {s.source}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs leading-relaxed text-zinc-500">Quantity is only shown when a source truly supplies it. Stale data is always shown with its timestamp and freshness label.</p>
          </div>
        </section>

        {/* ── Platform Selection + Market Pricing ────────────────────────── */}
        <section className="mt-10">
          <h3 className="mb-4 border-b-2 border-white pb-3 text-lg font-black uppercase tracking-widest">Market Pricing</h3>
          <div className="border border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Condition</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value)} className="border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs uppercase tracking-widest outline-none focus:border-red-600">
                {["UNKNOWN", "NEW", "USED", "REFURBISHED", "OPEN_BOX"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button type="button" onClick={handleMarketPricing} disabled={loadingPricing} className="ml-auto flex items-center gap-2 bg-red-600 px-4 py-2 text-xs font-black uppercase tracking-widest hover:bg-white hover:text-black disabled:opacity-50">
                {loadingPricing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Get Pricing
              </button>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {pricingPlatforms.map((p) => (
                <button key={p.key} type="button" onClick={() => toggleFrom(selectedPricingPlatforms, setSelectedPricingPlatforms, p.key)} className={`border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${selectedPricingPlatforms.includes(p.key) ? "border-red-600 bg-red-950/40 text-red-200" : "border-zinc-700 text-zinc-400 hover:border-white"}`} title={p.status === "NOT_CONFIGURED" ? `Requires: ${p.requiredEnv.join(", ")}` : p.status}>
                  {p.label} · {p.status}
                </button>
              ))}
            </div>
            {marketResults.length > 0 && (
              <div className="grid gap-3">
                {marketResults.map((m) => (
                  <div key={m.platform} className="border border-zinc-800 bg-black p-3 text-xs text-zinc-300">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-black uppercase tracking-widest">{m.platform}</p>
                      <span className={`border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${statusClass(m.sourceStatus)}`}>{m.sourceStatus}</span>
                    </div>
                    <div className="grid gap-1 sm:grid-cols-2">
                      <p><span className="text-zinc-500">Active (asking):</span> {m.active.median === null ? "N/A" : `$${m.active.median}`} · samples {m.active.sampleCount ?? "N/A"}</p>
                      <p><span className="text-zinc-500">Sold comps:</span> {m.sold.median === null ? "N/A" : `$${m.sold.median}`} · samples {m.sold.sampleCount ?? "N/A"}</p>
                      <p><span className="text-zinc-500">Condition:</span> {m.condition}</p>
                      <p><span className="text-zinc-500">Match confidence:</span> {m.matchConfidence}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs leading-relaxed text-zinc-500">Active asking prices and sold comps are shown separately. No recommendation is produced from insufficient or fabricated data.</p>
          </div>
        </section>

        {/* ── Fees / Shipping / Net / Profit ─────────────────────────────── */}
        <section className="mt-10">
          <h3 className="mb-4 border-b-2 border-white pb-3 text-lg font-black uppercase tracking-widest">Fees, Shipping &amp; Profit</h3>
          <div className="border border-zinc-800 bg-zinc-950 p-4">
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Platform fee %</label>
                <input value={feePercent} onChange={(e) => setFeePercent(e.target.value)} className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-600" type="number" min="0" step="0.1" />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Payment fee %</label>
                <input value={paymentPercent} onChange={(e) => setPaymentPercent(e.target.value)} className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-600" type="number" min="0" step="0.1" />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Shipping</label>
                <select value={shippingMode} onChange={(e) => setShippingMode(e.target.value as "SELLER_ENTERED" | "UNKNOWN")} className="w-full border border-zinc-700 bg-zinc-900 px-3 py-3 text-xs uppercase tracking-widest outline-none focus:border-red-600">
                  <option value="UNKNOWN">UNKNOWN</option>
                  <option value="SELLER_ENTERED">Seller-entered</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Shipping $</label>
                <input value={shippingAmount} onChange={(e) => setShippingAmount(e.target.value)} disabled={shippingMode === "UNKNOWN"} className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-600 disabled:opacity-40" type="number" min="0" step="0.01" />
              </div>
            </div>
            <button type="button" onClick={handleCalculateFees} disabled={calculatingFees} className="mt-4 flex items-center gap-2 bg-red-600 px-4 py-2 text-xs font-black uppercase tracking-widest hover:bg-white hover:text-black disabled:opacity-50">
              {calculatingFees ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
              Calculate Net &amp; Profit
            </button>
            {feeResult && (
              <div className="mt-4 grid gap-2 border border-zinc-800 bg-black p-4 text-sm text-zinc-300 sm:grid-cols-2">
                <p><span className="text-zinc-500">Gross selling price:</span> ${feeResult.grossSellingPrice.toFixed(2)}</p>
                <p><span className="text-zinc-500">Platform fees:</span> ${feeResult.platformFees.toFixed(2)}</p>
                <p><span className="text-zinc-500">Payment fees:</span> ${feeResult.paymentFees.toFixed(2)}</p>
                <p><span className="text-zinc-500">Shipping:</span> {feeResult.shippingState === "UNKNOWN" ? "UNKNOWN (not assumed)" : `$${(feeResult.shippingCost ?? 0).toFixed(2)}`}</p>
                <p><span className="text-zinc-500">Cost basis:</span> {feeResult.costBasis === null ? "N/A" : `$${feeResult.costBasis.toFixed(2)}`}</p>
                <p><span className="text-zinc-500">Net proceeds:</span> {feeResult.netProceeds === null ? "Needs shipping" : `$${feeResult.netProceeds.toFixed(2)}`}</p>
                <p><span className="text-zinc-500">Estimated profit:</span> <span className={feeResult.estimatedProfit !== null && feeResult.estimatedProfit < 0 ? "text-red-400" : "text-emerald-300"}>{feeResult.estimatedProfit === null ? feeResult.profitState : `$${feeResult.estimatedProfit.toFixed(2)}`}</span></p>
                <p><span className="text-zinc-500">Margin:</span> {feeResult.marginPercent === null ? "N/A" : `${feeResult.marginPercent.toFixed(1)}%`}</p>
              </div>
            )}
            <p className="mt-4 text-xs leading-relaxed text-zinc-500">Shipping is never silently assumed — an UNKNOWN state leaves net proceeds and profit unresolved rather than invented.</p>
          </div>
        </section>

        {/* ── Account Connections (OAuth) ────────────────────────────────── */}
        <section className="mt-10">
          <h3 className="mb-4 border-b-2 border-white pb-3 text-lg font-black uppercase tracking-widest">Account Connections (OAuth)</h3>
          <div className="border border-zinc-800 bg-zinc-950 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {oauthProviders.map((p) => (
                <div key={p.key} className="border border-zinc-800 bg-black p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="font-black uppercase tracking-widest">{p.label}</p>
                    <span className={`border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${statusClass(p.status)}`}>{p.status}</span>
                  </div>
                  <div className="mb-3 grid gap-1 text-xs text-zinc-500">
                    <p>Monitoring only: TRUE</p>
                    <p>Publish authorized: FALSE</p>
                    <p>Supports OAuth: {p.supportsOAuth ? "YES" : "NO"} · PKCE: {p.supportsPkce ? "YES" : "NO"}</p>
                  </div>
                  <button type="button" onClick={() => handleStartOAuth(p.key)} disabled={connecting === p.key || !p.supportsOAuth} className="flex w-full items-center justify-center gap-2 border border-zinc-700 px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-300 hover:border-white hover:text-white disabled:opacity-40">
                    {connecting === p.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link className="h-4 w-4" />}
                    {p.supportsOAuth ? "Connect Account" : "OAuth Unsupported"}
                  </button>
                  {oauthNote[p.key] && <p className="mt-3 text-xs text-amber-300">{oauthNote[p.key]}</p>}
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-zinc-500">Connections default to monitoring-only with publishing disabled. Tokens, when a live flow is configured, are stored encrypted — never in plaintext. External publish remains disabled in this build.</p>
          </div>
        </section>

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
