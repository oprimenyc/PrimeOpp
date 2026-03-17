// This is the main Home page of PrimeOpp
// It shows the hero section and all the products in a grid

import { products } from "@/data/products";
import ProductCard from "@/components/ProductCard";

function HomePage() {
  return (
    // Main page wrapper with a light gray background
    <main className="min-h-screen bg-gray-50">
      
      {/* ===== HERO SECTION ===== */}
      {/* Big welcome banner at the top */}
      <section className="bg-black text-white py-20 px-6 text-center">
        <h1 className="text-5xl font-black tracking-tight mb-4">
          Premium Threads.
          <br />
          <span className="text-gray-400">Prime Prices.</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-md mx-auto mb-8">
          Shop our collection of clean, minimal t-shirts built for everyday wear.
        </p>
        {/* Scroll down to shop button */}
        <a
          href="#shop"
          className="inline-block bg-white text-black px-8 py-3 rounded-full font-semibold hover:bg-gray-100 transition-colors"
        >
          Shop Now
        </a>
      </section>

      {/* ===== PRODUCTS SECTION ===== */}
      {/* This section shows all our products in a grid */}
      <section id="shop" className="max-w-6xl mx-auto px-6 py-16">
        
        {/* Section heading */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Our Collection
          </h2>
          <p className="text-gray-500">
            Handpicked styles. Quality you can feel.
          </p>
        </div>

        {/* Products Grid */}
        {/* On mobile: 1 column, on tablet: 2 columns, on desktop: 3-4 columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Loop through every product and show a card for each one */}
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-black text-gray-500 text-center py-8 px-6">
        <p className="font-bold text-white text-lg mb-1">PrimeOpp</p>
        <p className="text-sm">© 2025 PrimeOpp. Ready for Stripe + Printful integration.</p>
      </footer>
    </main>
  );
}

export default HomePage;
