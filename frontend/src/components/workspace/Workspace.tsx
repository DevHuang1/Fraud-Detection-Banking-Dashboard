"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Sidebar from "@/components/ui/Sidebar";
import Header from "@/components/ui/Header";
import KpiCards from "@/components/dashboard/KpiCards";
import FraudHealthCards from "@/components/dashboard/FraudHealthCards";
import TransactionTable from "@/components/transactions/TransactionTable";
import TransactionDrawer from "@/components/transactions/TransactionDrawer";
import AnalyticsWidgets from "@/components/analytics/AnalyticsWidgets";
import RecentTransactions from "@/components/RecentTransactions";
import DetectionFlow from "@/components/flow/DetectionFlow";
import CaseManagement from "@/components/cases/CaseManagement";
import FraudRules from "@/components/FraudRules";
import TeamManagement from "@/components/team/TeamManagement";
import ReportsView from "@/components/reports/ReportsView";
import AnalystTools from "@/components/tools/AnalystTools";
import InvestigatorTools from "@/components/tools/InvestigatorTools";
import AdminTools from "@/components/tools/AdminTools";
import AiAgent from "@/components/tools/AiAgent";
import AgentCursor from "@/components/agent/AgentCursor";
import { AgentProvider } from "@/context/AgentContext";
import { useAuth, type UserRole } from "@/context/AuthContext";
import { supabase, type Transaction } from "@/lib/supabase";
import { ALLOWED_WORKSPACE_ROLES, ROLE_COLOR, WORKSPACE_NAV, displayRoleLabel } from "@/lib/roles";

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

const workspaceMeta: Record<string, { title: string; subtitle: string }> = {
  analyst: {
    title: "Fraud Intelligence · Analyst",
    subtitle: "Real-time transaction monitoring and alert triage",
  },
  investigator: {
    title: "Investigation Console · Investigator",
    subtitle: "Case management, rules tuning and deep investigation",
  },
  admin: {
    title: "Administration Console · Admin",
    subtitle: "Full oversight, rules, cases and team management",
  },
};

function AccessDenied({ workspace }: { workspace: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center cyber-grid" style={{ background: "#0a0e1a" }}>
      <div className="text-center space-y-4 px-6">
        <div className="w-14 h-14 rounded-2xl bg-[#1e293b] border border-[#334155] mx-auto flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <circle cx="12" cy="16" r="0.5" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Access Denied</h2>
          <p className="text-sm text-[#64748b] mt-1">Your account is not authorized for the {workspace} workspace.</p>
        </div>
        <Link href="/" className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[#1e293b] border border-[#334155] text-white text-sm font-medium hover:border-[#00f0ff]/30 transition-all">
          Go to My Home
        </Link>
      </div>
    </div>
  );
}

export default function Workspace({ role }: { role: UserRole }) {
  const { user, loading } = useAuth();
  const [activeSection, setActiveSection] = useState("overview");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [dataLoading, setDataLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const loadData = useCallback(async () => {
    const [fetchedStats, fetchedTxs] = await Promise.all([
      supabase.getStats(),
      supabase.getTransactions(1000),
    ]);
    setStats(fetchedStats);
    setTransactions(fetchedTxs);
    setDataLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const [fetchedStats, fetchedTxs] = await Promise.all([
        supabase.getStats(),
        supabase.getTransactions(1000),
      ]);
      if (!active) return;
      setStats(fetchedStats);
      setTransactions(fetchedTxs);
      setDataLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const unsub = supabase.subscribeToChannel("transactions", "INSERT", () => {
      loadData();
    });
    return unsub;
  }, [loadData]);

  if (loading) {
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

  if (!user || !user.role || !ALLOWED_WORKSPACE_ROLES[role].includes(user.role)) {
    return <AccessDenied workspace={role} />;
  }

  const meta = workspaceMeta[role];
  const roleColors = ROLE_COLOR[user.role] || ROLE_COLOR.user;
  const nav = WORKSPACE_NAV[role];
  const isAdmin = user.role === "admin";

  return (
    <AgentProvider>
      <div className="flex min-h-screen cyber-grid" style={{ background: "#0a0e1a" }}>
        <Sidebar
          active={activeSection}
          onNavigate={setActiveSection}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)}
          sections={nav}
        />

        <div className={`flex-1 min-h-screen flex flex-col transition-all duration-300 ${sidebarCollapsed ? "ml-[72px]" : "ml-64"}`}>
          <Header
            onSelectTransaction={(tx) => {
              setActiveSection("transactions");
              setSelectedTx(tx);
            }}
            onOpenTab={setActiveSection}
          />

          <main className="flex-1 p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto w-full relative z-10">
          <div className="animate-fade-in">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-white">{meta.title}</h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold font-mono border flex items-center gap-1.5" style={{ color: roleColors.text, background: `${roleColors.dot}12`, borderColor: `${roleColors.dot}25` }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: roleColors.dot }} />
                    {displayRoleLabel(user.is_ceo, user.role)}
                  </span>
                </div>
                <p className="text-sm text-[#64748b] mt-0.5">{meta.subtitle}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs text-[#64748b] px-3 py-1.5 rounded-lg bg-[#1e293b]/80 border border-[#334155]">
                  <span className="relative flex w-2 h-2">
                    <span className="absolute inset-0 rounded-full bg-[#22ff8b]" />
                    <span className="absolute inset-0 rounded-full bg-[#22ff8b] animate-ping opacity-50" />
                  </span>
                  <span className="font-mono">{dataLoading ? "loading" : `${stats.totalTransactions.toLocaleString()} txns`}</span>
                </span>
              </div>
            </div>
          </div>

          {activeSection === "overview" && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <KpiCards stats={stats} role={user.role} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <FraudHealthCards />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 grid-flow-dense">
                <AnalyticsWidgets variant="summary" role={user.role} />
              </div>
              <RecentTransactions onSelect={setSelectedTx} />
            </>
          )}

          {activeSection === "transactions" && (
            <TransactionTable transactions={transactions} onSelect={setSelectedTx} />
          )}

          {activeSection === "cases" && <CaseManagement canAdjudicate={user.role === "investigator" || user.role === "admin"} />}

          {activeSection === "analytics" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <AnalyticsWidgets role={user.role} />
            </div>
          )}

          {activeSection === "flow" && <DetectionFlow transactions={transactions} />}

          {activeSection === "rules" && user.role !== "analyst" && <FraudRules />}

          {activeSection === "reports" && <ReportsView />}

          {activeSection === "team" && isAdmin && <TeamManagement />}

          {activeSection === "tools" && (
            <>
              <AiAgent />
              {user.role === "analyst" && <AnalystTools />}
              {user.role === "investigator" && <InvestigatorTools />}
              {user.role === "admin" && <AdminTools />}
            </>
          )}
        </main>
      </div>

      {selectedTx && <TransactionDrawer tx={selectedTx} onClose={() => setSelectedTx(null)} onUpdated={loadData} canModerate={user.role === "investigator" || user.role === "admin"} canTriage={user.role === "analyst"} />}
      </div>

      <AgentCursor />
    </AgentProvider>
  );
}
