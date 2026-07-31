"use client";

import { useState, useEffect, useCallback } from "react";
import { Icons } from "@/components/ui/Icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

interface ReportRow {
  label: string;
  value: number;
  hint: string;
}

export default function ReportsView() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const stats = await supabase.getStats();
    setRows([
      { label: "Transactions Monitored", value: stats.totalTransactions, hint: "All-time" },
      { label: "Suspicious Activity", value: stats.suspiciousTransactions, hint: "Flagged for review" },
      { label: "Confirmed Fraud", value: stats.confirmedFraud, hint: "Verified cases" },
      { label: "Blocked Attempts", value: stats.blockedAttempts, hint: "Prevented losses" },
      { label: "High-Risk Accounts", value: stats.highRiskAccounts, hint: "Score ≥ high" },
      { label: "Fraud Rate", value: stats.fraudRate, hint: "Percent of volume" },
    ]);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.getStats().then((stats) => {
      if (!active) return;
      setRows([
        { label: "Transactions Monitored", value: stats.totalTransactions, hint: "All-time" },
        { label: "Suspicious Activity", value: stats.suspiciousTransactions, hint: "Flagged for review" },
        { label: "Confirmed Fraud", value: stats.confirmedFraud, hint: "Verified cases" },
        { label: "Blocked Attempts", value: stats.blockedAttempts, hint: "Prevented losses" },
        { label: "High-Risk Accounts", value: stats.highRiskAccounts, hint: "Score ≥ high" },
        { label: "Fraud Rate", value: stats.fraudRate, hint: "Percent of volume" },
      ]);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const exportCsv = () => {
    const header = "Metric,Value,Notes\n";
    const body = rows.map((r) => `"${r.label}",${r.value},"${r.hint}"`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fraud-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="glass-neon rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">Fraud Reports</h3>
          <p className="text-xs text-[#64748b] mt-0.5 font-mono">Generated {new Date().toLocaleString()} · {user?.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="h-9 px-4 rounded-xl bg-[#1e293b] border border-[#334155] text-white text-xs font-semibold flex items-center gap-1.5 hover:border-[#00f0ff]/30 transition-all"
          >
            <Icons.refresh size={14} /> Refresh
          </button>
          <button
            onClick={exportCsv}
            className="h-9 px-4 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#00f0ff] text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg hover:shadow-blue-500/20 transition-all"
          >
            <Icons.download size={14} /> Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass-neon rounded-2xl p-5 h-24 animate-pulse" />
            ))
          : rows.map((r) => (
              <div key={r.label} className="glass-neon rounded-2xl p-5">
                <span className="block text-[11px] uppercase tracking-wider text-[#64748b]">{r.label}</span>
                <span className="block text-2xl font-bold text-white tabular-nums mt-1.5">{r.value.toLocaleString()}</span>
                <span className="block text-xs text-[#64748b] mt-1">{r.hint}</span>
              </div>
            ))}
      </div>
    </div>
  );
}
