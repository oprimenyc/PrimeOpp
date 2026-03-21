// ProductCard — shows one product in the store grid
// If the product has color options, customers can pick a color and see the price change!

import { useState } from "react";
import { type Product } from "@/data/products";

interface ProductCardProps {
  product: Product;
}

function ProductCard({ product }: ProductCardProps) {
  // Track which color the customer has selected (null = none selected yet)
  const [selectedColorIndex, setSelectedColorIndex] = useState<number | null>(null);

  // Check if this product has color variants
  const hasColors = product.colors && product.colors.length > 0;

  // Figure out the price to show:
  // - If a color is selected, use that color's price
  // - Otherwise use the base product price
  const selectedColor = hasColors && selectedColorIndex !== null
    ? product.colors![selectedColorIndex]
    : null;
  const displayPrice = selectedColor ? selectedColor.price : product.price;

  function handleBuyNow() {
    if (hasColors && selectedColorIndex === null) {
      // Remind the customer to pick a color first
      alert("Please pick a color first!");
      return;
    }
    const colorNote = selectedColor ? ` (${selectedColor.name})` : "";
    alert(`Order received for ${product.name}${colorNote}! We will contact you.`);
  }

  return (
    <div className="group flex flex-col bg-black border border-zinc-800 relative">

      {/* Badge */}
      <div className="absolute top-0 left-0 bg-red-600 text-white text-xs font-bold px-3 py-1 tracking-widest z-10 uppercase">
        LIMITED
      </div>

      {/* Product Image */}
      <div className="w-full aspect-[4/5] overflow-hidden bg-zinc-900">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 grayscale group-hover:grayscale-0"
        />
      </div>

      {/* Product Info */}
      <div className="p-4 flex flex-col gap-3 bg-black">

        {/* Name */}
        <h2 className="text-xl font-serif font-bold text-white uppercase line-clamp-1">
          {product.name}
        </h2>

        {/* Price — animates when color changes */}
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-sans font-bold text-red-600 tracking-wider">
            ${displayPrice.toFixed(2)}
          </span>
          {/* Show "+ $X" if selected color costs more than base */}
          {selectedColor && selectedColor.price > product.price && (
            <span className="text-xs text-zinc-500 tracking-widest">
              +${(selectedColor.price - product.price).toFixed(2)} FOR {selectedColor.name.toUpperCase()}
            </span>
          )}
        </div>

        {/* ===== COLOR SWATCHES — only show if product has colors ===== */}
        {hasColors && (
          <div>
            <p className="text-[10px] font-bold tracking-[0.3em] text-zinc-500 mb-2 uppercase">
              {selectedColor ? `COLOR: ${selectedColor.name}` : "PICK A COLOR:"}
            </p>
            <div className="flex gap-2 flex-wrap">
              {product.colors!.map((color, index) => (
                <button
                  key={color.name}
                  onClick={() => {
                    // If clicking the already-selected color, deselect it
                    setSelectedColorIndex(selectedColorIndex === index ? null : index);
                  }}
                  title={`${color.name} — $${color.price.toFixed(2)}`}
                  className="relative transition-transform hover:scale-110"
                >
                  {/* The color circle */}
                  <span
                    className="block w-7 h-7 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: color.hex,
                      // White ring when selected, grey ring otherwise
                      borderColor: selectedColorIndex === index ? "#FFFFFF" : "#444444",
                      // Extra outline to make it pop when selected
                      boxShadow: selectedColorIndex === index ? "0 0 0 2px #FF0000" : "none",
                    }}
                  />
                  {/* Checkmark on selected swatch */}
                  {selectedColorIndex === index && (
                    <span
                      className="absolute inset-0 flex items-center justify-center text-xs font-black"
                      style={{ color: isLightColor(color.hex) ? "#000" : "#fff" }}
                    >
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CTA Button */}
      <button
        onClick={handleBuyNow}
        className={`mt-auto w-full font-bold font-sans tracking-widest py-4 uppercase transition-colors ${
          hasColors && selectedColorIndex === null
            ? "bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-white"
            : "bg-zinc-900 text-white hover:bg-red-600 hover:text-white"
        }`}
      >
        {hasColors && selectedColorIndex === null ? "SELECT COLOR →" : "ADD TO CART"}
      </button>
    </div>
  );
}

// Helper: decide if a hex color is light or dark (so the checkmark is readable)
function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Standard formula for perceived brightness
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

export default ProductCard;
