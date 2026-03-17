// This is the Navbar component — it shows at the top of every page
// It has the brand name on the left and a "Shop" link on the right

function Navbar() {
  return (
    // The navbar bar — black background, white text
    <nav className="bg-black text-white px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-lg">
      
      {/* Brand name on the left */}
      <a href="/" className="text-2xl font-bold tracking-tight hover:opacity-80 transition-opacity">
        PrimeOpp
      </a>

      {/* Navigation links on the right */}
      <div className="flex items-center gap-6">
        <a
          href="#shop"
          className="text-sm font-medium tracking-wide hover:opacity-70 transition-opacity uppercase"
        >
          Shop
        </a>
      </div>
    </nav>
  );
}

export default Navbar;
