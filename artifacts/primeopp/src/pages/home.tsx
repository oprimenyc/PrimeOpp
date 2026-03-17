import { products } from "@/data/products";
import ProductCard from "@/components/ProductCard";

function HomePage() {
  return (
    <main className="min-h-screen bg-black selection:bg-red-600 selection:text-white font-sans uppercase">
      
      {/* ===== HERO SECTION ===== */}
      <section className="relative h-screen w-full flex items-center justify-center overflow-hidden bg-black pt-20">
        <div className="relative z-10 w-full px-6 flex flex-col items-center justify-center text-center">
          <h1 className="text-[12vw] font-serif font-black text-white leading-[0.85] tracking-tighter mb-4">
            NO BASICS.<br/>ONLY FIRE.
          </h1>
          <p className="text-red-600 font-bold text-xl md:text-3xl tracking-widest mb-12">
            DISRUPT THE NORM.
          </p>
          <a
            href="#shop"
            className="inline-block bg-red-600 text-white font-bold text-xl px-12 py-5 tracking-[0.2em] hover:bg-white hover:text-black transition-colors"
          >
            SHOP COLLECTION
          </a>
        </div>
      </section>

      {/* ===== MARQUEE SECTION ===== */}
      <div className="w-full bg-red-600 py-4 overflow-hidden flex whitespace-nowrap border-y-4 border-white">
        <div className="animate-marquee inline-block font-sans font-black text-2xl md:text-4xl text-white tracking-widest">
          FREE SHIPPING · LIMITED DROP · SOLD OUT SOON · ORDER NOW · FREE SHIPPING · LIMITED DROP · SOLD OUT SOON · ORDER NOW · FREE SHIPPING · LIMITED DROP · SOLD OUT SOON · ORDER NOW ·
        </div>
      </div>

      {/* ===== PRODUCTS SECTION ===== */}
      <section id="shop" className="py-32 bg-[#111] w-full px-6 sm:px-12">
        <div className="max-w-[1600px] mx-auto">
          <div className="mb-16 border-b-4 border-white pb-6 flex justify-between items-end">
            <h2 className="text-6xl md:text-8xl font-serif font-black text-white leading-none tracking-tighter">
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
      
      {/* ===== SOCIAL PROOF SECTION ===== */}
      <section className="bg-black text-white py-32 border-y border-zinc-800">
        <div className="max-w-[1600px] mx-auto px-6 flex flex-col md:flex-row items-center justify-center text-center md:text-left gap-8">
          <h2 className="font-serif font-black text-[15vw] md:text-[10vw] leading-none tracking-tighter text-white">
            500+
          </h2>
          <div className="flex flex-col gap-2">
            <h3 className="font-sans font-black text-3xl md:text-5xl tracking-widest text-red-600">
              SATISFIED
            </h3>
            <h3 className="font-sans font-black text-3xl md:text-5xl tracking-widest text-white">
              CUSTOMERS
            </h3>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-black py-20 px-6 sm:px-12">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="text-center md:text-left">
            <h4 className="font-serif font-black text-6xl md:text-8xl text-white tracking-tighter hover:text-red-600 transition-colors cursor-pointer">
              PRIMEOPP
            </h4>
          </div>
          
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