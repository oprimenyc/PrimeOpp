import { products } from "@/data/products";
import ProductCard from "@/components/ProductCard";

function HomePage() {
  return (
    <main className="min-h-screen bg-white selection:bg-black selection:text-white">
      
      {/* ===== HERO SECTION ===== */}
      <section className="relative h-screen w-full flex items-center justify-center overflow-hidden bg-black">
        {/* Hero Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-60 mix-blend-luminosity scale-105 animate-in fade-in duration-1000 zoom-in-105"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop')" }}
        />
        <div className="absolute inset-0 hero-gradient pointer-events-none" />
        
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto flex flex-col items-center">
          <span className="text-white/80 font-sans tracking-[0.3em] text-sm md:text-base uppercase mb-6 animate-in slide-in-from-bottom-4 fade-in duration-700 delay-150 fill-mode-both">
            The New Standard
          </span>
          <h1 className="text-6xl md:text-8xl lg:text-9xl font-serif text-white mb-6 leading-none text-glow animate-in slide-in-from-bottom-8 fade-in duration-1000 delay-300 fill-mode-both">
            ELEVATE <br /> <span className="italic font-light">YOUR</span> BASICS.
          </h1>
          <p className="text-gray-300 font-sans text-lg md:text-xl max-w-2xl mx-auto mb-12 font-light tracking-wide animate-in slide-in-from-bottom-4 fade-in duration-700 delay-500 fill-mode-both">
            Meticulously crafted essentials designed for the modern minimalist. Uncompromising quality meets timeless aesthetics.
          </p>
          <a
            href="#shop"
            className="group relative inline-flex items-center justify-center px-10 py-4 font-sans text-sm font-medium tracking-[0.2em] text-black uppercase bg-white overflow-hidden transition-all duration-300 hover:scale-105 animate-in fade-in zoom-in duration-700 delay-700 fill-mode-both"
          >
            <span className="absolute w-0 h-0 transition-all duration-500 ease-out bg-gray-200 rounded-full group-hover:w-56 group-hover:h-56"></span>
            <span className="relative">Explore Collection</span>
          </a>
        </div>
        
        {/* Scroll Indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce opacity-70">
          <span className="text-white text-[10px] font-sans tracking-[0.2em] uppercase mb-2">Scroll</span>
          <div className="w-[1px] h-12 bg-gradient-to-b from-white to-transparent" />
        </div>
      </section>

      {/* ===== TRUST / WHY US SECTION ===== */}
      <section id="about" className="py-24 bg-zinc-50 border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-12 h-12 border border-black flex items-center justify-center rotate-45 mb-2">
                <span className="-rotate-45 block">✦</span>
              </div>
              <h3 className="font-serif text-2xl">Unrivaled Quality</h3>
              <p className="font-sans text-gray-500 text-sm leading-relaxed max-w-xs">
                Sourced from the finest materials globally, engineered to outlast trends and seasons.
              </p>
            </div>
            <div className="flex flex-col items-center space-y-4">
              <div className="w-12 h-12 border border-black flex items-center justify-center rotate-45 mb-2">
                <span className="-rotate-45 block">✈</span>
              </div>
              <h3 className="font-serif text-2xl">Global Delivery</h3>
              <p className="font-sans text-gray-500 text-sm leading-relaxed max-w-xs">
                Complimentary express shipping on all orders worldwide. Experience true luxury service.
              </p>
            </div>
            <div className="flex flex-col items-center space-y-4">
              <div className="w-12 h-12 border border-black flex items-center justify-center rotate-45 mb-2">
                <span className="-rotate-45 block">✓</span>
              </div>
              <h3 className="font-serif text-2xl">The Guarantee</h3>
              <p className="font-sans text-gray-500 text-sm leading-relaxed max-w-xs">
                100% satisfaction guaranteed. If it's not perfect, we'll make it right. No questions asked.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PRODUCTS SECTION ===== */}
      <section id="shop" className="py-32 max-w-[1400px] mx-auto px-6 sm:px-12">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 space-y-6 md:space-y-0">
          <div className="max-w-2xl">
            <h2 className="text-sm font-sans tracking-[0.3em] text-gray-500 uppercase mb-4">
              Season 01
            </h2>
            <h3 className="text-5xl md:text-6xl font-serif text-black leading-tight">
              The Core <br /> <span className="italic text-gray-400">Collection</span>
            </h3>
          </div>
          <div className="text-right pb-2">
            <p className="font-sans text-sm tracking-widest text-black underline decoration-1 underline-offset-8 hover:text-gray-500 transition-colors cursor-pointer">
              VIEW ALL PIECES
            </p>
          </div>
        </div>

        {/* Editorial Product Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-16">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
      
      {/* ===== SOCIAL PROOF SECTION ===== */}
      <section className="bg-black text-white py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-serif text-4xl md:text-5xl mb-12 italic">"Redefining what a simple t-shirt can be."</h2>
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="flex space-x-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg key={star} className="w-5 h-5 fill-current text-white" viewBox="0 0 24 24">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
              ))}
            </div>
            <p className="font-sans text-sm tracking-widest text-gray-400 uppercase">
              Rated 4.9/5 by over 500+ satisfied clients
            </p>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-zinc-50 border-t border-zinc-200 pt-20 pb-10 px-6 sm:px-12">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-2">
            <h4 className="font-serif text-3xl text-black mb-6 uppercase tracking-widest">PrimeOpp</h4>
            <p className="font-sans text-gray-500 text-sm leading-relaxed max-w-sm">
              We design premium essentials for those who demand excellence in their everyday wear. Join the movement of elevated basics.
            </p>
          </div>
          <div>
            <h5 className="font-sans text-xs font-bold tracking-[0.2em] text-black uppercase mb-6">Shop</h5>
            <ul className="space-y-4 font-sans text-sm text-gray-500">
              <li><a href="#" className="hover:text-black transition-colors">All Products</a></li>
              <li><a href="#" className="hover:text-black transition-colors">New Arrivals</a></li>
              <li><a href="#" className="hover:text-black transition-colors">Best Sellers</a></li>
              <li><a href="#" className="hover:text-black transition-colors">Gift Cards</a></li>
            </ul>
          </div>
          <div>
            <h5 className="font-sans text-xs font-bold tracking-[0.2em] text-black uppercase mb-6">Support</h5>
            <ul className="space-y-4 font-sans text-sm text-gray-500">
              <li><a href="#" className="hover:text-black transition-colors">FAQ</a></li>
              <li><a href="#" className="hover:text-black transition-colors">Shipping & Returns</a></li>
              <li><a href="#" className="hover:text-black transition-colors">Contact Us</a></li>
              <li><a href="#" className="hover:text-black transition-colors">Care Guide</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between items-center border-t border-zinc-200 pt-8">
          <p className="font-sans text-xs text-gray-400 mb-4 md:mb-0 tracking-wider">
            © {new Date().getFullYear()} PRIMEOPP STUDIOS. ALL RIGHTS RESERVED.
          </p>
          <div className="flex space-x-6 text-xs font-sans text-gray-400 tracking-wider">
            <a href="#" className="hover:text-black transition-colors">PRIVACY</a>
            <a href="#" className="hover:text-black transition-colors">TERMS</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

export default HomePage;