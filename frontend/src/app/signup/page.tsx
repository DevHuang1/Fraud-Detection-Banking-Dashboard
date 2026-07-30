"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

const roles = [
  { value: "user", label: "User", description: "Read-only dashboard view" },
  { value: "analyst", label: "Analyst", description: "View dashboards, read transactions & cases" },
  { value: "investigator", label: "Investigator", description: "Update cases, manage alerts, moderate transactions" },
  { value: "admin", label: "Admin", description: "Full access — manage users, rules, and system config" },
];

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState("analyst");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading || isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0e1a" }}>
        <div className="w-12 h-12 rounded-2xl accent-gradient mx-auto flex items-center justify-center shadow-lg animate-pulse">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="6" width="20" height="14" rx="2" /><path d="M12 2L2 6h20z" /><line x1="8" y1="12" x2="8" y2="16" /><line x1="12" y1="12" x2="12" y2="16" /><line x1="16" y1="12" x2="16" y2="16" /></svg>
        </div>
        <p className="text-[#64748b] text-sm">Redirecting...</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    setSuccess(false);

    const { error: signupErr } = await supabase.getClient().auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role: selectedRole } },
    });

    setSubmitting(false);

    if (signupErr) {
      setError(signupErr.message);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: "#0a0e1a" }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-emerald-500/10 blur-[100px]" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-blue-500/10 blur-[100px]" />
        </div>
        <div className="relative w-full max-w-md mx-4">
          <div className="glass rounded-3xl p-8 md:p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 mx-auto flex items-center justify-center mb-4 shadow-lg">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
            <p className="text-sm text-[#64748b] mb-6">We sent a confirmation link to <span className="text-white font-medium">{email}</span></p>
            <button onClick={() => router.push("/login")} className="h-11 px-6 rounded-xl accent-gradient text-white text-sm font-semibold shadow-lg">
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            <h1 className="text-2xl font-bold text-white">Create Account</h1>
            <p className="text-sm text-[#64748b] mt-1">Join the FraudShield platform</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full h-11 px-4 rounded-xl bg-[#1e293b] border border-[#334155] text-white text-sm outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-[#64748b]"
                placeholder="John Doe"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-4 rounded-xl bg-[#1e293b] border border-[#334155] text-white text-sm outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-[#64748b]"
                placeholder="analyst@bank.com"
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
                minLength={6}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Role</label>
              <div className="grid grid-cols-1 gap-2">
                {roles.map((r) => (
                  <label
                    key={r.value}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedRole === r.value
                        ? "bg-blue-500/10 border-blue-500/40"
                        : "bg-[#1e293b] border-[#334155] hover:border-[#475569]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r.value}
                      checked={selectedRole === r.value}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      className="mt-0.5 accent-blue-500"
                    />
                    <div>
                      <span className="block text-sm font-medium text-white">{r.label}</span>
                      <span className="block text-[11px] text-[#64748b]">{r.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-xl accent-gradient text-white text-sm font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all disabled:opacity-50"
            >
              {submitting ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[#1e293b] text-center space-y-2">
            <p className="text-xs text-[#64748b]">
              Already have an account?{" "}
              <button onClick={() => router.push("/login")} className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
