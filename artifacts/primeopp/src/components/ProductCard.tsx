import { Product } from "@/data/products";

interface ProductCardProps {
  product: Product;
}

function ProductCard({ product }: ProductCardProps) {
  function handleBuyNow() {
    alert("Order received! We will contact you.");
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
      <div className="p-4 flex flex-col gap-2 bg-black">
        <h2 className="text-xl font-serif font-bold text-white uppercase line-clamp-1">
          {product.name}
        </h2>
        <span className="text-lg font-sans font-bold text-red-600 tracking-wider">
          ${product.price.toFixed(2)}
        </span>
      </div>

      {/* CTA Button */}
      <button
        onClick={handleBuyNow}
        className="w-full bg-zinc-900 text-white font-bold font-sans tracking-widest py-4 uppercase transition-colors duration-0 hover:bg-red-600 hover:text-white"
      >
        ADD TO CART
      </button>
    </div>
  );
}

export default ProductCard;