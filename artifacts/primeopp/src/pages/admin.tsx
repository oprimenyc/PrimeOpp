// Admin Panel — product manager with image upload
// Visit /admin to manage your products.
// You can upload images from your computer OR paste a URL.

import { useState, useRef } from "react";
import { getProducts, saveProducts, generateId, resetToDefaults, type Product } from "@/lib/productStore";

const emptyForm = { name: "", price: "", image: "", description: "" };

// Which image input mode the user has selected
type ImageMode = "upload" | "url";

function AdminPage() {
  const [products, setProducts] = useState<Product[]>(getProducts);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [imageMode, setImageMode] = useState<ImageMode>("upload");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function flash(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  }

  function persist(updated: Product[]) {
    saveProducts(updated);
    setProducts(updated);
  }

  // Convert an image file to a base64 data URL so it can be stored without a server
  function readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      // Only allow image files
      if (!file.type.startsWith("image/")) {
        reject(new Error("Please select an image file (JPG, PNG, WEBP, etc.)"));
        return;
      }
      // Warn about large files (> 2MB can slow down the browser)
      if (file.size > 2 * 1024 * 1024) {
        flash("⚠️ Large image detected. Try to use files under 2MB for best performance.");
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  // Handle file selected via the file picker or drag-and-drop
  async function handleFileSelected(file: File) {
    setUploading(true);
    try {
      const dataUrl = await readFileAsDataURL(file);
      setForm((prev) => ({ ...prev, image: dataUrl }));
      flash("✅ Image loaded! Ready to save.");
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

    if (editingId !== null) {
      persist(products.map((p) =>
        p.id === editingId
          ? { ...p, name: form.name.trim(), price, image: form.image, description: form.description.trim() }
          : p
      ));
      flash("✅ Product updated!");
    } else {
      persist([...products, {
        id: generateId(products),
        name: form.name.trim(),
        price,
        image: form.image,
        description: form.description.trim(),
      }]);
      flash("✅ Product added to your store!");
    }
    setForm(emptyForm);
    setEditingId(null);
  }

  function startEdit(product: Product) {
    setForm({ name: product.name, price: String(product.price), image: product.image, description: product.description });
    setEditingId(product.id);
    // If the saved image is a data URL (uploaded file), show it in upload mode
    setImageMode(product.image.startsWith("data:") ? "upload" : "url");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function deleteProduct(id: number) {
    if (!confirm("Delete this product? This cannot be undone.")) return;
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

      {/* Header */}
      <div className="bg-black border-b-4 border-red-600 px-6 py-6 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-3xl font-black tracking-widest">PRIMEOPP</h1>
          <p className="text-red-600 text-xs tracking-[0.3em] font-bold mt-0.5">PRODUCT MANAGER</p>
        </div>
        <a href="/" className="text-xs font-bold tracking-widest border border-zinc-700 px-4 py-2 hover:bg-white hover:text-black transition-colors">
          ← VIEW STORE
        </a>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-14">

        {/* Status message */}
        {message && (
          <div className="bg-zinc-900 border-l-4 border-red-600 px-6 py-4 text-sm font-bold tracking-widest">
            {message}
          </div>
        )}

        {/* ===== ADD / EDIT FORM ===== */}
        <section>
          <h2 className="text-2xl font-black tracking-widest border-b-2 border-white pb-4 mb-8">
            {editingId !== null ? "✏️ EDIT PRODUCT" : "＋ ADD NEW PRODUCT"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Product Name */}
            <div>
              <label className="block text-[10px] font-black tracking-[0.4em] text-zinc-400 mb-2">PRODUCT NAME *</label>
              <input
                type="text"
                placeholder="e.g. Fire Red Tee"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none px-4 py-3 text-white text-sm normal-case"
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-[10px] font-black tracking-[0.4em] text-zinc-400 mb-2">PRICE (USD) *</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="29.99"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none pl-8 pr-4 py-3 text-white text-sm"
                />
              </div>
            </div>

            {/* ===== IMAGE SECTION — toggle between Upload and URL ===== */}
            <div>
              <label className="block text-[10px] font-black tracking-[0.4em] text-zinc-400 mb-3">PRODUCT IMAGE *</label>

              {/* Toggle tabs */}
              <div className="flex border border-zinc-700 mb-4 w-fit">
                <button
                  type="button"
                  onClick={() => { setImageMode("upload"); setForm((f) => ({ ...f, image: "" })); }}
                  className={`px-5 py-2 text-xs font-black tracking-widest transition-colors ${imageMode === "upload" ? "bg-red-600 text-white" : "bg-transparent text-zinc-500 hover:text-white"}`}
                >
                  📁 UPLOAD FILE
                </button>
                <button
                  type="button"
                  onClick={() => { setImageMode("url"); setForm((f) => ({ ...f, image: "" })); }}
                  className={`px-5 py-2 text-xs font-black tracking-widest transition-colors ${imageMode === "url" ? "bg-red-600 text-white" : "bg-transparent text-zinc-500 hover:text-white"}`}
                >
                  🔗 PASTE URL
                </button>
              </div>

              {/* UPLOAD MODE — drag and drop or click to browse */}
              {imageMode === "upload" && (
                <div>
                  {/* Hidden real file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileInputChange}
                  />

                  {/* If no image yet — show the drop zone */}
                  {!form.image ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed cursor-pointer flex flex-col items-center justify-center py-12 px-6 text-center transition-colors ${
                        dragOver ? "border-red-600 bg-zinc-900" : "border-zinc-700 hover:border-zinc-500 bg-zinc-950"
                      }`}
                    >
                      {uploading ? (
                        <p className="text-zinc-400 text-sm tracking-widest">LOADING IMAGE...</p>
                      ) : (
                        <>
                          <div className="text-4xl mb-4">📸</div>
                          <p className="text-white font-black text-sm tracking-widest mb-1">DROP IMAGE HERE</p>
                          <p className="text-zinc-500 text-xs tracking-widest normal-case">or click to browse your files</p>
                          <p className="text-zinc-700 text-[10px] mt-3 normal-case">JPG, PNG, WEBP — under 2MB recommended</p>
                        </>
                      )}
                    </div>
                  ) : (
                    /* Image preview + change button */
                    <div className="relative border border-zinc-700">
                      <img src={form.image} alt="preview" className="w-full h-48 object-cover" />
                      <button
                        type="button"
                        onClick={() => { setForm((f) => ({ ...f, image: "" })); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                        className="absolute top-2 right-2 bg-black border border-zinc-600 text-white text-xs font-bold px-3 py-1 hover:border-red-600 hover:text-red-600 transition-colors"
                      >
                        ✕ CHANGE
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-2 right-2 bg-red-600 text-white text-xs font-bold px-3 py-1 hover:bg-white hover:text-black transition-colors"
                      >
                        REPLACE
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* URL MODE — paste a link */}
              {imageMode === "url" && (
                <div>
                  <input
                    type="text"
                    placeholder="https://images.unsplash.com/... or your Printful mockup URL"
                    value={form.image}
                    onChange={(e) => setForm({ ...form, image: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none px-4 py-3 text-white text-xs normal-case"
                  />
                  <p className="text-zinc-600 text-[10px] tracking-widest mt-2 normal-case">
                    Tip: For Printful/Printify — copy the mockup image URL from your product dashboard. For free photos, use unsplash.com.
                  </p>
                  {form.image && (
                    <img
                      src={form.image}
                      alt="preview"
                      className="mt-3 h-32 w-32 object-cover border border-zinc-700"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                      onLoad={(e) => (e.currentTarget.style.display = "block")}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-[10px] font-black tracking-[0.4em] text-zinc-400 mb-2">DESCRIPTION (optional)</label>
              <textarea
                rows={2}
                placeholder="Short description of the product..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none px-4 py-3 text-white text-sm normal-case resize-none"
              />
            </div>

            {/* Submit buttons */}
            <div className="flex gap-4 pt-2">
              <button
                type="submit"
                className="bg-red-600 text-white font-black text-xs px-8 py-4 tracking-[0.2em] hover:bg-white hover:text-black transition-colors"
              >
                {editingId !== null ? "SAVE CHANGES" : "ADD PRODUCT"}
              </button>
              {editingId !== null && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="border border-zinc-600 text-zinc-400 font-bold text-xs px-6 py-4 tracking-widest hover:border-white hover:text-white transition-colors"
                >
                  CANCEL
                </button>
              )}
            </div>
          </form>
        </section>

        {/* ===== POD GUIDE ===== */}
        <section className="border border-zinc-800 p-6">
          <h3 className="font-black tracking-widest text-lg mb-4 text-red-600">📦 HOW TO ADD PRINTFUL / PRINTIFY PRODUCTS</h3>
          <ol className="space-y-3 text-sm normal-case text-zinc-300 list-none">
            <li className="flex gap-3"><span className="text-red-600 font-black flex-shrink-0">1.</span> Create your product in Printful or Printify and generate a mockup image.</li>
            <li className="flex gap-3"><span className="text-red-600 font-black flex-shrink-0">2.</span> <strong className="text-white">Option A — Upload:</strong> Download the mockup image to your computer, then use the "Upload File" tab above to drag it in.</li>
            <li className="flex gap-3"><span className="text-red-600 font-black flex-shrink-0">3.</span> <strong className="text-white">Option B — URL:</strong> Right-click the mockup image in Printful/Printify → "Copy image address" → paste it in the "Paste URL" tab.</li>
            <li className="flex gap-3"><span className="text-red-600 font-black flex-shrink-0">4.</span> Set the price to match what Printful charges you + your profit margin (e.g. Printful charges $12 → you sell for $29.99).</li>
            <li className="flex gap-3"><span className="text-red-600 font-black flex-shrink-0">5.</span> When you're ready to take real orders and payments, we can add Stripe + Printful integration.</li>
          </ol>
        </section>

        {/* ===== CURRENT PRODUCTS LIST ===== */}
        <section>
          <div className="flex items-center justify-between border-b-2 border-white pb-4 mb-6">
            <h2 className="text-2xl font-black tracking-widest">YOUR PRODUCTS ({products.length})</h2>
            <button onClick={handleReset} className="text-[10px] font-bold tracking-widest text-zinc-600 hover:text-red-600 transition-colors">
              RESET TO DEFAULTS
            </button>
          </div>

          {products.length === 0 && (
            <p className="text-zinc-600 text-sm tracking-widest">No products yet. Add one above!</p>
          )}

          <div className="space-y-3">
            {products.map((product) => (
              <div
                key={product.id}
                className={`flex items-center gap-4 bg-zinc-900 border p-4 transition-colors ${
                  editingId === product.id ? "border-red-600" : "border-zinc-800 hover:border-zinc-600"
                }`}
              >
                <img src={product.image} alt={product.name} className="w-16 h-16 object-cover flex-shrink-0 bg-zinc-800" />
                <div className="flex-grow min-w-0">
                  <p className="font-black text-white tracking-widest truncate">{product.name}</p>
                  <p className="text-red-600 font-bold text-sm tracking-widest">${product.price.toFixed(2)}</p>
                  {product.description && (
                    <p className="text-zinc-500 text-xs normal-case mt-0.5 truncate">{product.description}</p>
                  )}
                  {product.image.startsWith("data:") && (
                    <p className="text-zinc-600 text-[10px] tracking-widest mt-0.5">📁 Uploaded image</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => startEdit(product)}
                    className="text-xs font-bold tracking-widest border border-zinc-600 px-3 py-2 hover:border-white hover:text-white transition-colors text-zinc-400"
                  >
                    EDIT
                  </button>
                  <button
                    onClick={() => deleteProduct(product.id)}
                    className="text-xs font-bold tracking-widest border border-zinc-800 px-3 py-2 hover:border-red-600 hover:text-red-600 transition-colors text-zinc-600"
                  >
                    DEL
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <p className="text-zinc-700 text-[10px] tracking-widest text-center pb-8 normal-case">
          Products & uploaded images are saved in your browser. Add Stripe + a database when you're ready for real orders.
        </p>
      </div>
    </div>
  );
}

export default AdminPage;
