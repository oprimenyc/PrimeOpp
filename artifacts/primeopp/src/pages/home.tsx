import { useState, useEffect } from "react";
import { fetchProducts, type Product } from "@/lib/api";
import ProductCard from "@/components/ProductCard";

function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const heroProducts = products.filter((p) => p.type !== "affiliate");
  const featured = heroProducts[activeIndex % Math.max(heroProducts.length, 1)];

  useEffect(() => {
    if (heroProducts.length < 2) return;
    const id = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % heroProducts.length);
        setFading(false);
      }, 400);
    }, 4000);
    return () => clearInterval(id);
  }, [heroProducts.length]);

  function switchTo(i: number) {
    setFading(true);
    setTimeout(() => { setActiveIndex(i); setFading(false); }, 400);
  }

  return (
    <main className="min-h-screen bg-black selection:bg-red-600 selection:text-white font-sans uppercase">

      {/* ===== HERO ===== */}
      {featured && (
        <section className="relative h-screen w-full overflow-hidden bg-black pt-16">
          <div
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-500"
            style={{ backgroundImage: `url(${featured.thumbnail_url ?? ""})`, opacity: fading ? 0 : 0.25 }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/40" />
          <div className="relative z-10 h-full flex flex-col justify-end pb-16 px-6 sm:px-12 max-w-[1600px] mx-auto">
            {heroProducts.length > 1 && (
              <div className="absolute top-24 left-6 sm:left-12 flex items-center gap-3">
                <span className="text-red-600 font-black text-xs tracking-[0.3em]">
                  {String(activeIndex + 1).padStart(2, "0")} / {String(heroProducts.length).padStart(2, "0")}
                </span>
                <div className="flex gap-1.5">
                  {heroProducts.map((_, i) => (
                    <button key={i} onClick={() => switchTo(i)}
                      className={`h-[3px] transition-all duration-300 ${i === activeIndex ? "w-8 bg-red-600" : "w-3 bg-zinc-600"}`} />
                  ))}
                </div>
              </div>
            )}
            <p className="text-zinc-500 text-xs tracking-[0.4em] font-bold mb-3">NOW FEATURING</p>
            <h1 className="text-[10vw] sm:text-[8vw] font-black text-white leading-none tracking-tighter mb-4 transition-opacity duration-400"
              style={{ opacity: fading ? 0 : 1 }}>
              {featured.title.toUpperCase()}
            </h1>
            <p className="text-red-600 font-black text-3xl sm:text-5xl tracking-widest mb-10 transition-opacity duration-400"
              style={{ opacity: fading ? 0 : 1 }}>
              ${Number(featured.price ?? 0).toFixed(2)}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a href="#shop" className="inline-block bg-red-600 text-white font-black text-sm px-10 py-5 tracking-[0.2em] hover:bg-white hover:text-black transition-colors">
                SHOP ALL DROPS
              </a>
              <a href={`/product/${featured.id}`}
                className="inline-block border-2 border-white text-white font-black text-sm px-10 py-5 tracking-[0.2em] hover:bg-white hover:text-black transition-colors">
                BUY THIS NOW — ${Number(featured.price ?? 0).toFixed(2)}
              </a>
            </div>
          </div>
        </section>
      )}

      {/* ===== MARQUEE ===== */}
      <div className="w-full bg-red-600 py-4 overflow-hidden flex whitespace-nowrap border-y-4 border-white">
        <div className="animate-marquee inline-block font-black text-2xl md:text-4xl text-white tracking-widest">
          LIMITED DROP · SHIPS WORLDWIDE · EXCLUSIVE DESIGN · NEW ARRIVALS · LIMITED DROP · SHIPS WORLDWIDE · EXCLUSIVE DESIGN · NEW ARRIVALS ·&nbsp;
        </div>
      </div>

      {/* ===== PRODUCTS GRID ===== */}
      <section id="shop" className="py-24 bg-[#111] w-full px-6 sm:px-12">
        <div className="max-w-[1600px] mx-auto">
          <div className="mb-16 border-b-4 border-white pb-6 flex justify-between items-end">
            <h2 className="text-5xl md:text-7xl font-black text-white leading-none tracking-tighter">DROP 01</h2>
            <p className="text-red-600 font-bold tracking-widest text-xl hidden md:block">// ALL SALES FINAL</p>
          </div>

          {loading && (
            <p className="text-zinc-500 text-sm tracking-widest text-center py-20 animate-pulse">LOADING PRODUCTS...</p>
          )}

          {!loading && products.length === 0 && (
            <p className="text-zinc-500 text-sm tracking-widest text-center py-20">
              No products yet — <a href="/admin/login" className="text-red-600 hover:underline">add some in the admin panel</a>.
            </p>
          )}

          {products.filter((p) => p.type !== "affiliate").length > 0 && (
            <div className="mb-16">
              <p className="text-xs font-black tracking-[0.4em] text-zinc-500 mb-6">ORIGINAL DROPS</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {products.filter((p) => p.type !== "affiliate").map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          )}

          {products.filter((p) => p.type === "affiliate").length > 0 && (
            <div>
              <p className="text-xs font-black tracking-[0.4em] text-zinc-500 mb-6">ALSO COPPING — PARTNER PICKS</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {products.filter((p) => p.type === "affiliate").map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ===== BRAND SECTION ===== */}
      <section className="bg-black py-24 px-6 sm:px-12 border-t border-zinc-900">
        <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-red-600 text-[10px] tracking-[0.5em] font-black mb-4">THE BRAND</p>
            <h2 className="text-5xl md:text-7xl font-black text-white leading-none tracking-tighter mb-8">
              NO<br />RULES.<br />JUST<br />DROPS.
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed normal-case max-w-sm">
              PrimeOpp is not just a store — it's a mindset. We make bold streetwear for the ones who don't follow trends, they set them. Every drop is limited. Every piece is exclusive.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { num: "100%", label: "Original Designs" },
              { num: "LIMITED", label: "Every Drop" },
              { num: "24H", label: "Order Processing" },
              { num: "∞", label: "Exclusive Drops" },
            ].map((stat) => (
              <div key={stat.label} className="bg-zinc-950 border border-zinc-900 p-8 text-center">
                <p className="text-red-600 font-black text-4xl mb-2">{stat.num}</p>
                <p className="text-zinc-500 text-[10px] tracking-[0.3em] font-bold">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-black border-t border-zinc-900 py-16 px-6 sm:px-12">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-12">

            {/* Brand */}
            <div>
              <h4 className="font-black text-5xl text-white tracking-tighter hover:text-red-600 transition-colors cursor-default mb-3">PRIMEOPP</h4>
              <p className="text-zinc-600 text-xs normal-case tracking-widest max-w-xs">
                Premium streetwear drops for those who dare to stand out.
              </p>
            </div>

            {/* Links */}
            <div className="grid grid-cols-2 gap-x-16 gap-y-3">
              <div>
                <p className="text-[9px] font-black tracking-[0.4em] text-zinc-700 mb-3">SHOP</p>
                <a href="#shop" className="block text-xs text-zinc-500 tracking-widest hover:text-white transition-colors mb-2">Products</a>
                <a href="/cart" className="block text-xs text-zinc-500 tracking-widest hover:text-white transition-colors mb-2">Cart</a>
              </div>
              <div>
                <p className="text-[9px] font-black tracking-[0.4em] text-zinc-700 mb-3">LEGAL</p>
                <a href="/terms" className="block text-xs text-zinc-500 tracking-widest hover:text-white transition-colors mb-2">Terms of Service</a>
                <a href="/privacy" className="block text-xs text-zinc-500 tracking-widest hover:text-white transition-colors mb-2">Privacy Policy</a>
              </div>
              <div>
                <p className="text-[9px] font-black tracking-[0.4em] text-zinc-700 mb-3">CONTACT</p>
                <a href="mailto:support@primeopp.com" className="block text-xs text-zinc-500 tracking-widest hover:text-white transition-colors normal-case mb-2">support@primeopp.com</a>
              </div>
              <div>
                <p className="text-[9px] font-black tracking-[0.4em] text-zinc-700 mb-3">FOLLOW</p>
                <a href="https://instagram.com/primeopp" target="_blank" rel="noopener noreferrer" className="block text-xs text-zinc-500 tracking-widest hover:text-white transition-colors mb-2">Instagram</a>
                <a href="https://tiktok.com/@primeopp" target="_blank" rel="noopener noreferrer" className="block text-xs text-zinc-500 tracking-widest hover:text-white transition-colors mb-2">TikTok</a>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-zinc-900 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-zinc-700 text-[10px] tracking-widest normal-case">
              © {new Date().getFullYear()} PrimeOpp. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <span className="text-zinc-700 text-[10px] tracking-widest">🔒 SECURE CHECKOUT</span>
              <span className="text-zinc-700 text-[10px] tracking-widest">STRIPE VERIFIED</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

export default HomePage;
