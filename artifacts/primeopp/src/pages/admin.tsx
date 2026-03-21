// Admin Panel — product manager with image upload, gallery, and color variants
// Visit /admin to manage your products.

import { useState, useRef } from "react";
import { getProducts, saveProducts, generateId, resetToDefaults, type Product } from "@/lib/productStore";
import { type ColorVariant } from "@/data/products";

// A blank form for adding/editing a product
const emptyForm = { name: "", price: "", image: "", description: "" };
type ImageMode = "upload" | "url";

// A blank row when adding a new color variant
const emptyColor: ColorVariant = { name: "", hex: "#000000", price: 0 };

function AdminPage() {
  const [products, setProducts] = useState<Product[]>(getProducts);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [imageMode, setImageMode] = useState<ImageMode>("upload");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Color variants being edited — list of {name, hex, price}
  const [colors, setColors] = useState<ColorVariant[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function flash(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  }

  function persist(updated: Product[]) {
    saveProducts(updated);
    setProducts(updated);
  }

  function readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        reject(new Error("Please select an image file (JPG, PNG, WEBP, etc.)"));
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        flash("⚠️ Large image — try to keep files under 2MB.");
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  async function handleFileSelected(file: File) {
    setUploading(true);
    try {
      const dataUrl = await readFileAsDataURL(file);
      setForm((prev) => ({ ...prev, image: dataUrl }));
      flash("✅ Image loaded!");
    } catch (err: unknown) {
      flash(`❌ ${err instanceof Error ? err.message : "Could not load image."}`);
    } finally {
      setUploading(false);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  }

  // ---- Color variant helpers ----

  // Add a new blank color row
  function addColor() {
    // Default price to the base price typed in the form
    const basePrice = parseFloat(form.price) || 0;
    setColors([...colors, { ...emptyColor, price: basePrice }]);
  }

  // Update one field of one color row
  function updateColor(index: number, field: keyof ColorVariant, value: string | number) {
    setColors(colors.map((c, i) => i === index ? { ...c, [field]: value } : c));
  }

  // Remove a color row
  function removeColor(index: number) {
    setColors(colors.filter((_, i) => i !== index));
  }

  // ---- Form submit ----
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.price || !form.image.trim()) {
      flash("❌ Name, price, and image are required.");
      return;
    }
    const price = parseFloat(form.price);
    if (isNaN(price) || price <= 0) {
      flash("❌ Price must be a valid number greater than 0.");
      return;
    }

    // Validate color rows — each needs a name and valid price
    for (const [i, c] of colors.entries()) {
      if (!c.name.trim()) {
        flash(`❌ Color #${i + 1} needs a name.`);
        return;
      }
      if (!c.price || c.price <= 0) {
        flash(`❌ Color #${i + 1} needs a valid price.`);
        return;
      }
    }

    // Build the product object — include colors only if any were added
    const productData = {
      name: form.name.trim(),
      price,
      image: form.image,
      description: form.description.trim(),
      colors: colors.length > 0
        ? colors.map((c) => ({ name: c.name.trim(), hex: c.hex, price: Number(c.price) }))
        : undefined,
    };

    if (editingId !== null) {
      persist(products.map((p) => p.id === editingId ? { ...p, ...productData } : p));
      flash("✅ Product updated!");
    } else {
      persist([...products, { id: generateId(products), ...productData }]);
      flash("✅ Product added!");
    }
    setForm(emptyForm);
    setColors([]);
    setEditingId(null);
  }

  function startEdit(product: Product) {
    setForm({ name: product.name, price: String(product.price), image: product.image, description: product.description });
    setColors(product.colors ? [...product.colors] : []);
    setEditingId(product.id);
    setImageMode(product.image.startsWith("data:") ? "upload" : "url");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setForm(emptyForm);
    setColors([]);
    setEditingId(null);
  }

  function deleteProduct(id: number) {
    if (!confirm("Delete this product?")) return;
    persist(products.filter((p) => p.id !== id));
    flash("🗑️ Product deleted.");
    if (editingId === id) cancelEdit();
  }

  function handleReset() {
    if (!confirm("Reset all products back to the original defaults?")) return;
    resetToDefaults();
    setProducts(getProducts());
    cancelEdit();
    flash("✅ Reset to defaults.");
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans uppercase">

      {/* Fullscreen lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white text-2xl font-black bg-red-600 w-10 h-10 flex items-center justify-center hover:bg-white hover:text-black transition-colors z-10" onClick={() => setLightbox(null)}>✕</button>
          <img src={lightbox} alt="Full size preview" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-zinc-500 text-xs tracking-widest">CLICK ANYWHERE TO CLOSE</p>
        </div>
      )}

      {/* Header */}
      <div className="bg-black border-b-4 border-red-600 px-6 py-6 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-3xl font-black tracking-widest">PRIMEOPP</h1>
          <p className="text-red-600 text-xs tracking-[0.3em] font-bold mt-0.5">PRODUCT MANAGER</p>
        </div>
        <a href="/" className="text-xs font-bold tracking-widest border border-zinc-700 px-4 py-2 hover:bg-white hover:text-black transition-colors">← VIEW STORE</a>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-14">

        {/* Status message */}
        {message && (
          <div className="bg-zinc-900 border-l-4 border-red-600 px-6 py-4 text-sm font-bold tracking-widest">{message}</div>
        )}

        {/* ===== ADD / EDIT FORM ===== */}
        <section>
          <h2 className="text-2xl font-black tracking-widest border-b-2 border-white pb-4 mb-8">
            {editingId !== null ? "✏️ EDIT PRODUCT" : "＋ ADD NEW PRODUCT"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-8">

            {/* Name */}
            <div>
              <label className="block text-[10px] font-black tracking-[0.4em] text-zinc-400 mb-2">PRODUCT NAME *</label>
              <input type="text" placeholder="e.g. Fire Red Tee" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none px-4 py-3 text-white text-sm normal-case" />
            </div>

            {/* Base Price */}
            <div>
              <label className="block text-[10px] font-black tracking-[0.4em] text-zinc-400 mb-2">BASE PRICE (USD) *</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">$</span>
                <input type="number" step="0.01" min="0.01" placeholder="29.99" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none pl-8 pr-4 py-3 text-white text-sm" />
              </div>
              <p className="text-zinc-600 text-[10px] normal-case mt-1 tracking-widest">This is the default price. You can override it per color below.</p>
            </div>

            {/* ===== COLOR VARIANTS ===== */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="text-[10px] font-black tracking-[0.4em] text-zinc-400">COLOR VARIANTS (optional)</label>
                <button type="button" onClick={addColor}
                  className="text-xs font-black tracking-widest bg-red-600 text-white px-4 py-2 hover:bg-white hover:text-black transition-colors">
                  + ADD COLOR
                </button>
              </div>

              {colors.length === 0 ? (
                <div className="border border-dashed border-zinc-800 py-8 text-center">
                  <p className="text-zinc-600 text-xs tracking-widest">No colors yet — product will use the base price.</p>
                  <p className="text-zinc-700 text-[10px] normal-case mt-1">Click "+ ADD COLOR" to let customers choose colors with different prices.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Column headers */}
                  <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-3 px-1">
                    <span className="text-[9px] font-bold tracking-[0.3em] text-zinc-600">COLOR NAME</span>
                    <span className="text-[9px] font-bold tracking-[0.3em] text-zinc-600">SWATCH</span>
                    <span className="text-[9px] font-bold tracking-[0.3em] text-zinc-600">PRICE</span>
                    <span />
                  </div>

                  {colors.map((color, index) => (
                    <div key={index} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-3 items-center bg-zinc-950 border border-zinc-800 p-3">

                      {/* Color name */}
                      <input
                        type="text"
                        placeholder="e.g. Navy Blue"
                        value={color.name}
                        onChange={(e) => updateColor(index, "name", e.target.value)}
                        className="bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none px-3 py-2 text-white text-xs normal-case w-full"
                      />

                      {/* Color picker — the hex value */}
                      <div className="flex items-center gap-2">
                        {/* Clickable color circle that opens the color picker */}
                        <div className="relative">
                          <input
                            type="color"
                            value={color.hex}
                            onChange={(e) => updateColor(index, "hex", e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            title="Pick a color"
                          />
                          <div
                            className="w-10 h-10 border-2 border-zinc-700 cursor-pointer flex-shrink-0"
                            style={{ backgroundColor: color.hex }}
                          />
                        </div>
                        <span className="text-zinc-500 text-[9px] font-mono normal-case hidden sm:block">{color.hex}</span>
                      </div>

                      {/* Per-color price */}
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="29.99"
                          value={color.price || ""}
                          onChange={(e) => updateColor(index, "price", parseFloat(e.target.value) || 0)}
                          className="bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none pl-5 pr-2 py-2 text-white text-xs w-full"
                        />
                      </div>

                      {/* Remove button */}
                      <button type="button" onClick={() => removeColor(index)}
                        className="text-zinc-600 hover:text-red-600 transition-colors font-black text-lg leading-none px-1">
                        ✕
                      </button>
                    </div>
                  ))}

                  {/* Preview of swatches */}
                  <div className="flex items-center gap-2 pt-1 px-1">
                    <span className="text-[9px] font-bold tracking-widest text-zinc-600">PREVIEW:</span>
                    {colors.map((color, i) => (
                      <div key={i} title={`${color.name} — $${Number(color.price).toFixed(2)}`}
                        className="w-6 h-6 rounded-full border-2 border-zinc-700 flex-shrink-0"
                        style={{ backgroundColor: color.hex }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Image */}
            <div>
              <label className="block text-[10px] font-black tracking-[0.4em] text-zinc-400 mb-3">PRODUCT IMAGE *</label>
              <div className="flex border border-zinc-700 mb-4 w-fit">
                <button type="button" onClick={() => { setImageMode("upload"); setForm((f) => ({ ...f, image: "" })); }}
                  className={`px-5 py-2 text-xs font-black tracking-widest transition-colors ${imageMode === "upload" ? "bg-red-600 text-white" : "bg-transparent text-zinc-500 hover:text-white"}`}>
                  📁 UPLOAD FILE
                </button>
                <button type="button" onClick={() => { setImageMode("url"); setForm((f) => ({ ...f, image: "" })); }}
                  className={`px-5 py-2 text-xs font-black tracking-widest transition-colors ${imageMode === "url" ? "bg-red-600 text-white" : "bg-transparent text-zinc-500 hover:text-white"}`}>
                  🔗 PASTE URL
                </button>
              </div>

              {imageMode === "upload" && (
                <div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileInputChange} />
                  {!form.image ? (
                    <div onClick={() => fileInputRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
                      className={`border-2 border-dashed cursor-pointer flex flex-col items-center justify-center py-16 px-6 text-center transition-colors ${dragOver ? "border-red-600 bg-zinc-900" : "border-zinc-700 hover:border-zinc-500 bg-zinc-950"}`}>
                      {uploading ? <p className="text-zinc-400 text-sm tracking-widest animate-pulse">LOADING IMAGE...</p> : (
                        <>
                          <div className="text-5xl mb-4">📸</div>
                          <p className="text-white font-black text-sm tracking-widest mb-1">DROP IMAGE HERE</p>
                          <p className="text-zinc-500 text-xs tracking-widest normal-case">or click to browse your files</p>
                          <p className="text-zinc-700 text-[10px] mt-3 normal-case">JPG, PNG, WEBP — under 2MB recommended</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative group">
                        <img src={form.image} alt="preview" className="w-full h-72 object-contain bg-zinc-950 border border-zinc-700 cursor-zoom-in" onClick={() => setLightbox(form.image)} />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <span className="bg-black/80 text-white text-xs font-bold tracking-widest px-4 py-2">🔍 CLICK TO ZOOM</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setLightbox(form.image)} className="flex-1 bg-zinc-900 border border-zinc-700 text-zinc-400 text-xs font-bold py-2 tracking-widest hover:border-white hover:text-white transition-colors">🔍 FULLSCREEN</button>
                        <button type="button" onClick={() => { setForm((f) => ({ ...f, image: "" })); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="flex-1 bg-zinc-900 border border-zinc-700 text-zinc-400 text-xs font-bold py-2 tracking-widest hover:border-red-600 hover:text-red-600 transition-colors">✕ REMOVE</button>
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="flex-1 bg-red-600 text-white text-xs font-bold py-2 tracking-widest hover:bg-white hover:text-black transition-colors">REPLACE</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {imageMode === "url" && (
                <div className="space-y-3">
                  <input type="text" placeholder="https://... or your Printful mockup URL" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none px-4 py-3 text-white text-xs normal-case" />
                  <p className="text-zinc-600 text-[10px] tracking-widest normal-case">Tip: Right-click a Printful/Printify mockup → "Copy image address". Or use unsplash.com.</p>
                  {form.image && (
                    <div className="space-y-2">
                      <div className="relative group">
                        <img src={form.image} alt="preview" className="w-full h-72 object-contain bg-zinc-950 border border-zinc-700 cursor-zoom-in" onClick={() => setLightbox(form.image)}
                          onError={(e) => (e.currentTarget.style.display = "none")} onLoad={(e) => (e.currentTarget.style.display = "block")} />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <span className="bg-black/80 text-white text-xs font-bold tracking-widest px-4 py-2">🔍 CLICK TO ZOOM</span>
                        </div>
                      </div>
                      <button type="button" onClick={() => setLightbox(form.image)} className="w-full bg-zinc-900 border border-zinc-700 text-zinc-400 text-xs font-bold py-2 tracking-widest hover:border-white hover:text-white transition-colors">🔍 VIEW FULLSCREEN</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-[10px] font-black tracking-[0.4em] text-zinc-400 mb-2">DESCRIPTION (optional)</label>
              <textarea rows={2} placeholder="Short description of the product..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none px-4 py-3 text-white text-sm normal-case resize-none" />
            </div>

            {/* Submit */}
            <div className="flex gap-4 pt-2">
              <button type="submit" className="bg-red-600 text-white font-black text-xs px-8 py-4 tracking-[0.2em] hover:bg-white hover:text-black transition-colors">
                {editingId !== null ? "SAVE CHANGES" : "ADD PRODUCT"}
              </button>
              {editingId !== null && (
                <button type="button" onClick={cancelEdit} className="border border-zinc-600 text-zinc-400 font-bold text-xs px-6 py-4 tracking-widest hover:border-white hover:text-white transition-colors">CANCEL</button>
              )}
            </div>
          </form>
        </section>

        {/* POD Guide */}
        <section className="border border-zinc-800 p-6">
          <h3 className="font-black tracking-widest text-base mb-4 text-red-600">📦 HOW TO ADD PRINTFUL / PRINTIFY PRODUCTS</h3>
          <ol className="space-y-2 text-xs normal-case text-zinc-400 list-none">
            <li className="flex gap-3"><span className="text-red-600 font-black">1.</span> Design your product in Printful or Printify and generate a mockup.</li>
            <li className="flex gap-3"><span className="text-red-600 font-black">2.</span> <strong className="text-white">Upload:</strong> Download the mockup → drag it into the upload box above.</li>
            <li className="flex gap-3"><span className="text-red-600 font-black">3.</span> <strong className="text-white">Or URL:</strong> Right-click the mockup → "Copy image address" → paste in URL tab.</li>
            <li className="flex gap-3"><span className="text-red-600 font-black">4.</span> Set your base price, then add each color Printful offers with its own price if needed.</li>
          </ol>
        </section>

        {/* ===== PRODUCT GALLERY ===== */}
        <section>
          <div className="flex items-center justify-between border-b-2 border-white pb-4 mb-8">
            <h2 className="text-2xl font-black tracking-widest">YOUR PRODUCTS ({products.length})</h2>
            <button onClick={handleReset} className="text-[10px] font-bold tracking-widest text-zinc-600 hover:text-red-600 transition-colors">RESET DEFAULTS</button>
          </div>

          {products.length === 0 && (
            <p className="text-zinc-600 text-sm tracking-widest text-center py-16">No products yet. Add one above!</p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {products.map((product) => (
              <div key={product.id} className={`bg-zinc-950 border transition-colors flex flex-col ${editingId === product.id ? "border-red-600" : "border-zinc-800 hover:border-zinc-600"}`}>

                {/* Clickable image */}
                <div className="relative group cursor-zoom-in overflow-hidden" onClick={() => setLightbox(product.image)}>
                  <img src={product.image} alt={product.name} className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <span className="text-white text-xs font-black tracking-widest opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 px-3 py-1">🔍 ZOOM</span>
                  </div>
                  {product.image.startsWith("data:") && (
                    <span className="absolute top-2 left-2 bg-black text-zinc-400 text-[9px] font-bold tracking-widest px-2 py-0.5">📁 LOCAL</span>
                  )}
                </div>

                <div className="p-3 flex flex-col flex-grow">
                  <p className="font-black text-white tracking-wide text-xs truncate">{product.name}</p>
                  <p className="text-red-600 font-black text-lg tracking-widest mt-0.5">${product.price.toFixed(2)}</p>

                  {/* Color swatches preview */}
                  {product.colors && product.colors.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {product.colors.map((c) => (
                        <div key={c.name} title={`${c.name} — $${c.price.toFixed(2)}`}
                          className="w-5 h-5 rounded-full border border-zinc-700 flex-shrink-0"
                          style={{ backgroundColor: c.hex }} />
                      ))}
                      <span className="text-zinc-600 text-[9px] tracking-widest">{product.colors.length} COLORS</span>
                    </div>
                  )}

                  {product.description && (
                    <p className="text-zinc-500 text-[10px] normal-case mt-1 line-clamp-2">{product.description}</p>
                  )}

                  <div className="flex gap-2 mt-auto pt-3">
                    <button onClick={() => startEdit(product)} className="flex-1 text-[10px] font-black tracking-widest border border-zinc-700 py-2 hover:border-white hover:text-white transition-colors text-zinc-400">EDIT</button>
                    <button onClick={() => deleteProduct(product.id)} className="text-[10px] font-black tracking-widest border border-zinc-800 px-3 py-2 hover:border-red-600 hover:text-red-600 transition-colors text-zinc-600">DEL</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <p className="text-zinc-700 text-[10px] tracking-widest text-center pb-8 normal-case">
          Products & images saved in your browser. Add Stripe + a database when ready for real orders.
        </p>
      </div>
    </div>
  );
}

export default AdminPage;
