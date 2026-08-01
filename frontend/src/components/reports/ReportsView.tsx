"use client";

import { useState, useEffect, useCallback } from "react";
import { Icons } from "@/components/ui/Icons";
import { supabase, type Transaction, type FraudCase, type DashboardStats } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Role } from "@/lib/roles";

interface ReportStat {
  label: string;
  value: string;
  hint: string;
}

const REPORT_META: Record<Role, { title: string; subtitle: string; icon: string }> = {
  user: {
    title: "Personal Activity Report",
    subtitle: "A summary of monitored account activity",
    icon: "fileText",
  },
  analyst: {
    title: "Triage & Monitoring Report",
    subtitle: "Detection coverage, queues and alert pressure for analysts",
    icon: "bell",
  },
  investigator: {
    title: "Investigation & Outcomes Report",
    subtitle: "Case progress, blocked losses and fraud patterns for investigators",
    icon: "shield",
  },
  admin: {
    title: "Executive Fraud Report",
    subtitle: "Full oversight across detection, outcomes, rules and exposure",
    icon: "barChart",
  },
};

function buildStats(stats: DashboardStats, txns: Transaction[], cases: FraudCase[], role: Role): ReportStat[] {
  const pending = txns.filter((t) => t.status === "pending").length;
  const openCases = cases.filter((c) => c.status === "open" || c.status === "investigating").length;
  const losses = txns.filter((t) => t.status === "blocked" || t.is_fraud).reduce((s, t) => s + (t.amount || 0), 0);

  const sets: Record<Role, ReportStat[]> = {
    user: [{ label: "Transactions Monitored", value: stats.totalTransactions.toLocaleString(), hint: "All-time" }],
    analyst: [
      { label: "Transactions Monitored", value: stats.totalTransactions.toLocaleString(), hint: "All-time" },
      { label: "Suspicious · Triage Queue", value: stats.suspiciousTransactions.toLocaleString(), hint: "Flagged for review" },
      { label: "Pending Review", value: pending.toLocaleString(), hint: "Recent 5k window" },
      { label: "Unread Alerts", value: stats.unreadAlerts.toLocaleString(), hint: "Unacknowledged" },
      { label: "High-Risk Accounts", value: stats.highRiskAccounts.toLocaleString(), hint: "Score ≥ high" },
      { label: "Avg Risk Score", value: stats.avgRiskScore.toFixed(1), hint: "Volume-weighted" },
    ],
    investigator: [
      { label: "Transactions Monitored", value: stats.totalTransactions.toLocaleString(), hint: "All-time" },
      { label: "Confirmed Fraud", value: stats.confirmedFraud.toLocaleString(), hint: "Verified transactions" },
      { label: "Blocked Attempts", value: stats.blockedAttempts.toLocaleString(), hint: "Prevented" },
      { label: "Losses Prevented", value: `$${Math.round(losses).toLocaleString()}`, hint: "Blocked + fraud" },
      { label: "Cases Open", value: openCases.toLocaleString(), hint: "Active investigations" },
      { label: "Fraud Rate", value: `${stats.fraudRate}%`, hint: "Percent of volume" },
    ],
    admin: [
      { label: "Transactions Monitored", value: stats.totalTransactions.toLocaleString(), hint: "All-time" },
      { label: "Confirmed Fraud", value: stats.confirmedFraud.toLocaleString(), hint: "Verified transactions" },
      { label: "Blocked Attempts", value: stats.blockedAttempts.toLocaleString(), hint: "Prevented" },
      { label: "High-Risk Accounts", value: stats.highRiskAccounts.toLocaleString(), hint: "Score ≥ high" },
      { label: "Unread Alerts", value: stats.unreadAlerts.toLocaleString(), hint: "Unacknowledged" },
      { label: "Cases Open", value: openCases.toLocaleString(), hint: "Active investigations" },
    ],
  };
  return sets[role] || sets.investigator;
}

function buildInsights(stats: DashboardStats, txns: Transaction[], cases: FraudCase[], role: Role): string[] {
  const insights: string[] = [];
  const flagged = txns.filter((t) => t.is_fraud || t.is_suspicious);

  const regionMap: Record<string, number> = {};
  const catMap: Record<string, number> = {};
  const hourMap: Record<number, number> = {};
  for (const t of flagged) {
    const r = t.region || "Unknown";
    regionMap[r] = (regionMap[r] || 0) + 1;
    const c = t.merchant_category || "Other";
    catMap[c] = (catMap[c] || 0) + 1;
    const h = new Date(t.timestamp).getHours();
    hourMap[h] = (hourMap[h] || 0) + 1;
  }

  const topRegion = Object.entries(regionMap).sort((a, b) => b[1] - a[1])[0];
  if (topRegion) {
    insights.push(`${topRegion[0]} leads flagged activity with ${topRegion[1].toLocaleString()} suspicious transactions in the recent window.`);
  }

  const exposure = flagged.reduce((s, t) => s + (t.amount || 0), 0);
  insights.push(`Flagged exposure across the recent window totals $${Math.round(exposure).toLocaleString()}.`);

  const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
  if (topCat) {
    insights.push(`Merchant category "${topCat[0]}" produced the most flagged volume (${topCat[1].toLocaleString()} txns).`);
  }

  const topHour = Object.entries(hourMap).sort((a, b) => b[1] - a[1])[0];
  if (topHour) {
    insights.push(`Peak fraud activity clusters around ${String(topHour[0]).padStart(2, "0")}:00 (${topHour[1].toLocaleString()} flagged).`);
  }

  if (role === "analyst") {
    const pending = txns.filter((t) => t.status === "pending").length;
    insights.push(`${pending.toLocaleString()} transactions sit in the pending-review queue awaiting triage.`);
  } else if (role === "investigator" || role === "admin") {
    const open = cases.filter((c) => c.status === "open" || c.status === "investigating").length;
    const resolved = cases.filter((c) => c.status === "resolved").length;
    insights.push(`${open.toLocaleString()} cases are open and ${resolved.toLocaleString()} have been resolved.`);
  }

  return insights.slice(0, 5);
}

export default function ReportsView() {
  const { user } = useAuth();
  const role: Role = user?.role ?? "investigator";
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [cases, setCases] = useState<FraudCase[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, t, c] = await Promise.all([supabase.getStats(), supabase.getTransactions(5000), supabase.getCases()]);
    setStats(s);
    setTxns(t);
    setCases(c);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const [s, t, c] = await Promise.all([supabase.getStats(), supabase.getTransactions(5000), supabase.getCases()]);
      if (!active) return;
      setStats(s);
      setTxns(t);
      setCases(c);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const meta = REPORT_META[role];
  const rows = stats ? buildStats(stats, txns, cases, role) : [];
  const insights = stats ? buildInsights(stats, txns, cases, role) : [];

  const exportCsv = () => {
    const header = "Metric,Value,Notes\n";
    const body = [
      ...rows.map((r) => `"${r.label}",${r.value},"${r.hint}"`),
      ...insights.map((i) => `"Insight","",${JSON.stringify(i)}`),
    ].join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${role}-fraud-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="glass-neon rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#00f0ff] flex items-center justify-center shadow-lg shrink-0">
            <Icons.fileText size={18} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">{meta.title}</h3>
            <p className="text-xs text-[#64748b] mt-0.5 font-mono">{meta.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#64748b] font-mono">{new Date().toLocaleString()} · {user?.email}</span>
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

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-neon rounded-2xl p-5 h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map((r) => (
              <div key={r.label} className="glass-neon rounded-2xl p-5">
                <span className="block text-[11px] uppercase tracking-wider text-[#64748b]">{r.label}</span>
                <span className="block text-2xl font-bold text-white tabular-nums mt-1.5">{r.value}</span>
                <span className="block text-xs text-[#64748b] mt-1">{r.hint}</span>
              </div>
            ))}
          </div>

          <div className="glass-neon rounded-2xl p-5">
            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Icons.trendingUp size={15} className="text-[#00f0ff]" />
              Automated Insights
            </h4>
            <ul className="space-y-2.5">
              {insights.map((insight, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs text-[#cbd5e1]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] mt-1.5 shrink-0" />
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
