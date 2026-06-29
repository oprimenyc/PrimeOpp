import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { Seo } from "@/components/Seo";
import ProductCard from "@/components/ProductCard";
import { fetchProducts, type Product } from "@/lib/api";

function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts().then(setProducts).catch(() => setProducts([])).finally(() => setLoading(false));
  }, []);

  return { products, loading };
}

export function CollectionsPage() {
  const { products, loading } = useProducts();
  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))] as string[], [products]);

  return (
    <main className="min-h-screen bg-black text-white px-6 py-28">
      <Seo title="Collections" description="Browse PrimeOpp drops and partner picks by collection." canonicalPath="/collections" />
      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-black uppercase mb-10">Collections</h1>
        {loading ? <p className="text-zinc-500 tracking-widest">LOADING...</p> : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {["All Drops", "Original Drops", "Partner Picks", ...categories].map((name) => (
              <a key={name} href={name === "All Drops" ? "/search" : `/category/${encodeURIComponent(name.toLowerCase())}`} className="border border-zinc-800 bg-zinc-950 p-8 hover:border-red-600 transition-colors">
                <p className="text-red-600 text-[10px] font-black tracking-[0.35em] uppercase mb-2">Collection</p>
                <h2 className="text-2xl font-black uppercase">{name}</h2>
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export function CategoryPage() {
  const { category } = useParams<{ category: string }>();
  const { products, loading } = useProducts();
  const label = decodeURIComponent(category ?? "").replace(/-/g, " ");
  const filtered = products.filter((p) => {
    if (label === "original drops") return p.type === "pod";
    if (label === "partner picks") return p.type === "affiliate";
    return (p.category ?? "").toLowerCase() === label.toLowerCase();
  });

  return <ProductGridPage title={label || "Category"} description={`Browse ${label} products from PrimeOpp.`} products={filtered} loading={loading} />;
}

export function SearchPage() {
  const { products, loading } = useProducts();
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get("q") ?? "");
  const filtered = products.filter((p) => `${p.title} ${p.description ?? ""} ${p.category ?? ""}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <main className="min-h-screen bg-black text-white px-6 py-28">
      <Seo title="Search" description="Search PrimeOpp products." canonicalPath="/search" />
      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-black uppercase mb-6">Search</h1>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search drops..." className="w-full bg-zinc-950 border border-zinc-800 px-4 py-4 text-white mb-10 outline-none focus:border-red-600" />
        <ProductGrid products={filtered} loading={loading} empty="No products match your search." />
      </div>
    </main>
  );
}

function ProductGridPage({ title, description, products, loading }: { title: string; description: string; products: Product[]; loading: boolean }) {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-28">
      <Seo title={title} description={description} />
      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-black uppercase mb-10">{title}</h1>
        <ProductGrid products={products} loading={loading} empty="No products in this category yet." />
      </div>
    </main>
  );
}

function ProductGrid({ products, loading, empty }: { products: Product[]; loading: boolean; empty: string }) {
  if (loading) return <p className="text-zinc-500 tracking-widest">LOADING...</p>;
  if (products.length === 0) return <p className="text-zinc-500 normal-case">{empty}</p>;
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>;
}
