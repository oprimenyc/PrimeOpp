function Navbar() {
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
              href="#shop"
              className="flex items-center gap-2 text-white text-sm font-bold tracking-widest hover:text-red-600 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
              SHOP
            </a>
          </div>
        </div>
      </nav>
    </div>
  );
}

export default Navbar;