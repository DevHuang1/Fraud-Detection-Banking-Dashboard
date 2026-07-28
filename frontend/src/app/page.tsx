"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/ui/Sidebar";
import Header from "@/components/ui/Header";
import KpiCards from "@/components/dashboard/KpiCards";
import FraudHealthCards from "@/components/dashboard/FraudHealthCards";
import TransactionTable from "@/components/transactions/TransactionTable";
import TransactionDrawer from "@/components/transactions/TransactionDrawer";
import AnalyticsWidgets from "@/components/analytics/AnalyticsWidgets";
import CaseManagement from "@/components/cases/CaseManagement";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import RoleGate from "@/components/auth/RoleGate";
import { supabase, type Transaction } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

const defaultStats = {
  totalTransactions: 284392,
  suspiciousTransactions: 1847,
  confirmedFraud: 523,
  blockedAttempts: 892,
  avgRiskScore: 37.5,
  highRiskAccounts: 89,
  fraudRate: 1.8,
  unreadAlerts: 12,
};

const mockTransactions: Transaction[] = [
  { id: 1, transaction_id: "TXN-8294", account_id: "ACC-4829", account_name: "James Wilson", card_last_four: "4829", amount: 12450, currency: "USD", merchant: "CryptoExchange.io", merchant_category: "crypto", region: "International", city: "N/A", country: "Unknown", transaction_type: "transfer", channel: "online", timestamp: new Date().toISOString(), status: "blocked", risk_score: 94, risk_level: "critical", is_fraud: true, is_suspicious: true, ml_fraud_probability: 0.97, rule_triggers: [{ rule: "High-Value Threshold Exceeded", severity: "critical" }, { rule: "New Device Detection", severity: "high" }], device_id: "DEV-A7X92", ip_address: "185.234.72.1", user_agent: "Mozilla/5.0", latitude: 48.8566, longitude: 2.3522 },
  { id: 2, transaction_id: "TXN-8293", account_id: "ACC-1736", account_name: "Sarah Chen", card_last_four: "1736", amount: 340, currency: "USD", merchant: "Amazon.com", merchant_category: "retail", region: "US East", city: "New York", country: "US", transaction_type: "purchase", channel: "online", timestamp: new Date().toISOString(), status: "approved", risk_score: 8, risk_level: "low", is_fraud: false, is_suspicious: false, ml_fraud_probability: 0.02, rule_triggers: [], device_id: "DEV-B3M56", ip_address: "74.125.227.1", user_agent: "Mozilla/5.0", latitude: 40.7128, longitude: -74.006 },
  { id: 3, transaction_id: "TXN-8292", account_id: "ACC-6591", account_name: "Michael Torres", card_last_four: "6591", amount: 8920, currency: "USD", merchant: "Western Union", merchant_category: "money_transfer", region: "US West", city: "Los Angeles", country: "US", transaction_type: "transfer", channel: "pos", timestamp: new Date(Date.now() - 600000).toISOString(), status: "flagged", risk_score: 78, risk_level: "high", is_fraud: false, is_suspicious: true, ml_fraud_probability: 0.72, rule_triggers: [{ rule: "Velocity Spike", severity: "critical" }, { rule: "Rapid Cash-Out Pattern", severity: "high" }], device_id: "DEV-C9K81", ip_address: "192.168.1.1", user_agent: "Mozilla/5.0", latitude: 34.0522, longitude: -118.2437 },
  { id: 4, transaction_id: "TXN-8291", account_id: "ACC-3347", account_name: "Emily Davis", card_last_four: "3347", amount: 2150, currency: "USD", merchant: "Target.com", merchant_category: "retail", region: "Africa", city: "Lagos", country: "NG", transaction_type: "purchase", channel: "online", timestamp: new Date(Date.now() - 3600000).toISOString(), status: "pending", risk_score: 55, risk_level: "medium", is_fraud: false, is_suspicious: true, ml_fraud_probability: 0.45, rule_triggers: [{ rule: "Geo Anomaly", severity: "high" }], device_id: "DEV-D2P04", ip_address: "105.112.36.8", user_agent: "Mozilla/5.0", latitude: 6.5244, longitude: 3.3792 },
  { id: 5, transaction_id: "TXN-8290", account_id: "ACC-8872", account_name: "Alex Rivera", card_last_four: "8872", amount: 67.50, currency: "USD", merchant: "Starbucks", merchant_category: "food", region: "US West", city: "Seattle", country: "US", transaction_type: "purchase", channel: "mobile", timestamp: new Date(Date.now() - 7200000).toISOString(), status: "approved", risk_score: 3, risk_level: "low", is_fraud: false, is_suspicious: false, ml_fraud_probability: 0.01, rule_triggers: [], device_id: "DEV-E5R12", ip_address: "67.180.89.4", user_agent: "Mozilla/5.0", latitude: 47.6062, longitude: -122.3321 },
  { id: 6, transaction_id: "TXN-8289", account_id: "ACC-4412", account_name: "James Wilson", card_last_four: "4412", amount: 15800, currency: "USD", merchant: "HSBC Intl Transfer", merchant_category: "wire", region: "International", city: "London", country: "GB", transaction_type: "transfer", channel: "wire", timestamp: new Date(Date.now() - 10800000).toISOString(), status: "blocked", risk_score: 96, risk_level: "critical", is_fraud: true, is_suspicious: true, ml_fraud_probability: 0.99, rule_triggers: [{ rule: "High-Value Threshold", severity: "critical" }, { rule: "International Alert", severity: "high" }, { rule: "Unverified Beneficiary", severity: "critical" }], device_id: "DEV-A7X92", ip_address: "81.2.69.144", user_agent: "Mozilla/5.0", latitude: 51.5074, longitude: -0.1278 },
  { id: 7, transaction_id: "TXN-8288", account_id: "ACC-2239", account_name: "Lisa Park", card_last_four: "2239", amount: 523, currency: "USD", merchant: "Netflix.com", merchant_category: "entertainment", region: "US West", city: "San Francisco", country: "US", transaction_type: "purchase", channel: "online", timestamp: new Date(Date.now() - 14400000).toISOString(), status: "approved", risk_score: 5, risk_level: "low", is_fraud: false, is_suspicious: false, ml_fraud_probability: 0.01, rule_triggers: [], device_id: "DEV-F6T78", ip_address: "209.85.227.1", user_agent: "Mozilla/5.0", latitude: 37.7749, longitude: -122.4194 },
];

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState("overview");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [transactions] = useState<Transaction[]>(mockTransactions);
  const [stats] = useState(defaultStats);
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Supabase realtime subscription
  useEffect(() => {
    const unsub = supabase.subscribeToChannel("transactions", "INSERT", (payload) => {
      console.log("New transaction:", payload);
    });
    return unsub;
  }, []);

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0e1a" }}>
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl accent-gradient mx-auto flex items-center justify-center shadow-lg animate-pulse">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="6" width="20" height="14" rx="2" /><path d="M12 2L2 6h20z" /><line x1="8" y1="12" x2="8" y2="16" /><line x1="12" y1="12" x2="12" y2="16" /><line x1="16" y1="12" x2="16" y2="16" /></svg>
          </div>
          <p className="text-[#64748b] text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
    <div className="flex min-h-screen" style={{ background: "#0a0e1a" }}>
      <Sidebar active={activeSection} onNavigate={setActiveSection} />

      <div className="flex-1 ml-64 min-h-screen flex flex-col">
        <Header />

        <main className="flex-1 p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto w-full">
          <div className="animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white">Fraud Monitoring Dashboard</h1>
                <p className="text-sm text-[#64748b] mt-0.5">Real-time surveillance · <span className="text-emerald-400">All systems nominal</span></p>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs text-[#64748b] px-3 py-1.5 rounded-lg bg-[#1e293b] border border-[#334155]">
                  <span className="relative flex w-2 h-2">
                    <span className="absolute inset-0 rounded-full bg-emerald-500" />
                    <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-50" />
                  </span>
                  {stats.totalTransactions.toLocaleString()} transactions
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
        </main>
      </div>

      {selectedTx && <TransactionDrawer tx={selectedTx} onClose={() => setSelectedTx(null)} />}
    </div>
    </ProtectedRoute>
  );
}
