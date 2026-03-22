// Admin Login page — /admin/login
// Simple username + password form to access the admin panel.
// Credentials: admin / primeopp2025

import { useState } from "react";
import { useLocation } from "wouter";
import { adminLogin, isLoggedIn } from "@/lib/api";

function AdminLogin() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect straight to admin
  if (isLoggedIn()) {
    setLocation("/admin");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await adminLogin(username, password);
      setLocation("/admin"); // Go to admin panel on success
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black tracking-widest text-white uppercase">PRIMEOPP</h1>
          <p className="text-red-600 text-xs tracking-[0.4em] font-bold mt-1 uppercase">Admin Access</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Error message */}
          {error && (
            <div className="border-l-4 border-red-600 bg-zinc-950 px-4 py-3 text-sm text-red-400 font-bold">
              {error}
            </div>
          )}

          {/* Username */}
          <div>
            <label className="block text-[10px] font-bold tracking-[0.4em] text-zinc-500 mb-2 uppercase">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none px-4 py-3 text-white text-sm"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-[10px] font-bold tracking-[0.4em] text-zinc-500 mb-2 uppercase">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-600 outline-none px-4 py-3 text-white text-sm"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 text-white font-black text-xs py-4 tracking-[0.3em] uppercase hover:bg-white hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? "LOGGING IN..." : "LOGIN →"}
          </button>
        </form>

        {/* Back to store */}
        <p className="text-center mt-8">
          <a href="/" className="text-zinc-600 text-xs tracking-widest hover:text-white transition-colors uppercase">
            ← Back to store
          </a>
        </p>
      </div>
    </div>
  );
}

export default AdminLogin;
