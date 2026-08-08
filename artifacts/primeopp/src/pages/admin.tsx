// Admin Panel — full product manager connected to the real database
// Visit /admin (requires login at /admin/login first)

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  fetchProducts, createProduct, updateProduct, deleteProduct,
  adminLogout, verifyToken,
  type Product, type ColorVariant,
} from "@/lib/api";

// Blank form for adding/editing
const emptyForm = {
  type: "pod" as "pod" | "affiliate",
  title: "",
  description: "",
  price: "",
  category: "",
  thumbnail_url: "",
  external_link: "",
  stock_level: "",
  shipping_info: "",
  pod_provider: "printful" as "printful" | "tapstitch",
  sizes: "S, M, L, XL, XXL",
  printful_variant_id: "",
  tapstitch_variant_id: "",
};

type ImageMode = "upload" | "url";

function AdminPage() {
  const [, setLocation] = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [colors, setColors] = useState<ColorVariant[]>([]);
  const [imageMode, setImageMode] = useState<ImageMode>("url");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check auth on load
  useEffect(() => {
    async function checkAuth() {
      const valid = await verifyToken();
      if (!valid) { setLocation("/admin/login"); return; }
      await loadProducts();
    }
    void checkAuth();
  }, [setLocation]);

  async function loadProducts() {
    setLoading(true);
    try {
      const data = await fetchProducts();
      setProducts(data);
    } catch {
      flash("❌ Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  function flash(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3500);
  }

  // ---- Image upload helpers ----
  function readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) { reject(new Error("Not an image file")); return; }
      if (file.size > 2 * 1024 * 1024) flash("⚠️ Large file — try under 2MB for best performance.");
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.readAsDataURL(file);
    });
  }

  async function handleFileSelected(file: File) {
    setUploading(true);
    try {
      const url = await readFileAsDataURL(file);
      setForm((f) => ({ ...f, thumbnail_url: url }));
      flash("✅ Image loaded!");
    } catch (err: unknown) {
      flash(`❌ ${err instanceof Error ? err.message : "Upload failed"}`);
    } finally {
      setUploading(false);
    }
  }

  // ---- Color helpers ----
  function addColor() {
    setColors([...colors, { name: "", hex: "#111111", price: parseFloat(form.price) || 0 }]);
  }
  function updateColor(i: number, field: keyof ColorVariant, val: string | number) {
    setColors(colors.map((c, idx) => idx === i ? { ...c, [field]: val } : c));
  }
  function removeColor(i: number) {
    setColors(colors.filter((_, idx) => idx !== i));
  }

  // ---- Form submit ----
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { flash("❌ Title is required."); return; }
    if (form.type === "affiliate" && !form.external_link.trim()) {
      flash("❌ Affiliate link is required for affiliate products."); return;
    }
    for (const [i, c] of colors.entries()) {
      if (!c.name.trim()) { flash(`❌ Color #${i + 1} needs a name.`); return; }
      if (!c.price || c.price <= 0) { flash(`❌ Color #${i + 1} needs a valid price.`); return; }
    }

    setSaving(true);
    try {
      // Parse sizes from comma-separated string
      const sizesArray = form.type === "pod"
        ? form.sizes.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
        : [];

      const payload = {
        type: form.type,
        title: form.title.trim(),
        description: form.description.trim() || null,
        price: form.price ? parseFloat(form.price) : null,
        category: form.category.trim() || null,
        thumbnail_url: form.thumbnail_url.trim() || null,
        external_link: form.type === "affiliate" ? form.external_link.trim() : null,
        stock_level: form.type === "pod" && form.stock_level ? parseInt(form.stock_level) : null,
        shipping_info: form.type === "pod" ? form.shipping_info.trim() || null : null,
        colors: colors.length > 0 ? colors.map((c) => ({ ...c, price: Number(c.price) })) : [],
        sizes: sizesArray,
        pod_provider: form.type === "pod" ? form.pod_provider : null,
        printful_variant_id: form.type === "pod" && form.pod_provider === "printful" ? (form.printful_variant_id.trim() || null) : null,
        tapstitch_variant_id: form.type === "pod" && form.pod_provider === "tapstitch" ? (form.tapstitch_variant_id.trim() || null) : null,
      };

      if (editingId !== null) {
        await updateProduct(editingId, payload);
        flash("✅ Product updated!");
      } else {
        await createProduct(payload);
        flash("✅ Product added!");
      }
      resetForm();
      await loadProducts();
    } catch (err: unknown) {
      flash(`❌ ${err instanceof Error ? err.message : "Save failed"}`);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(p: Product) {
    setForm({
      type: p.type,
      title: p.title,
      description: p.description ?? "",
      price: p.price !== null ? String(p.price) : "",
      category: p.category ?? "",
      thumbnail_url: p.thumbnail_url ?? "",
      external_link: p.external_link ?? "",
      stock_level: p.stock_level !== null ? String(p.stock_level) : "",
      shipping_info: p.shipping_info ?? "",
      pod_provider: (p.pod_provider as "printful" | "tapstitch") ?? "printful",
      sizes: Array.isArray(p.sizes) && p.sizes.length > 0 ? p.sizes.join(", ") : "S, M, L, XL, XXL",
      printful_variant_id: p.printful_variant_id ?? "",
      tapstitch_variant_id: p.tapstitch_variant_id ?? "",
    });
    setColors(Array.isArray(p.colors) ? [...p.colors] : []);
    setEditingId(p.id);
    setImageMode(p.thumbnail_url?.startsWith("data:") ? "upload" : "url");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setForm(emptyForm);
    setColors([]);
    setEditingId(null);
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this product permanently?")) return;
    try {
      await deleteProduct(id);
      flash("🗑️ Deleted.");
      if (editingId === id) resetForm();
      await loadProducts();
    } catch {
      flash("❌ Delete failed.");
    }
  }

  function handleLogout() {
    void adminLogout();
    setLocation("/admin/login");
  }

  // Dashboard counts
  const podCount = products.filter((p) => p.type === "pod").length;
  const affiliateCount = products.filter((p) => p.type === "affiliate").length;

  return (
    <div className="min-h-screen bg-black text-white font-sans uppercase">

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 bg-red-600 text-white w-10 h-10 flex items-center justify-center font-black text-lg hover:bg-white hover:text-black transition-colors" onClick={() => setLightbox(null)}>✕</button>
          <img src={lightbox} alt="preview" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Header */}
      <div className="bg-black border-b-4 border-red-600 px-6 py-5 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-2xl font-black tracking-widest">PRIMEOPP</h1>
          <p className="text-red-600 text-[10px] tracking-[0.4em] font-bold mt-0.5">ADMIN PANEL</p>
        </div>
        <div className="flex gap-3">
          <a href="/admin/dashboard" className="text-[10px] font-bold tracking-widest border border-zinc-700 px-3 py-2 hover:bg-white hover:text-black transition-colors">DASHBOARD</a>
          <a href="/admin/sourcing" className="text-[10px] font-bold tracking-widest border border-zinc-700 px-3 py-2 hover:bg-white hover:text-black transition-colors">SOURCING</a>
          <a href="/admin/listings" className="text-[10px] font-bold tracking-widest border border-zinc-700 px-3 py-2 hover:bg-white hover:text-black transition-colors">LISTINGS</a>
          <a href="/admin/orders" className="text-[10px] font-bold tracking-widest border border-zinc-700 px-3 py-2 hover:bg-white hover:text-black transition-colors">📦 ORDERS</a>
          <a href="/" className="text-[10px] font-bold tracking-widest border border-zinc-700 px-3 py-2 hover:bg-white hover:text-black transition-colors">← STORE</a>
          <button onClick={handleLogout} className="text-[10px] font-bold tracking-widest border border-zinc-800 px-3 py-2 text-zinc-500 hover:border-red-600 hover:text-red-600 transition-colors">LOGOUT</button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-12">

        {/* Status message */}
        {message && (
          <div className="border-l-4 border-red-600 bg-zinc-950 px-5 py-3 text-sm font-bold tracking-widest">{message}</div>
        )}

        {/* Dashboard overview */}
        <section className="grid grid-cols-3 gap-4">
          {[
            { label: "TOTAL PRODUCTS", value: products.length, color: "text-white" },
            { label: "POD ITEMS", value: podCount, color: "text-red-600" },
            { label: "AFFILIATE ITEMS", value: affiliateCount, color: "text-zinc-400" },
          ].map((stat) => (
            <div key={stat.label} className="bg-zinc-950 border border-zinc-800 p-5 text-center">
              <p className={`text-4xl font-black ${stat.color}`}>{stat.value}</p>
              <p className="text-[9px] font-bold tracking-[0.3em] text-zinc-600 mt-1">{stat.label}</p>
            </div>
          ))}
        </section>

        {/* ===== ADD / EDIT FORM ===== */}
        <section>
          <h2 className="text-xl font-black tracking-widest border-b-2 border-white pb-4 mb-8">
            {editingId !== null ? "✏️ EDIT PRODUCT" : "＋ ADD NEW PRODUCT"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* POD / Affiliate toggle */}
            <div>
              <label className="block text-[10px] font-black tracking-[0.4em] text-zinc-400 mb-3">PRODUCT TYPE *</label>
              <div className="flex border border-zinc-700 w-fit">
                {(["pod", "affiliate"] as const).map((t) => (
                  <button key={t} type="button"
                    onClick={() => setForm((f) => ({ ...f, type: t }))}
                    className={`px-6 py-3 text-xs font-black tracking-widest transition-colors ${form.type === t ? "bg-red-600 text-white" : "text-zinc-500 hover:text-white"}`}>
                    {t === "pod" ? "👕 PRINT-ON-DEMAND" : "🔗 AFFILIATE"}
                  </button>
                ))}
              </div>
              <p className="text-zinc-600 text-[10px] normal-case mt-2 tracking-widest">
                {form.type === "pod"
                  ? "A product you sell directly — customers can buy and you fulfill the order."
                  : "A link to another site — you earn a commission when someone clicks and buys."}
              </p>
            </div>

            {/* Title + Category row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black tracking-[0.4em] text-zinc-400 mb-2">TITLE *</label>
                <input type="text" placeholder="e.g. Classic Black Tee" value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none px-4 py-3 text-white text-sm normal-case" />
              </div>
              <div>
                <label className="block text-[10px] font-black tracking-[0.4em] text-zinc-400 mb-2">CATEGORY</label>
                <input type="text" placeholder="e.g. Tees, Shoes, Audio" value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none px-4 py-3 text-white text-sm normal-case" />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-[10px] font-black tracking-[0.4em] text-zinc-400 mb-2">DESCRIPTION</label>
              <textarea rows={2} placeholder="Short description..." value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none px-4 py-3 text-white text-sm normal-case resize-none" />
            </div>

            {/* Price */}
            <div>
              <label className="block text-[10px] font-black tracking-[0.4em] text-zinc-400 mb-2">
                {form.type === "pod" ? "PRICE (USD) *" : "PRICE (USD) — for display only"}
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">$</span>
                <input type="number" step="0.01" min="0" placeholder="29.99" value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none pl-8 pr-4 py-3 text-white text-sm" />
              </div>
            </div>

            {/* POD-only fields */}
            {form.type === "pod" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black tracking-[0.4em] text-zinc-400 mb-2">STOCK / INVENTORY</label>
                    <input type="number" min="0" placeholder="e.g. 100" value={form.stock_level}
                      onChange={(e) => setForm({ ...form, stock_level: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none px-4 py-3 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black tracking-[0.4em] text-zinc-400 mb-2">SHIPPING INFO</label>
                    <input type="text" placeholder="e.g. Ships in 3-5 days" value={form.shipping_info}
                      onChange={(e) => setForm({ ...form, shipping_info: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none px-4 py-3 text-white text-sm normal-case" />
                  </div>
                </div>

                {/* Sizes */}
                <div>
                  <label className="block text-[10px] font-black tracking-[0.4em] text-zinc-400 mb-2">SIZES (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="S, M, L, XL, XXL"
                    value={form.sizes}
                    onChange={(e) => setForm({ ...form, sizes: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none px-4 py-3 text-white text-sm normal-case"
                  />
                  <p className="text-zinc-600 text-[10px] normal-case mt-1 tracking-widest">
                    Preview: {form.sizes.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).map((s) => (
                      <span key={s} className="inline-block bg-zinc-800 text-zinc-300 text-[9px] px-2 py-0.5 mx-0.5">{s}</span>
                    ))}
                  </p>
                </div>

                {/* POD Provider */}
                <div>
                  <label className="block text-[10px] font-black tracking-[0.4em] text-zinc-400 mb-3">FULFILLMENT PROVIDER</label>
                  <div className="flex border border-zinc-700 w-fit">
                    {(["printful", "tapstitch"] as const).map((p) => (
                      <button key={p} type="button"
                        onClick={() => setForm((f) => ({ ...f, pod_provider: p }))}
                        className={`px-6 py-3 text-xs font-black tracking-widest transition-colors ${form.pod_provider === p ? "bg-red-600 text-white" : "text-zinc-500 hover:text-white"}`}>
                        {p === "printful" ? "🖨️ PRINTFUL" : "🪡 TAPSTITCH"}
                      </button>
                    ))}
                  </div>
                  <p className="text-zinc-600 text-[10px] normal-case mt-2 tracking-widest">
                    {form.pod_provider === "printful"
                      ? "Orders will be auto-submitted to Printful for printing and shipping."
                      : "Orders will be auto-submitted to Tapstitch for production and fulfillment."}
                  </p>
                </div>

                {/* Variant ID */}
                <div>
                  <label className="block text-[10px] font-black tracking-[0.4em] text-zinc-400 mb-2">
                    {form.pod_provider === "printful" ? "PRINTFUL SYNC VARIANT ID" : "TAPSTITCH VARIANT ID"}
                  </label>
                  {form.pod_provider === "printful" ? (
                    <input
                      type="text"
                      placeholder="e.g. 123456789"
                      value={form.printful_variant_id}
                      onChange={(e) => setForm({ ...form, printful_variant_id: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none px-4 py-3 text-white text-sm normal-case font-mono"
                    />
                  ) : (
                    <input
                      type="text"
                      placeholder="e.g. ts_variant_abc123"
                      value={form.tapstitch_variant_id}
                      onChange={(e) => setForm({ ...form, tapstitch_variant_id: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none px-4 py-3 text-white text-sm normal-case font-mono"
                    />
                  )}
                  <p className="text-zinc-600 text-[10px] normal-case mt-1 tracking-widest">
                    {form.pod_provider === "printful"
                      ? "Find this in Printful → Stores → your product → Sync Variants. Required for auto-fulfillment."
                      : "Find this in your Tapstitch product dashboard. Required for auto-fulfillment."}
                  </p>
                </div>
              </>
            )}

            {/* Affiliate-only field */}
            {form.type === "affiliate" && (
              <div>
                <label className="block text-[10px] font-black tracking-[0.4em] text-zinc-400 mb-2">AFFILIATE LINK *</label>
                <input type="url" placeholder="https://your-affiliate-link.com?ref=you" value={form.external_link}
                  onChange={(e) => setForm({ ...form, external_link: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none px-4 py-3 text-white text-xs normal-case" />
                <p className="text-zinc-600 text-[10px] normal-case mt-1 tracking-widest">Customers will be sent to this URL when they click "Buy Now".</p>
              </div>
            )}

            {/* Color variants (POD only) */}
            {form.type === "pod" && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] font-black tracking-[0.4em] text-zinc-400">COLOR VARIANTS (optional)</label>
                  <button type="button" onClick={addColor} className="text-xs font-black tracking-widest bg-red-600 text-white px-4 py-2 hover:bg-white hover:text-black transition-colors">+ ADD COLOR</button>
                </div>
                {colors.length === 0 ? (
                  <div className="border border-dashed border-zinc-800 py-6 text-center">
                    <p className="text-zinc-600 text-xs tracking-widest">No colors — uses base price.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[2fr_auto_1fr_auto] gap-3 px-1">
                      <span className="text-[9px] font-bold tracking-widest text-zinc-600">NAME</span>
                      <span className="text-[9px] font-bold tracking-widest text-zinc-600">COLOR</span>
                      <span className="text-[9px] font-bold tracking-widest text-zinc-600">PRICE</span>
                      <span />
                    </div>
                    {colors.map((color, i) => (
                      <div key={i} className="grid grid-cols-[2fr_auto_1fr_auto] gap-3 items-center bg-zinc-950 border border-zinc-800 p-3">
                        <input type="text" placeholder="e.g. Navy Blue" value={color.name}
                          onChange={(e) => updateColor(i, "name", e.target.value)}
                          className="bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none px-3 py-2 text-white text-xs normal-case w-full" />
                        <div className="relative">
                          <input type="color" value={color.hex} onChange={(e) => updateColor(i, "hex", e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                          <div className="w-10 h-10 border-2 border-zinc-700 cursor-pointer" style={{ backgroundColor: color.hex }} />
                        </div>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">$</span>
                          <input type="number" step="0.01" min="0" placeholder="29.99" value={color.price || ""}
                            onChange={(e) => updateColor(i, "price", parseFloat(e.target.value) || 0)}
                            className="bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none pl-5 pr-2 py-2 text-white text-xs w-full" />
                        </div>
                        <button type="button" onClick={() => removeColor(i)} className="text-zinc-600 hover:text-red-600 font-black text-lg px-1 transition-colors">✕</button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 px-1 pt-1">
                      <span className="text-[9px] text-zinc-600 tracking-widest">PREVIEW:</span>
                      {colors.map((c, i) => (
                        <div key={i} className="w-5 h-5 rounded-full border border-zinc-700" style={{ backgroundColor: c.hex }} title={c.name} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Image */}
            <div>
              <label className="block text-[10px] font-black tracking-[0.4em] text-zinc-400 mb-3">THUMBNAIL IMAGE</label>
              <div className="flex border border-zinc-700 mb-4 w-fit">
                {(["url", "upload"] as ImageMode[]).map((m) => (
                  <button key={m} type="button"
                    onClick={() => { setImageMode(m); setForm((f) => ({ ...f, thumbnail_url: "" })); }}
                    className={`px-5 py-2 text-xs font-black tracking-widest transition-colors ${imageMode === m ? "bg-red-600 text-white" : "text-zinc-500 hover:text-white"}`}>
                    {m === "url" ? "🔗 PASTE URL" : "📁 UPLOAD FILE"}
                  </button>
                ))}
              </div>

              {imageMode === "url" && (
                <div className="space-y-3">
                  <input type="text" placeholder="https://images.unsplash.com/..." value={form.thumbnail_url}
                    onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none px-4 py-3 text-white text-xs normal-case" />
                  {form.thumbnail_url && (
                    <div className="relative group">
                      <img src={form.thumbnail_url} alt="preview" className="w-full h-56 object-contain bg-zinc-950 border border-zinc-700 cursor-zoom-in"
                        onClick={() => setLightbox(form.thumbnail_url)}
                        onError={(e) => (e.currentTarget.style.display = "none")}
                        onLoad={(e) => (e.currentTarget.style.display = "block")} />
                    </div>
                  )}
                </div>
              )}

              {imageMode === "upload" && (
                <div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFileSelected(f); }} />
                  {!form.thumbnail_url ? (
                    <div onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) void handleFileSelected(f); }}
                      className={`border-2 border-dashed cursor-pointer flex flex-col items-center justify-center py-12 text-center transition-colors ${dragOver ? "border-red-600 bg-zinc-900" : "border-zinc-700 hover:border-zinc-500 bg-zinc-950"}`}>
                      {uploading
                        ? <p className="text-zinc-400 text-sm tracking-widest animate-pulse">LOADING...</p>
                        : <>
                            <div className="text-4xl mb-3">📸</div>
                            <p className="text-white font-black text-sm tracking-widest">DROP IMAGE HERE</p>
                            <p className="text-zinc-500 text-xs normal-case mt-1">or click to browse</p>
                          </>
                      }
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <img src={form.thumbnail_url} alt="preview" className="w-full h-56 object-contain bg-zinc-950 border border-zinc-700 cursor-zoom-in" onClick={() => setLightbox(form.thumbnail_url)} />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setForm((f) => ({ ...f, thumbnail_url: "" })); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                          className="flex-1 bg-zinc-900 border border-zinc-700 text-zinc-400 text-xs font-bold py-2 tracking-widest hover:border-red-600 hover:text-red-600 transition-colors">✕ REMOVE</button>
                        <button type="button" onClick={() => fileInputRef.current?.click()}
                          className="flex-1 bg-red-600 text-white text-xs font-bold py-2 tracking-widest hover:bg-white hover:text-black transition-colors">REPLACE</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="flex gap-4 pt-2">
              <button type="submit" disabled={saving}
                className="bg-red-600 text-white font-black text-xs px-8 py-4 tracking-[0.2em] hover:bg-white hover:text-black transition-colors disabled:opacity-50">
                {saving ? "SAVING..." : editingId !== null ? "SAVE CHANGES" : "ADD PRODUCT"}
              </button>
              {editingId !== null && (
                <button type="button" onClick={resetForm}
                  className="border border-zinc-600 text-zinc-400 font-bold text-xs px-6 py-4 tracking-widest hover:border-white hover:text-white transition-colors">
                  CANCEL
                </button>
              )}
            </div>
          </form>
        </section>

        {/* ===== PRODUCT TABLE ===== */}
        <section>
          <h2 className="text-xl font-black tracking-widest border-b-2 border-white pb-4 mb-6">
            ALL PRODUCTS ({products.length})
          </h2>

          {loading ? (
            <p className="text-zinc-600 text-sm tracking-widest text-center py-12 animate-pulse">LOADING...</p>
          ) : products.length === 0 ? (
            <p className="text-zinc-600 text-sm tracking-widest text-center py-12">No products yet. Add one above!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {["IMAGE","TITLE","TYPE","PRICE","STOCK","ACTIONS"].map((h) => (
                      <th key={h} className="pb-3 pr-4 font-black tracking-[0.3em] text-zinc-500 text-[9px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}
                      className={`border-b transition-colors ${editingId === p.id ? "border-red-600 bg-zinc-950" : "border-zinc-900 hover:bg-zinc-950"}`}>
                      {/* Thumbnail */}
                      <td className="py-3 pr-4 w-14">
                        {p.thumbnail_url
                          ? <img src={p.thumbnail_url} alt={p.title} className="w-12 h-12 object-cover bg-zinc-800 cursor-zoom-in" onClick={() => setLightbox(p.thumbnail_url!)} />
                          : <div className="w-12 h-12 bg-zinc-900 flex items-center justify-center text-zinc-600 text-lg">{p.type === "pod" ? "👕" : "🔗"}</div>
                        }
                      </td>
                      {/* Title + category */}
                      <td className="py-3 pr-4">
                        <p className="font-black text-white tracking-wide truncate max-w-[200px]">{p.title}</p>
                        {p.category && <p className="text-zinc-600 text-[9px] tracking-widest mt-0.5">{p.category}</p>}
                        {Array.isArray(p.colors) && p.colors.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {p.colors.map((c) => (
                              <div key={c.name} className="w-3 h-3 rounded-full border border-zinc-700" style={{ backgroundColor: c.hex }} title={c.name} />
                            ))}
                          </div>
                        )}
                      </td>
                      {/* Type badge */}
                      <td className="py-3 pr-4">
                        <span className={`text-[9px] font-black tracking-widest px-2 py-1 ${p.type === "pod" ? "bg-red-600 text-white" : "bg-zinc-800 text-zinc-300"}`}>
                          {p.type === "pod" ? "POD" : "AFFILIATE"}
                        </span>
                      </td>
                      {/* Price */}
                      <td className="py-3 pr-4 font-black text-red-600 tracking-widest">
                        {p.price !== null ? `$${Number(p.price).toFixed(2)}` : "—"}
                      </td>
                      {/* Stock */}
                      <td className="py-3 pr-4">
                        {p.type === "pod"
                          ? <span className={p.stock_level !== null ? (Number(p.stock_level) > 0 ? "text-green-500" : "text-red-500") : "text-zinc-600"}>
                              {p.stock_level !== null ? p.stock_level : "—"}
                            </span>
                          : <span className="text-zinc-600">N/A</span>
                        }
                      </td>
                      {/* Actions */}
                      <td className="py-3">
                        <div className="flex gap-2">
                          <button onClick={() => startEdit(p)}
                            className="text-[9px] font-black tracking-widest border border-zinc-700 px-3 py-1.5 hover:border-white hover:text-white transition-colors text-zinc-400">
                            EDIT
                          </button>
                          <button onClick={() => void handleDelete(p.id)}
                            className="text-[9px] font-black tracking-widest border border-zinc-800 px-3 py-1.5 hover:border-red-600 hover:text-red-600 transition-colors text-zinc-600">
                            DEL
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="text-zinc-700 text-[10px] tracking-widest text-center pb-8 normal-case">
          All products are stored in the PostgreSQL database and persist across sessions.
        </p>
      </div>
    </div>
  );
}

export default AdminPage;
