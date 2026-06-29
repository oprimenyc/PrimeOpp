import { useState, useEffect } from "react";
import { cartCount, getCart } from "@/lib/cart";

function Navbar() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(cartCount(getCart()));
    const update = () => setCount(cartCount(getCart()));
    window.addEventListener("cart-updated", update);
    return () => window.removeEventListener("cart-updated", update);
  }, []);

  return (
    <div className="fixed w-full z-50 flex flex-col uppercase font-sans">
      {/* Announcement Banner */}
      <div className="bg-white text-black text-xs font-bold py-2 w-full flex items-center justify-center gap-3 tracking-widest border-b-2 border-black">
        <div className="w-2 h-2 rounded-full bg-red-600 animate-blink"></div>
        NEW DROP — LIMITED UNITS
      </div>

      {/* Main Navbar */}
      <nav className="w-full bg-black border-b border-zinc-800 py-3">
        <div className="w-full px-6 flex items-center justify-between">
          <a href="/" className="text-white text-4xl font-serif font-bold tracking-tighter hover:text-red-600 transition-colors">
            PRIMEOPP
          </a>

          <div className="flex items-center gap-6">
            <a
              href="/collections"
              className="flex items-center gap-2 text-white text-sm font-bold tracking-widest hover:text-red-600 transition-colors"
            >
              SHOP
            </a>
            <a
              href="/search"
              className="hidden sm:flex items-center gap-2 text-white text-sm font-bold tracking-widest hover:text-red-600 transition-colors"
            >
              SEARCH
            </a>

            {/* Cart icon with badge */}
            <a
              href="/cart"
              className="relative flex items-center gap-1 text-white hover:text-red-600 transition-colors"
              aria-label="Cart"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
              {count > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full">
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </a>
          </div>
        </div>
      </nav>
    </div>
  );
}

export default Navbar;
