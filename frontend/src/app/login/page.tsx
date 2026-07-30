"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading || isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0e1a" }}>
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl accent-gradient mx-auto flex items-center justify-center shadow-lg animate-pulse">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="6" width="20" height="14" rx="2" /><path d="M12 2L2 6h20z" /><line x1="8" y1="12" x2="8" y2="16" /><line x1="12" y1="12" x2="12" y2="16" /><line x1="16" y1="12" x2="16" y2="16" /></svg>
          </div>
          <p className="text-[#64748b] text-sm">Redirecting...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: "#0a0e1a" }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-500/10 blur-[100px]" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-purple-500/10 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-cyan-500/5 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md mx-4">
        <div className="glass rounded-3xl p-8 md:p-10" style={{ border: "1px solid rgba(59,130,246,0.15)", boxShadow: "0 0 60px rgba(59,130,246,0.08)" }}>
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl accent-gradient mx-auto flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="6" width="20" height="14" rx="2" /><path d="M12 2L2 6h20z" /><line x1="8" y1="12" x2="8" y2="16" /><line x1="12" y1="12" x2="12" y2="16" /><line x1="16" y1="12" x2="16" y2="16" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">FraudShield</h1>
            <p className="text-sm text-[#64748b] mt-1">Banking Fraud Intelligence Platform</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-4 rounded-xl bg-[#1e293b] border border-[#334155] text-white text-sm outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-[#64748b]"
                placeholder="admin@bank.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 px-4 rounded-xl bg-[#1e293b] border border-[#334155] text-white text-sm outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-[#64748b]"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-xl accent-gradient text-white text-sm font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all disabled:opacity-50"
            >
              {submitting ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[#1e293b] text-center space-y-2">
            <p className="text-xs text-[#64748b]">
              Don&apos;t have an account?{" "}
              <button onClick={() => router.push("/signup")} className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                Sign up
              </button>
            </p>
            <div className="space-y-1.5">
              <p className="text-[10px] text-[#4a5568] font-mono uppercase tracking-wider">Available Roles</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  { role: "User", color: "text-[#64748b]" },
                  { role: "Analyst", color: "text-blue-400" },
                  { role: "Investigator", color: "text-purple-400" },
                  { role: "Admin", color: "text-amber-400" },
                ].map((r) => (
                  <span key={r.role} className={`text-[10px] font-mono ${r.color} px-1.5 py-0.5 rounded bg-white/[0.02] border border-white/[0.05]`}>
                    {r.role}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
