import { useState, useEffect } from "react";

function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="fixed w-full z-50 flex flex-col">
      {/* Top Announcement Banner */}
      <div className="bg-black text-white text-[10px] sm:text-xs font-sans tracking-[0.2em] text-center py-2.5 uppercase w-full">
        Free Shipping On All Orders · Limited Edition Drop
      </div>
      
      {/* Main Navbar */}
      <nav 
        className={`w-full transition-all duration-500 border-b border-white/10 ${
          scrolled 
            ? 'bg-black/80 backdrop-blur-md py-4 shadow-lg' 
            : 'bg-black/40 backdrop-blur-sm py-6'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <a href="/" className="text-white text-2xl sm:text-3xl font-serif tracking-widest uppercase hover:text-gray-300 transition-colors">
            PrimeOpp
          </a>

          <div className="flex items-center gap-8">
            <a
              href="#shop"
              className="text-white text-xs font-sans font-medium tracking-[0.15em] uppercase hover:text-gray-300 transition-colors relative group"
            >
              Collection
              <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-white transition-all duration-300 group-hover:w-full"></span>
            </a>
            <a
              href="#about"
              className="text-white text-xs font-sans font-medium tracking-[0.15em] uppercase hover:text-gray-300 transition-colors relative group hidden sm:block"
            >
              Philosophy
              <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-white transition-all duration-300 group-hover:w-full"></span>
            </a>
          </div>
        </div>
      </nav>
    </div>
  );
}

export default Navbar;