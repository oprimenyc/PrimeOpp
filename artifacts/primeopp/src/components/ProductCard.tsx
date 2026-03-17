// This is the ProductCard component
// It shows one product: an image, name, price, and a "Buy Now" button
// We use it for every product in our grid

import { Product } from "@/data/products";

// Define what data this component expects to receive
interface ProductCardProps {
  product: Product;
}

function ProductCard({ product }: ProductCardProps) {
  // This function runs when the user clicks "Buy Now"
  function handleBuyNow() {
    alert("Order received! We will contact you.");
  }

  return (
    // The card container — white background, rounded corners, subtle shadow
    // On hover: the card lifts up (translate-y) and shadow gets bigger
    <div className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col border border-gray-100">
      
      {/* Product Image */}
      <div className="overflow-hidden bg-gray-50">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-64 object-cover hover:scale-105 transition-transform duration-300"
        />
      </div>

      {/* Product Info */}
      <div className="p-5 flex flex-col flex-grow">
        
        {/* Product Name */}
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          {product.name}
        </h2>

        {/* Product Description */}
        <p className="text-sm text-gray-500 mb-4 flex-grow">
          {product.description}
        </p>

        {/* Price and Buy Now Button */}
        <div className="flex items-center justify-between mt-auto">
          {/* Price */}
          <span className="text-xl font-bold text-black">
            ${product.price.toFixed(2)}
          </span>

          {/* Buy Now Button — black button, white text */}
          <button
            onClick={handleBuyNow}
            className="bg-black text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-gray-800 active:bg-gray-700 transition-colors duration-200"
          >
            Buy Now
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProductCard;
