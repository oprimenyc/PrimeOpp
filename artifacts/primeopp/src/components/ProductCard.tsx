import { useState } from "react";
import { type Product } from "@/lib/api";

interface Props { product: Product }

function ProductCard({ product }: Props) {
  const [selectedColorIndex, setSelectedColorIndex] = useState<number | null>(null);

  const colors = Array.isArray(product.colors) ? product.colors : [];
  const selectedColor = selectedColorIndex !== null ? colors[selectedColorIndex] : null;
  const displayPrice = selectedColor ? selectedColor.price : Number(product.price ?? 0);

  function handleBuyNow() {
    if (product.type === "affiliate" && product.external_link) {
      window.open(product.external_link, "_blank", "noopener,noreferrer");
      return;
    }
    window.location.href = `/product/${product.id}`;
  }

  return (
    <div className="group flex flex-col bg-black border border-zinc-800 relative">

      {/* Badge */}
      <div className={`absolute top-0 left-0 text-white text-xs font-bold px-3 py-1 tracking-widest z-10 uppercase ${product.type === "affiliate" ? "bg-zinc-700" : "bg-red-600"}`}>
        {product.type === "affiliate" ? "PARTNER" : "LIMITED"}
      </div>

      {/* Product image */}
      <div className="w-full aspect-[4/5] overflow-hidden bg-zinc-900">
        {product.thumbnail_url ? (
          <img
            src={product.thumbnail_url}
            alt={product.title}
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 grayscale group-hover:grayscale-0"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-700 text-6xl">
            {product.type === "affiliate" ? "🔗" : "🛍️"}
          </div>
        )}
      </div>

      {/* Product info */}
      <div className="p-4 flex flex-col gap-2 bg-black">
        {product.category && (
          <p className="text-[9px] font-bold tracking-[0.3em] text-zinc-600">{product.category}</p>
        )}
        <h2 className="text-lg font-serif font-bold text-white uppercase line-clamp-2 leading-tight">
          {product.title}
        </h2>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-sans font-bold text-red-600 tracking-wider">
            ${displayPrice.toFixed(2)}
          </span>
          {selectedColor && selectedColor.price > Number(product.price ?? 0) && (
            <span className="text-[10px] text-zinc-500 tracking-widest">+${(selectedColor.price - Number(product.price)).toFixed(2)}</span>
          )}
        </div>

        {/* Color swatches */}
        {colors.length > 0 && (
          <div>
            <p className="text-[10px] font-bold tracking-[0.3em] text-zinc-500 mb-2 uppercase">
              {selectedColor ? `COLOR: ${selectedColor.name}` : "PICK A COLOR:"}
            </p>
            <div className="flex gap-2 flex-wrap">
              {colors.map((color, i) => (
                <button
                  key={color.name}
                  onClick={() => setSelectedColorIndex(selectedColorIndex === i ? null : i)}
                  title={`${color.name} — $${color.price.toFixed(2)}`}
                  className="relative transition-transform hover:scale-110"
                >
                  <span
                    className="block w-6 h-6 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: color.hex,
                      borderColor: selectedColorIndex === i ? "#FFFFFF" : "#444",
                      boxShadow: selectedColorIndex === i ? "0 0 0 2px #FF0000" : "none",
                    }}
                  />
                  {selectedColorIndex === i && (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black"
                      style={{ color: isLight(color.hex) ? "#000" : "#fff" }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CTA button */}
      <button
        onClick={handleBuyNow}
        className={`mt-auto w-full font-bold font-sans tracking-widest py-4 uppercase transition-colors ${
          colors.length > 0 && selectedColorIndex === null
            ? "bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-white"
            : "bg-zinc-900 text-white hover:bg-red-600 hover:text-white"
        }`}
      >
        {product.type === "affiliate"
          ? "SHOP NOW ↗"
          : colors.length > 0 && selectedColorIndex === null
            ? "SELECT COLOR →"
            : "VIEW DETAILS →"}
      </button>
    </div>
  );
}

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

export default ProductCard;
