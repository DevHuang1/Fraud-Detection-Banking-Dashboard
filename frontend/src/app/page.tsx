"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import RoleGate from "@/components/auth/RoleGate";
import BankingOverview from "@/components/dashboard/BankingOverview";
import TransactionHistory from "@/components/dashboard/TransactionHistory";
import TransferView from "@/components/transfer/TransferView";
import { useAuth } from "@/context/AuthContext";
import { ROLE_COLOR, ROLE_LABEL, homePathForRole } from "@/lib/roles";

export default function CustomerPortal() {
  const [view, setView] = useState<"overview" | "transfer" | "history">("overview");
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user?.role && user.role !== "user") {
      router.push(homePathForRole(user.role));
    }
  }, [loading, user?.role, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center cyber-grid" style={{ background: "#0a0e1a" }}>
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#3b82f6] via-[#00f0ff] to-[#8b5cf6] mx-auto flex items-center justify-center shadow-lg animate-float animate-gradient-shift" style={{ backgroundSize: '200% 200%' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><rect x="2" y="6" width="20" height="14" rx="2" /><path d="M12 2L2 6h20z" /><line x1="8" y1="12" x2="8" y2="16" /><line x1="12" y1="12" x2="12" y2="16" /><line x1="16" y1="12" x2="16" y2="16" /></svg>
          </div>
          <p className="text-[#64748b] text-sm font-mono">Opening your banking portal...</p>
        </div>
      </div>
    );
  }

  const roleColors = user?.role ? ROLE_COLOR[user.role] || ROLE_COLOR.user : ROLE_COLOR.user;

  return (
    <ProtectedRoute>
      <RoleGate roles="user" fallback={null}>
        <div className="min-h-screen cyber-grid" style={{ background: "#0a0e1a" }}>
          <header
            className="sticky top-0 z-40 h-16 flex items-center justify-between px-6 lg:px-8"
            style={{
              background: "rgba(10,14,26,0.85)",
              backdropFilter: "blur(20px)",
              borderBottom: "1px solid rgba(51,65,85,0.2)",
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#3b82f6] via-[#00f0ff] to-[#8b5cf6] flex items-center justify-center shadow-lg">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="6" width="20" height="14" rx="2" /><path d="M12 2L2 6h20z" /><line x1="8" y1="12" x2="8" y2="16" /><line x1="12" y1="12" x2="12" y2="16" /><line x1="16" y1="12" x2="16" y2="16" /></svg>
              </div>
              <div>
                <span className="text-[15px] font-bold text-white tracking-tight block leading-tight">FraudShield</span>
                <span className="text-[10px] text-[#00f0ff]/60 tracking-widest uppercase block font-mono">Online Banking</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1e293b]/50 border border-[#334155]">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: roleColors.dot }} />
                <span className="text-xs font-medium" style={{ color: roleColors.text }}>{user?.role ? ROLE_LABEL[user.role] : "User"}</span>
              </div>
              <button
                onClick={() => { logout(); router.push("/login"); }}
                className="h-9 px-3 rounded-xl text-[#64748b] hover:text-red-400 hover:bg-red-500/10 transition-all text-xs font-medium"
              >
                Log out
              </button>
            </div>
          </header>

          <main className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto w-full">
            <div className="flex items-center gap-2">
              {[
                { key: "overview" as const, label: "Overview" },
                { key: "history" as const, label: "Transactions" },
                { key: "transfer" as const, label: "Send Money" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setView(tab.key)}
                  className={`h-10 px-5 rounded-xl text-sm font-semibold transition-all ${
                    view === tab.key
                      ? "bg-gradient-to-r from-[#3b82f6] to-[#00f0ff] text-white shadow-lg shadow-blue-500/20"
                      : "bg-[#1e293b] border border-[#334155] text-[#94a3b8] hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {view === "overview" ? (
              <BankingOverview onNavigate={() => setView("transfer")} />
            ) : view === "history" ? (
              <TransactionHistory />
            ) : (
              <TransferView />
            )}
          </main>
        </div>
      </RoleGate>
    </ProtectedRoute>
  );
}
