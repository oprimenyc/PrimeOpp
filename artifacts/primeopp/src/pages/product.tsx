// Product detail page — /product/:id
// Shows full info for a POD product with color selection.
// Affiliate products redirect automatically.

import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { fetchProduct, type Product } from "@/lib/api";

function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedColor, setSelectedColor] = useState<number | null>(null);
  const [ordered, setOrdered] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const p = await fetchProduct(Number(id));
        // If affiliate, redirect to external link immediately
        if (p.type === "affiliate" && p.external_link) {
          window.open(p.external_link, "_blank");
          setLocation("/");
          return;
        }
        setProduct(p);
      } catch {
        setError("Product not found.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-zinc-400 text-sm tracking-widest uppercase animate-pulse">Loading...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <p className="text-red-600 text-sm tracking-widest uppercase font-bold">{error || "Product not found"}</p>
        <a href="/" className="text-xs text-zinc-400 tracking-widest uppercase hover:text-white">← Back to store</a>
      </div>
    );
  }

  const colors = Array.isArray(product.colors) ? product.colors : [];
  const chosenColor = selectedColor !== null ? colors[selectedColor] : null;
  const displayPrice = chosenColor ? chosenColor.price : (product.price ?? 0);

  function handleOrder() {
    if (colors.length > 0 && selectedColor === null) {
      alert("Please pick a color first!");
      return;
    }
    setOrdered(true);
  }

  return (
    <div className="min-h-screen bg-black text-white">

      {/* Back nav */}
      <div className="border-b border-zinc-900 px-6 py-4">
        <a href="/" className="text-xs text-zinc-500 tracking-widest uppercase hover:text-white transition-colors">
          ← Back to shop
        </a>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-2 gap-12">

        {/* Product image */}
        <div className="aspect-square bg-zinc-950 overflow-hidden">
          {product.thumbnail_url ? (
            <img src={product.thumbnail_url} alt={product.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-800 text-6xl">👕</div>
          )}
        </div>

        {/* Product info */}
        <div className="flex flex-col gap-6">

          {/* Category badge */}
          {product.category && (
            <span className="text-[10px] font-bold tracking-[0.4em] text-red-600 uppercase">{product.category}</span>
          )}

          {/* Title */}
          <h1 className="text-4xl font-black tracking-wide uppercase leading-tight">{product.title}</h1>

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-black text-red-600">${displayPrice.toFixed(2)}</span>
            {chosenColor && chosenColor.price > (product.price ?? 0) && (
              <span className="text-xs text-zinc-500 tracking-widest uppercase">
                +${(chosenColor.price - (product.price ?? 0)).toFixed(2)} for {chosenColor.name}
              </span>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <p className="text-zinc-400 text-sm leading-relaxed normal-case">{product.description}</p>
          )}

          {/* Color picker */}
          {colors.length > 0 && (
            <div>
              <p className="text-[10px] font-bold tracking-[0.4em] text-zinc-500 mb-3 uppercase">
                {chosenColor ? `Color: ${chosenColor.name}` : "Pick a color"}
              </p>
              <div className="flex gap-3 flex-wrap">
                {colors.map((color, i) => (
                  <button
                    key={color.name}
                    onClick={() => setSelectedColor(selectedColor === i ? null : i)}
                    title={`${color.name} — $${color.price.toFixed(2)}`}
                    className="relative w-9 h-9 rounded-full transition-transform hover:scale-110"
                    style={{
                      backgroundColor: color.hex,
                      outline: selectedColor === i ? "2px solid #FF0000" : "2px solid #333",
                      outlineOffset: "2px",
                    }}
                  >
                    {selectedColor === i && (
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-black"
                        style={{ color: isLight(color.hex) ? "#000" : "#fff" }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Shipping info */}
          {product.shipping_info && (
            <p className="text-zinc-600 text-xs tracking-widest uppercase">{product.shipping_info}</p>
          )}

          {/* Stock */}
          {product.stock_level !== null && (
            <p className={`text-xs font-bold tracking-widest uppercase ${product.stock_level > 10 ? "text-green-500" : "text-red-500"}`}>
              {product.stock_level > 0 ? `${product.stock_level} in stock` : "Out of stock"}
            </p>
          )}

          {/* Order button / confirmation */}
          {ordered ? (
            <div className="bg-zinc-950 border-l-4 border-red-600 px-6 py-4">
              <p className="text-white font-black tracking-widest text-sm uppercase">✓ Order received!</p>
              <p className="text-zinc-400 text-xs normal-case mt-1">We'll contact you to confirm your order.</p>
            </div>
          ) : (
            <button
              onClick={handleOrder}
              disabled={product.stock_level === 0}
              className="bg-red-600 text-white font-black text-sm py-5 tracking-[0.3em] uppercase hover:bg-white hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {colors.length > 0 && selectedColor === null ? "SELECT COLOR →" : "BUY NOW"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

export default ProductPage;
