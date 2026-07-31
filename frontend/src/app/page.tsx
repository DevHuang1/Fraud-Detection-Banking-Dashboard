"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/ui/Sidebar";
import Header from "@/components/ui/Header";
import KpiCards from "@/components/dashboard/KpiCards";
import FraudHealthCards from "@/components/dashboard/FraudHealthCards";
import TransactionTable from "@/components/transactions/TransactionTable";
import TransactionDrawer from "@/components/transactions/TransactionDrawer";
import AnalyticsWidgets from "@/components/analytics/AnalyticsWidgets";
import DetectionFlow from "@/components/flow/DetectionFlow";
import CaseManagement from "@/components/cases/CaseManagement";
import TransferView from "@/components/transfer/TransferView";
import BankingOverview from "@/components/dashboard/BankingOverview";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import RoleGate from "@/components/auth/RoleGate";
import { supabase, type Transaction } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

interface DashboardStats {
  totalTransactions: number;
  suspiciousTransactions: number;
  confirmedFraud: number;
  blockedAttempts: number;
  avgRiskScore: number;
  highRiskAccounts: number;
  fraudRate: number;
  unreadAlerts: number;
}

const emptyStats: DashboardStats = {
  totalTransactions: 0,
  suspiciousTransactions: 0,
  confirmedFraud: 0,
  blockedAttempts: 0,
  avgRiskScore: 0,
  highRiskAccounts: 0,
  fraudRate: 0,
  unreadAlerts: 0,
};

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState("overview");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [dataLoading, setDataLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const loadData = useCallback(async () => {
    setDataLoading(true);
    const [fetchedStats, fetchedTxs] = await Promise.all([
      supabase.getStats(),
      supabase.getTransactions(1000),
    ]);
    setStats(fetchedStats);
    setTransactions(fetchedTxs);
    setDataLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh on realtime insert
  useEffect(() => {
    const unsub = supabase.subscribeToChannel("transactions", "INSERT", () => {
      loadData();
    });
    return unsub;
  }, [loadData]);

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center cyber-grid" style={{ background: "#0a0e1a" }}>
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#3b82f6] via-[#00f0ff] to-[#8b5cf6] mx-auto flex items-center justify-center shadow-lg animate-float animate-gradient-shift" style={{ backgroundSize: '200% 200%' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><rect x="2" y="6" width="20" height="14" rx="2" /><path d="M12 2L2 6h20z" /><line x1="8" y1="12" x2="8" y2="16" /><line x1="12" y1="12" x2="12" y2="16" /><line x1="16" y1="12" x2="16" y2="16" /></svg>
          </div>
          <p className="text-[#64748b] text-sm font-mono">Initializing security protocols...</p>
          <div className="w-48 h-1 rounded-full bg-[#1e293b] mx-auto overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-[#3b82f6] to-[#00f0ff]" style={{ animation: 'loading-bar 2s ease-in-out infinite' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
    <div className="flex min-h-screen cyber-grid" style={{ background: "#0a0e1a" }}>
      <Sidebar active={activeSection} onNavigate={setActiveSection} collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className={`flex-1 min-h-screen flex flex-col transition-all duration-300 ${sidebarCollapsed ? "ml-[72px]" : "ml-64"}`}>
        <Header />

        <main className="flex-1 p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto w-full relative z-10">
          {activeSection === "overview" && user?.role === "user" ? (
            <BankingOverview onNavigate={setActiveSection} />
          ) : activeSection === "banking" ? (
            <TransferView />
          ) : activeSection === "flow" ? (
            <DetectionFlow transactions={transactions} />
          ) : (
            <>
              <div className="animate-fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-xl font-bold text-white">Fraud Intelligence</h1>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#00f0ff]/10 text-[#00f0ff] text-[10px] font-semibold font-mono border border-[#00f0ff]/20 neon-text-cyan">v2.0</span>
                    </div>
                    <p className="text-sm text-[#64748b] mt-0.5">Real-time surveillance · <span className="text-[#22ff8b] font-medium">All systems nominal</span></p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-xs text-[#64748b] px-3 py-1.5 rounded-lg bg-[#1e293b]/80 border border-[#334155] neon-border-cyan">
                      <span className="relative flex w-2 h-2">
                        <span className="absolute inset-0 rounded-full bg-[#22ff8b]" />
                        <span className="absolute inset-0 rounded-full bg-[#22ff8b] animate-ping opacity-50" />
                      </span>
                      <span className="font-mono">{stats.totalTransactions.toLocaleString()} txns</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <KpiCards stats={stats} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <FraudHealthCards />
              </div>

              <TransactionTable transactions={transactions} onSelect={setSelectedTx} />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <AnalyticsWidgets />
              </div>

              <CaseManagement />
            </>
          )}
        </main>
      </div>

      {selectedTx && <TransactionDrawer tx={selectedTx} onClose={() => setSelectedTx(null)} />}
    </div>
    </ProtectedRoute>
  );
}
