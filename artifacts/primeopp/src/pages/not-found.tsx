export default function NotFound() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      <p className="text-red-600 text-[10px] tracking-[0.5em] font-black uppercase mb-4">Error</p>
      <h1 className="text-[20vw] font-black leading-none tracking-tighter text-white">404</h1>
      <p className="text-zinc-500 text-sm tracking-widest uppercase mt-4 mb-10">Page not found</p>
      <a
        href="/"
        className="bg-red-600 text-white font-black text-xs px-10 py-4 tracking-[0.3em] uppercase hover:bg-white hover:text-black transition-colors"
      >
        Back to Store
      </a>
    </div>
  );
}
