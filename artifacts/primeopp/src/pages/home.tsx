// PrimeOpp Homepage
// The hero auto-cycles through your products — just update products.ts and it updates itself!

import { useState, useEffect } from "react";
import { products } from "@/data/products";
import ProductCard from "@/components/ProductCard";

function HomePage() {
  // Tracks which product is currently featured in the hero
  const [activeIndex, setActiveIndex] = useState(0);
  // Controls the fade animation when switching
  const [fading, setFading] = useState(false);

  // Auto-advance to the next product every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      // Start fade out
      setFading(true);
      setTimeout(() => {
        // Switch to next product (loops back to 0 at the end)
        setActiveIndex((prev) => (prev + 1) % products.length);
        // Fade back in
        setFading(false);
      }, 400);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // The product currently shown in the hero
  const featured = products[activeIndex];

  return (
    <main className="min-h-screen bg-black selection:bg-red-600 selection:text-white font-sans uppercase">

      {/* ===== HERO SECTION =====
          Automatically cycles through every product.
          To change what shows here: just edit src/data/products.ts */}
      <section className="relative h-screen w-full overflow-hidden bg-black pt-16">

        {/* Background product image — fades between products */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-500"
          style={{
            backgroundImage: `url(${featured.image})`,
            opacity: fading ? 0 : 0.25,
          }}
        />
        {/* Dark overlay so text stays readable */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/40" />

        {/* Hero content */}
        <div className="relative z-10 h-full flex flex-col justify-end pb-16 px-6 sm:px-12 max-w-[1600px] mx-auto">

          {/* Drop counter — top left */}
          <div className="absolute top-24 left-6 sm:left-12 flex items-center gap-3">
            <span className="text-red-600 font-black text-xs tracking-[0.3em]">
              {String(activeIndex + 1).padStart(2, "0")} / {String(products.length).padStart(2, "0")}
            </span>
            {/* Progress dots — one per product */}
            <div className="flex gap-1.5">
              {products.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setFading(true); setTimeout(() => { setActiveIndex(i); setFading(false); }, 400); }}
                  className={`h-[3px] transition-all duration-300 ${i === activeIndex ? "w-8 bg-red-600" : "w-3 bg-zinc-600"}`}
                />
              ))}
            </div>
          </div>

          {/* "NOW FEATURING" label */}
          <p className="text-zinc-500 text-xs tracking-[0.4em] font-bold mb-3">
            NOW FEATURING
          </p>

          {/* Product name — big, bold, auto-updates */}
          <h1
            className="text-[10vw] sm:text-[8vw] font-black text-white leading-none tracking-tighter mb-4 transition-opacity duration-400"
            style={{ opacity: fading ? 0 : 1 }}
          >
            {featured.name.toUpperCase()}
          </h1>

          {/* Price in red */}
          <p
            className="text-red-600 font-black text-3xl sm:text-5xl tracking-widest mb-10 transition-opacity duration-400"
            style={{ opacity: fading ? 0 : 1 }}
          >
            ${featured.price.toFixed(2)}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="#shop"
              className="inline-block bg-red-600 text-white font-black text-sm px-10 py-5 tracking-[0.2em] hover:bg-white hover:text-black transition-colors"
            >
              SHOP ALL DROPS
            </a>
            <button
              onClick={() => alert("Order received! We will contact you.")}
              className="inline-block border-2 border-white text-white font-black text-sm px-10 py-5 tracking-[0.2em] hover:bg-white hover:text-black transition-colors"
            >
              BUY THIS NOW — ${featured.price.toFixed(2)}
            </button>
          </div>
        </div>
      </section>

      {/* ===== MARQUEE STRIP ===== */}
      <div className="w-full bg-red-600 py-4 overflow-hidden flex whitespace-nowrap border-y-4 border-white">
        <div className="animate-marquee inline-block font-black text-2xl md:text-4xl text-white tracking-widest">
          FREE SHIPPING · LIMITED DROP · SOLD OUT SOON · ORDER NOW · FREE SHIPPING · LIMITED DROP · SOLD OUT SOON · ORDER NOW · FREE SHIPPING · LIMITED DROP · SOLD OUT SOON · ORDER NOW ·&nbsp;
        </div>
      </div>

      {/* ===== PRODUCTS GRID ===== */}
      <section id="shop" className="py-32 bg-[#111] w-full px-6 sm:px-12">
        <div className="max-w-[1600px] mx-auto">
          <div className="mb-16 border-b-4 border-white pb-6 flex justify-between items-end">
            <h2 className="text-6xl md:text-8xl font-black text-white leading-none tracking-tighter">
              DROP 01
            </h2>
            <p className="text-red-600 font-bold tracking-widest text-xl hidden md:block">
              // ALL SALES FINAL
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* ===== SOCIAL PROOF ===== */}
      <section className="bg-black text-white py-32 border-y border-zinc-800">
        <div className="max-w-[1600px] mx-auto px-6 flex flex-col md:flex-row items-center justify-center text-center md:text-left gap-8">
          <h2 className="font-black text-[15vw] md:text-[10vw] leading-none tracking-tighter text-white">
            500+
          </h2>
          <div className="flex flex-col gap-2">
            <h3 className="font-black text-3xl md:text-5xl tracking-widest text-red-600">SATISFIED</h3>
            <h3 className="font-black text-3xl md:text-5xl tracking-widest text-white">CUSTOMERS</h3>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-black py-20 px-6 sm:px-12">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
          <h4 className="font-black text-6xl md:text-8xl text-white tracking-tighter hover:text-red-600 transition-colors cursor-pointer">
            PRIMEOPP
          </h4>
          <div className="flex gap-8 text-sm font-bold tracking-widest text-zinc-500">
            <a href="#" className="hover:text-white transition-colors">INSTAGRAM</a>
            <a href="#" className="hover:text-white transition-colors">TWITTER</a>
            <a href="#" className="hover:text-white transition-colors">TERMS</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

export default HomePage;
