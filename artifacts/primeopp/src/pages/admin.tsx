// Admin Panel — your easy product manager!
// Visit /admin to access this page.
// Add, edit, or delete products here — no code required.
// Changes save automatically and show up on the store instantly.

import { useState } from "react";
import { getProducts, saveProducts, generateId, resetToDefaults, type Product } from "@/lib/productStore";

// A blank product form for adding new items
const emptyForm = {
  name: "",
  price: "",
  image: "",
  description: "",
};

function AdminPage() {
  // All current products
  const [products, setProducts] = useState<Product[]>(getProducts);
  // Form values for adding/editing
  const [form, setForm] = useState(emptyForm);
  // If we're editing, this holds the product's id
  const [editingId, setEditingId] = useState<number | null>(null);
  // Success/error message to show after saving
  const [message, setMessage] = useState("");

  // Show a temporary status message
  function flash(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(""), 2500);
  }

  // Save the full product list and update state
  function persist(updated: Product[]) {
    saveProducts(updated);
    setProducts(updated);
  }

  // Called when the form is submitted (add or edit)
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate required fields
    if (!form.name.trim() || !form.price || !form.image.trim()) {
      flash("❌ Name, price, and image URL are required.");
      return;
    }

    const price = parseFloat(form.price);
    if (isNaN(price) || price <= 0) {
      flash("❌ Price must be a valid number.");
      return;
    }

    if (editingId !== null) {
      // Update existing product
      const updated = products.map((p) =>
        p.id === editingId
          ? { ...p, name: form.name.trim(), price, image: form.image.trim(), description: form.description.trim() }
          : p
      );
      persist(updated);
      flash("✅ Product updated!");
    } else {
      // Add new product
      const newProduct: Product = {
        id: generateId(products),
        name: form.name.trim(),
        price,
        image: form.image.trim(),
        description: form.description.trim(),
      };
      persist([...products, newProduct]);
      flash("✅ Product added!");
    }

    // Reset form
    setForm(emptyForm);
    setEditingId(null);
  }

  // Load a product into the form for editing
  function startEdit(product: Product) {
    setForm({
      name: product.name,
      price: String(product.price),
      image: product.image,
      description: product.description,
    });
    setEditingId(product.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Cancel editing and reset form
  function cancelEdit() {
    setForm(emptyForm);
    setEditingId(null);
  }

  // Delete a product after confirmation
  function deleteProduct(id: number) {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    persist(products.filter((p) => p.id !== id));
    flash("🗑️ Product deleted.");
    if (editingId === id) cancelEdit();
  }

  // Reset everything back to the original 4 t-shirts
  function handleReset() {
    if (!confirm("Reset all products back to the original defaults? This will delete any products you added.")) return;
    resetToDefaults();
    setProducts(getProducts());
    cancelEdit();
    flash("✅ Reset to defaults.");
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans uppercase">

      {/* Header */}
      <div className="bg-black border-b-4 border-red-600 px-6 py-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-widest text-white">PRIMEOPP</h1>
          <p className="text-red-600 text-xs tracking-[0.3em] font-bold mt-1">PRODUCT MANAGER</p>
        </div>
        <a
          href="/"
          className="text-xs font-bold tracking-widest border border-zinc-700 px-4 py-2 hover:bg-white hover:text-black transition-colors"
        >
          ← VIEW STORE
        </a>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">

        {/* Status message */}
        {message && (
          <div className="bg-zinc-900 border border-zinc-700 px-6 py-4 text-sm font-bold tracking-widest text-white">
            {message}
          </div>
        )}

        {/* ===== ADD / EDIT FORM ===== */}
        <section>
          <h2 className="text-2xl font-black tracking-widest mb-6 border-b-2 border-white pb-4">
            {editingId !== null ? "✏️ EDIT PRODUCT" : "＋ ADD NEW PRODUCT"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-bold tracking-[0.3em] text-zinc-400 mb-2">
                PRODUCT NAME *
              </label>
              <input
                type="text"
                placeholder="e.g. Midnight Black Tee"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none px-4 py-3 text-white font-sans text-sm tracking-wide"
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-xs font-bold tracking-[0.3em] text-zinc-400 mb-2">
                PRICE (USD) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g. 29.99"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none px-4 py-3 text-white font-sans text-sm tracking-wide"
              />
            </div>

            {/* Image URL */}
            <div>
              <label className="block text-xs font-bold tracking-[0.3em] text-zinc-400 mb-2">
                IMAGE URL *
              </label>
              <input
                type="url"
                placeholder="https://images.unsplash.com/..."
                value={form.image}
                onChange={(e) => setForm({ ...form, image: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none px-4 py-3 text-white font-sans text-sm tracking-wide"
              />
              <p className="text-zinc-600 text-[10px] tracking-widest mt-1 normal-case">
                Tip: Get free product photos from unsplash.com — right-click any photo → "Copy image address"
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold tracking-[0.3em] text-zinc-400 mb-2">
                DESCRIPTION (optional)
              </label>
              <textarea
                rows={2}
                placeholder="Short product description..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none px-4 py-3 text-white font-sans text-sm tracking-wide resize-none normal-case"
              />
            </div>

            {/* Preview of image */}
            {form.image && (
              <div>
                <p className="text-xs font-bold tracking-[0.3em] text-zinc-400 mb-2">IMAGE PREVIEW</p>
                <img
                  src={form.image}
                  alt="preview"
                  className="h-32 w-32 object-cover border border-zinc-700"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              </div>
            )}

            {/* Buttons */}
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

        {/* ===== CURRENT PRODUCTS LIST ===== */}
        <section>
          <div className="flex items-center justify-between border-b-2 border-white pb-4 mb-6">
            <h2 className="text-2xl font-black tracking-widest">
              YOUR PRODUCTS ({products.length})
            </h2>
            <button
              onClick={handleReset}
              className="text-[10px] font-bold tracking-widest text-zinc-600 hover:text-red-600 transition-colors"
            >
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
                {/* Product image thumbnail */}
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-16 h-16 object-cover flex-shrink-0 bg-zinc-800"
                />

                {/* Product info */}
                <div className="flex-grow min-w-0">
                  <p className="font-black text-white tracking-widest truncate">{product.name}</p>
                  <p className="text-red-600 font-bold text-sm tracking-widest">${product.price.toFixed(2)}</p>
                  {product.description && (
                    <p className="text-zinc-500 text-xs normal-case mt-0.5 truncate">{product.description}</p>
                  )}
                </div>

                {/* Edit / Delete buttons */}
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
                    DELETE
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer note */}
        <p className="text-zinc-700 text-[10px] tracking-widest text-center pb-8 normal-case">
          Products are saved in your browser. For permanent storage, a database upgrade is recommended.
        </p>
      </div>
    </div>
  );
}

export default AdminPage;
