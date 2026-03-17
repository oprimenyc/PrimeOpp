import { Product } from "@/data/products";

interface ProductCardProps {
  product: Product;
}

function ProductCard({ product }: ProductCardProps) {
  function handleBuyNow() {
    alert("Added to your exclusive cart. We will contact you.");
  }

  return (
    <div className="group flex flex-col cursor-pointer">
      
      {/* Product Image Wrapper - Editorial Style */}
      <div className="relative w-full aspect-[3/4] overflow-hidden bg-zinc-100 mb-6">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
        />
        
        {/* Urgency/Status Badge */}
        <div className="absolute top-4 left-4 z-10">
          <span className="bg-white/90 backdrop-blur-sm text-black text-[10px] font-sans font-bold tracking-[0.2em] uppercase px-3 py-1.5 shadow-sm">
            {product.id % 2 === 0 ? "Limited Stock" : "New Season"}
          </span>
        </div>

        {/* Hover Overlay with Button */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-8">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleBuyNow();
            }}
            className="translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-500 premium-button-gradient text-white px-8 py-3 text-xs font-sans font-bold tracking-[0.2em] uppercase w-3/4 text-center hover:scale-105"
          >
            Add to Bag
          </button>
        </div>
      </div>

      {/* Product Info */}
      <div className="flex flex-col items-center text-center px-2">
        <h2 className="text-base md:text-lg font-serif text-black mb-2 group-hover:text-gray-600 transition-colors">
          {product.name}
        </h2>
        <p className="text-sm font-sans text-gray-500 mb-3 line-clamp-1 font-light">
          {product.description}
        </p>
        <span className="text-sm font-sans font-medium tracking-widest text-black">
          ${product.price.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

export default ProductCard;