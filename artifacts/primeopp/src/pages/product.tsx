// Product detail page — /product/:id
// Includes size + color picker, Add to Cart, and direct Buy Now via Stripe

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useParams, useLocation } from "wouter";
import {
  fetchProduct,
  fetchProductRecommendations,
  fetchProductReviews,
  markReviewHelpful,
  submitProductReview,
  type Product,
  type ProductRecommendations,
  type ProductReview,
} from "@/lib/api";
import { addToCart, type CartItem } from "@/lib/cart";
import { Seo } from "@/components/Seo";
import ProductCard from "@/components/ProductCard";

function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedColor, setSelectedColor] = useState<number | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [reviewSort, setReviewSort] = useState("newest");
  const [reviewSearch, setReviewSearch] = useState("");
  const [recommendations, setRecommendations] = useState<ProductRecommendations | null>(null);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewForm, setReviewForm] = useState({
    customer_name: "",
    customer_email: "",
    rating: 5,
    title: "",
    body: "",
    photo_url: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const p = await fetchProduct(Number(id));
        if (p.type === "affiliate" && p.external_link) {
          window.open(p.external_link, "_blank");
          setLocation("/");
          return;
        }
        setProduct(p);
        const recent = getRecentProductIds();
        localStorage.setItem("primeopp_recent_products", JSON.stringify([p.id, ...recent.filter((item) => item !== p.id)].slice(0, 12)));
        // Auto-select if only one size
        if (Array.isArray(p.sizes) && p.sizes.length === 1) {
          setSelectedSize(p.sizes[0]);
        }
      } catch {
        setError("Product not found.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id, setLocation]);

  useEffect(() => {
    const productId = Number(id);
    if (!Number.isInteger(productId)) return;
    fetchProductReviews(productId, reviewSort, reviewSearch)
      .then((data) => {
        setReviews(data.reviews);
        setAverageRating(data.average_rating);
        setReviewCount(data.review_count);
      })
      .catch(() => {
        setReviews([]);
        setAverageRating(0);
        setReviewCount(0);
      });
  }, [id, reviewSort, reviewSearch]);

  useEffect(() => {
    const productId = Number(id);
    if (!Number.isInteger(productId)) return;
    fetchProductRecommendations(productId).then(setRecommendations).catch(() => setRecommendations(null));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-zinc-400 text-sm tracking-widest uppercase animate-pulse">Loading...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <p className="text-red-600 text-sm tracking-widest uppercase font-bold">{error || "Product not found"}</p>
        <a href="/" className="text-xs text-zinc-400 tracking-widest uppercase hover:text-white">← Back to store</a>
      </div>
    );
  }

  const colors = Array.isArray(product.colors) ? product.colors : [];
  const sizes = Array.isArray(product.sizes) ? product.sizes : [];
  const chosenColor = selectedColor !== null ? colors[selectedColor] : null;
  const basePrice = Number(product.price ?? 0);
  const displayPrice = chosenColor ? Number(chosenColor.price) : basePrice;
  const ratingForDisplay = averageRating || Number(product.average_rating ?? 0);
  const reviewCountForDisplay = reviewCount || Number(product.review_count ?? 0);

  const needsSize = sizes.length > 0 && !selectedSize;
  const needsColor = colors.length > 0 && selectedColor === null;
  const canAddToCart = !needsSize && !needsColor;

  function getButtonLabel() {
    if (needsSize && needsColor) return "SELECT SIZE & COLOR →";
    if (needsSize) return "SELECT SIZE →";
    if (needsColor) return "SELECT COLOR →";
    return "ADD TO CART";
  }

  function handleAddToCart() {
    if (!canAddToCart || !product) return;

    const item: CartItem = {
      product_id: product.id,
      title: product.title,
      thumbnail_url: product.thumbnail_url,
      price: Number(displayPrice),
      quantity,
      size: selectedSize,
      color: chosenColor?.name ?? "",
      pod_provider: product.pod_provider ?? "printful",
      printful_variant_id: product.printful_variant_id ?? null,
      tapstitch_variant_id: product.tapstitch_variant_id ?? null,
    };

    addToCart(item);
    // Notify Navbar to update cart count
    window.dispatchEvent(new Event("cart-updated"));
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2500);
  }

  function handleBuyNow() {
    if (!canAddToCart || !product) return;
    handleAddToCart();
    setLocation("/cart");
  }

  async function handleReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product) return;
    setReviewMessage("");
    try {
      await submitProductReview(product.id, {
        customer_name: reviewForm.customer_name,
        customer_email: reviewForm.customer_email,
        rating: reviewForm.rating,
        title: reviewForm.title,
        body: reviewForm.body,
        photo_url: reviewForm.photo_url || null,
      });
      setReviewMessage("Review submitted for moderation.");
      setReviewForm({ customer_name: "", customer_email: "", rating: 5, title: "", body: "", photo_url: "" });
    } catch {
      setReviewMessage("Review could not be submitted.");
    }
  }

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description ?? product.title,
    image: product.thumbnail_url ? [product.thumbnail_url] : undefined,
    sku: `primeopp-${product.id}`,
    brand: { "@type": "Brand", name: "PrimeOpp" },
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: displayPrice.toFixed(2),
      availability: product.stock_level === 0 ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      url: `${window.location.origin}/product/${product.id}`,
    },
    aggregateRating: reviewCountForDisplay > 0 ? {
      "@type": "AggregateRating",
      ratingValue: ratingForDisplay.toFixed(2),
      reviewCount: reviewCountForDisplay,
    } : undefined,
    review: reviews.slice(0, 5).map((review) => ({
      "@type": "Review",
      reviewRating: { "@type": "Rating", ratingValue: review.rating, bestRating: 5 },
      author: { "@type": "Person", name: review.customer_name },
      reviewBody: review.body,
      name: review.title,
    })),
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Seo
        title={product.title}
        description={product.description ?? `Shop ${product.title} from PrimeOpp.`}
        canonicalPath={`/product/${product.id}`}
        image={product.thumbnail_url}
        jsonLd={productJsonLd}
      />

      {/* Back nav */}
      <div className="border-b border-zinc-900 px-6 py-4 flex items-center justify-between">
        <a href="/" className="text-xs text-zinc-500 tracking-widest uppercase hover:text-white transition-colors">
          ← Back to shop
        </a>
        <a href="/cart" className="text-xs text-zinc-500 tracking-widest uppercase hover:text-white transition-colors">
          View Cart →
        </a>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-2 gap-12">

        {/* Product image */}
          <div className="aspect-square bg-zinc-950 overflow-hidden">
          {product.thumbnail_url ? (
            <img src={product.thumbnail_url} alt={product.title} loading="eager" decoding="async" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-800 text-6xl">👕</div>
          )}
        </div>

        {/* Product info */}
        <div className="flex flex-col gap-5">

          {/* Category + provider badge */}
          <div className="flex items-center gap-3">
            {product.category && (
              <span className="text-[10px] font-bold tracking-[0.4em] text-red-600 uppercase">{product.category}</span>
            )}
            <span className="text-[9px] font-bold tracking-[0.3em] text-zinc-600 uppercase border border-zinc-800 px-2 py-0.5">
              {product.pod_provider === "tapstitch" ? "TAPSTITCH" : "PRINTFUL"}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-4xl font-black tracking-wide uppercase leading-tight">{product.title}</h1>
          {reviewCountForDisplay > 0 && (
            <div className="flex items-center gap-3 text-xs tracking-widest uppercase">
              <span className="text-red-600 text-base">{renderStars(ratingForDisplay)}</span>
              <span className="text-zinc-400">{ratingForDisplay.toFixed(1)} average</span>
              <a href="#reviews" className="text-zinc-600 hover:text-white">{reviewCountForDisplay} reviews</a>
            </div>
          )}

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-black text-red-600">${displayPrice.toFixed(2)}</span>
            {chosenColor && Number(chosenColor.price) > basePrice && (
              <span className="text-xs text-zinc-500 tracking-widest uppercase">
                +${(Number(chosenColor.price) - basePrice).toFixed(2)} for {chosenColor.name}
              </span>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <p className="text-zinc-400 text-sm leading-relaxed normal-case">{product.description}</p>
          )}

          {/* Size picker */}
          {sizes.length > 0 && (
            <div>
              <p className="text-[10px] font-bold tracking-[0.4em] text-zinc-500 mb-3 uppercase">
                {selectedSize ? `Size: ${selectedSize}` : "Pick a size"}
              </p>
              <div className="flex gap-2 flex-wrap">
                {sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(selectedSize === size ? "" : size)}
                    className={`min-w-[44px] h-10 px-3 text-xs font-black tracking-widest uppercase border transition-colors ${
                      selectedSize === size
                        ? "bg-red-600 border-red-600 text-white"
                        : "bg-transparent border-zinc-700 text-zinc-400 hover:border-white hover:text-white"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Color picker */}
          {colors.length > 0 && (
            <div>
              <p className="text-[10px] font-bold tracking-[0.4em] text-zinc-500 mb-3 uppercase">
                {chosenColor ? `Color: ${chosenColor.name}` : "Pick a color"}
              </p>
              <div className="flex gap-3 flex-wrap">
                {colors.map((color, i) => (
                  <button
                    key={color.name}
                    onClick={() => setSelectedColor(selectedColor === i ? null : i)}
                    title={`${color.name} — $${color.price.toFixed(2)}`}
                    className="relative w-9 h-9 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: color.hex,
                      outline: selectedColor === i ? "2px solid #FF0000" : "2px solid #333",
                      outlineOffset: "2px",
                    }}
                  >
                    {selectedColor === i && (
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-black"
                        style={{ color: isLight(color.hex) ? "#000" : "#fff" }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div>
            <p className="text-[10px] font-bold tracking-[0.4em] text-zinc-500 mb-3 uppercase">Quantity</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-10 h-10 border border-zinc-700 text-zinc-400 hover:border-white hover:text-white text-lg font-black transition-colors"
              >−</button>
              <span className="text-white font-black text-lg w-8 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                className="w-10 h-10 border border-zinc-700 text-zinc-400 hover:border-white hover:text-white text-lg font-black transition-colors"
              >+</button>
            </div>
          </div>

          {/* Shipping info */}
          {product.shipping_info && (
            <p className="text-zinc-600 text-xs tracking-widest uppercase">{product.shipping_info}</p>
          )}

          {/* Stock */}
          {product.stock_level !== null && (
            <p className={`text-xs font-bold tracking-widest uppercase ${product.stock_level > 10 ? "text-green-500" : "text-red-500"}`}>
              {product.stock_level > 0 ? `${product.stock_level} in stock` : "Out of stock"}
            </p>
          )}

          {/* Buttons */}
          {product.stock_level !== 0 && (
            <div className="flex flex-col gap-3">
              {/* Add to Cart — primary action */}
              {addedToCart ? (
                <div className="bg-zinc-950 border-l-4 border-red-600 px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-white font-black tracking-widest text-sm uppercase">✓ Added to cart!</p>
                    <p className="text-zinc-400 text-xs normal-case mt-1">Ready to checkout</p>
                  </div>
                  <a href="/cart" className="text-red-600 text-xs font-black tracking-widest uppercase hover:text-white transition-colors">
                    View Cart →
                  </a>
                </div>
              ) : (
                <button
                  onClick={handleAddToCart}
                  disabled={!canAddToCart}
                  className="bg-red-600 text-white font-black text-sm py-5 tracking-[0.3em] uppercase hover:bg-white hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {getButtonLabel()}
                </button>
              )}

              {/* Buy Now — skip cart */}
              {canAddToCart && (
                <button
                  onClick={handleBuyNow}
                  className="border border-zinc-700 text-white font-black text-sm py-4 tracking-[0.3em] uppercase hover:border-white transition-colors"
                >
                  BUY NOW — ${displayPrice.toFixed(2)}
                </button>
              )}
            </div>
          )}

          {product.stock_level === 0 && (
            <button disabled className="bg-zinc-900 text-zinc-600 font-black text-sm py-5 tracking-[0.3em] uppercase cursor-not-allowed">
              OUT OF STOCK
            </button>
          )}
        </div>
      </div>
      <section className="border-t border-zinc-900 px-6 py-16">
        <div className="max-w-5xl mx-auto space-y-14">
          {recommendations?.frequently_bought_together?.length ? (
            <RecommendationSection title="Frequently Bought Together" products={recommendations.frequently_bought_together} />
          ) : null}
          {recommendations?.complete_the_look?.length ? (
            <RecommendationSection title="Complete the Look" products={recommendations.complete_the_look} />
          ) : null}
          {recommendations?.customers_also_bought?.length ? (
            <RecommendationSection title="Customers Also Bought" products={recommendations.customers_also_bought} />
          ) : null}
          {recommendations?.related_products?.length ? (
            <RecommendationSection title="Related Products" products={recommendations.related_products} />
          ) : null}
        </div>
      </section>

      <section id="reviews" className="border-t border-zinc-900 px-6 py-16">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
              <div>
                <p className="text-red-600 text-[10px] tracking-[0.45em] font-black uppercase">Reviews</p>
                <h2 className="text-3xl font-black uppercase mt-2">{ratingForDisplay.toFixed(1)} Average Rating</h2>
              </div>
              <div className="flex gap-2">
                <input value={reviewSearch} onChange={(e) => setReviewSearch(e.target.value)} placeholder="Search reviews" className="bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white outline-none focus:border-red-600" />
                <select value={reviewSort} onChange={(e) => setReviewSort(e.target.value)} className="bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white outline-none focus:border-red-600">
                  <option value="newest">Newest</option>
                  <option value="helpful">Most Helpful</option>
                  <option value="rating_high">Highest Rating</option>
                  <option value="rating_low">Lowest Rating</option>
                </select>
              </div>
            </div>
            <div className="space-y-4">
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
              {reviews.length === 0 && (
                <p className="text-zinc-500 text-sm normal-case border border-zinc-900 p-6">No approved reviews match this search yet.</p>
              )}
            </div>
          </div>

          <form onSubmit={(event) => void handleReviewSubmit(event)} className="border border-zinc-900 bg-zinc-950 p-5 h-fit">
            <p className="text-[10px] tracking-[0.35em] text-zinc-500 font-black uppercase mb-4">Write a Review</p>
            <div className="grid gap-3">
              <input required value={reviewForm.customer_name} onChange={(e) => setReviewForm((form) => ({ ...form, customer_name: e.target.value }))} placeholder="Name" className="bg-black border border-zinc-800 px-3 py-3 text-sm outline-none focus:border-red-600" />
              <input required type="email" value={reviewForm.customer_email} onChange={(e) => setReviewForm((form) => ({ ...form, customer_email: e.target.value }))} placeholder="Email used at checkout" className="bg-black border border-zinc-800 px-3 py-3 text-sm outline-none focus:border-red-600" />
              <select value={reviewForm.rating} onChange={(e) => setReviewForm((form) => ({ ...form, rating: Number(e.target.value) }))} className="bg-black border border-zinc-800 px-3 py-3 text-sm outline-none focus:border-red-600">
                {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} stars</option>)}
              </select>
              <input required value={reviewForm.title} onChange={(e) => setReviewForm((form) => ({ ...form, title: e.target.value }))} placeholder="Review title" className="bg-black border border-zinc-800 px-3 py-3 text-sm outline-none focus:border-red-600" />
              <textarea required value={reviewForm.body} onChange={(e) => setReviewForm((form) => ({ ...form, body: e.target.value }))} placeholder="Fit, quality, shipping, vibe..." rows={5} className="bg-black border border-zinc-800 px-3 py-3 text-sm outline-none focus:border-red-600 normal-case" />
              <input value={reviewForm.photo_url} onChange={(e) => setReviewForm((form) => ({ ...form, photo_url: e.target.value }))} placeholder="Photo URL (optional)" className="bg-black border border-zinc-800 px-3 py-3 text-sm outline-none focus:border-red-600" />
              <button className="bg-red-600 text-white font-black text-xs py-4 tracking-[0.25em] uppercase hover:bg-white hover:text-black transition-colors">Submit for Moderation</button>
              {reviewMessage && <p className="text-zinc-500 text-xs normal-case">{reviewMessage}</p>}
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

function RecommendationSection({ title, products }: { title: string; products: Product[] }) {
  return (
    <div>
      <h2 className="text-xl font-black tracking-[0.25em] uppercase mb-5">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {products.map((product) => <ProductCard key={`${title}-${product.id}`} product={product} />)}
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: ProductReview }) {
  const [helpful, setHelpful] = useState(review.helpful_count);
  return (
    <article className="border border-zinc-900 bg-zinc-950 p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="text-red-600 text-sm">{renderStars(review.rating)}</p>
          <h3 className="font-black uppercase mt-1">{review.title}</h3>
          <p className="text-zinc-600 text-[10px] tracking-widest uppercase mt-1">
            {review.customer_name} {review.is_verified_purchase ? "· Verified Purchase" : ""}
          </p>
        </div>
        <time className="text-zinc-700 text-[10px] whitespace-nowrap">{new Date(review.created_at).toLocaleDateString()}</time>
      </div>
      <p className="text-zinc-400 text-sm normal-case leading-relaxed">{review.body}</p>
      {review.photo_url && <img src={review.photo_url} alt={`${review.customer_name} review`} loading="lazy" decoding="async" className="mt-4 h-28 w-28 object-cover border border-zinc-800" />}
      <button
        onClick={() => {
          markReviewHelpful(review.id).then((data) => setHelpful(data.helpful_count)).catch(() => undefined);
        }}
        className="mt-4 text-[10px] tracking-widest uppercase text-zinc-500 hover:text-white"
      >
        Helpful ({helpful})
      </button>
    </article>
  );
}

function renderStars(value: number): string {
  const rounded = Math.max(0, Math.min(5, Math.round(value)));
  return `${"★".repeat(rounded)}${"☆".repeat(5 - rounded)}`;
}

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

function getRecentProductIds(): number[] {
  try {
    const parsed = JSON.parse(localStorage.getItem("primeopp_recent_products") ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is number => Number.isInteger(item)) : [];
  } catch {
    return [];
  }
}

export default ProductPage;
