"use client";

import { useState, useEffect, useCallback } from "react";
import { Icons } from "@/components/ui/Icons";
import { supabase, type Transaction, type Alert } from "@/lib/supabase";

const riskColors: Record<string, { bg: string; text: string }> = {
  critical: { bg: "rgba(239,68,68,0.15)", text: "#ef4444" },
  high: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b" },
  medium: { bg: "rgba(59,130,246,0.15)", text: "#3b82f6" },
  low: { bg: "rgba(34,197,94,0.15)", text: "#22c55e" },
};

const statusColors: Record<string, string> = {
  blocked: "rgba(239,68,68,0.15) text-[#ef4444]",
  flagged: "rgba(245,158,11,0.15) text-[#f59e0b]",
  pending: "rgba(59,130,246,0.15) text-[#3b82f6]",
  approved: "rgba(34,197,94,0.15) text-[#22c55e]",
};

const inputCls = "w-full h-10 px-3 rounded-lg text-xs bg-[#1e293b] border border-[#334155] text-white placeholder-[#4a5568] outline-none focus:border-[#00f0ff]/30";

function RiskPill({ level }: { level: string }) {
  const c = riskColors[level] || riskColors.low;
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider" style={{ background: c.bg, color: c.text }}>
      {level}
    </span>
  );
}

export default function AnalystTools() {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Transaction[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [t, a] = await Promise.all([supabase.getTransactions(1000), supabase.getAlerts()]);
    setTxns(t);
    setAlerts(a);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([supabase.getTransactions(1000), supabase.getAlerts()]).then(([t, a]) => {
      if (!active) return;
      setTxns(t);
      setAlerts(a);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const queue = txns
    .filter((t) => t.is_suspicious || t.status === "flagged" || t.status === "pending" || t.risk_level === "high" || t.risk_level === "critical")
    .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
    .slice(0, 15);

  const act = async (t: Transaction, status: "approved" | "blocked", extra: Partial<Transaction>) => {
    setWorking(t.id);
    setNotice(null);
    const res = await supabase.updateTransactionStatus(t.id, { status, ...extra });
    setWorking(null);
    if (!res.success) {
      setNotice({ type: "error", text: res.error || "Action failed" });
      return;
    }
    setNotice({ type: "success", text: `${t.transaction_id} marked ${status}` });
    setTxns((prev) => prev.map((x) => (x.id === t.id ? { ...x, status, ...extra } : x)));
  };

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    const found = await supabase.searchTransactions(query, 20);
    setResults(found);
    setSearching(false);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {notice && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium ${notice.type === "success" ? "bg-[#22c55e]/10 text-[#22c55e]" : "bg-[#ef4444]/10 text-[#ef4444]"}`}>
          {notice.text}
        </div>
      )}

      <div className="glass-neon rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white">Analyst Tools</h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#60a5fa]/10 text-[#60a5fa] border border-[#60a5fa]/20">ANALYST</span>
          </div>
          <p className="text-xs text-[#64748b] mt-0.5 font-mono">Quick triage, lookups and alert pressure</p>
        </div>
        <button
          onClick={load}
          className="h-9 px-4 rounded-xl bg-[#1e293b] border border-[#334155] text-white text-xs font-semibold flex items-center gap-1.5 hover:border-[#00f0ff]/30 transition-all"
        >
          <Icons.refresh size={14} /> Refresh
        </button>
      </div>

      <div className="glass-neon rounded-2xl overflow-hidden">
        <div className="p-5 pb-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Icons.listChecks size={15} className="text-[#f59e0b]" /> Triage Queue
            </h4>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono border border-[#334155] text-[#64748b]">
              {queue.length} to review
            </span>
          </div>
          <p className="text-xs text-[#64748b] mt-0.5">Highest-risk transactions needing a decision</p>
        </div>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#64748b] text-[11px] uppercase tracking-wider border-y border-[#1e293b]">
                <th className="text-left font-medium px-5 py-3">Transaction</th>
                <th className="text-left font-medium px-5 py-3">Merchant</th>
                <th className="text-left font-medium px-5 py-3">Amount</th>
                <th className="text-left font-medium px-5 py-3">Risk</th>
                <th className="text-left font-medium px-5 py-3">Status</th>
                <th className="text-right font-medium px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-[#64748b] text-sm">Loading triage queue...</td>
                </tr>
              )}
              {!loading && queue.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-[#64748b] text-sm">Queue is clear — nothing suspicious right now</td>
                </tr>
              )}
              {queue.map((t) => (
                <tr key={t.id} className="border-b border-[#1e293b]/50 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3">
                    <span className="block font-mono text-[11px] text-[#94a3b8]">{t.transaction_id}</span>
                    <span className="text-xs text-white">{t.account_name || t.account_id}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs text-white">{t.merchant}</span>
                    <span className="block text-[10px] text-[#64748b]">{t.channel} · {t.transaction_type}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm font-semibold text-white tabular-nums">${t.amount.toLocaleString()}</span>
                  </td>
                  <td className="px-5 py-3">
                    <RiskPill level={t.risk_level} />
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize ${statusColors[t.status] || ""}`}>{t.status}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => act(t, "approved", { is_suspicious: false })}
                        disabled={working === t.id}
                        className="h-7 px-3 rounded-lg bg-[#22c55e]/10 text-[#22c55e] text-[11px] font-semibold hover:bg-[#22c55e]/20 transition-all disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => act(t, "blocked", { risk_level: "critical", is_suspicious: true })}
                        disabled={working === t.id}
                        className="h-7 px-3 rounded-lg bg-[#ef4444]/10 text-[#ef4444] text-[11px] font-semibold hover:bg-[#ef4444]/20 transition-all disabled:opacity-50"
                      >
                        Block
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-neon rounded-2xl p-5">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Icons.search size={15} className="text-[#00f0ff]" /> Lookup Console
          </h4>
          <p className="text-xs text-[#64748b] mt-0.5">Search by merchant, account, device or IP</p>
          <div className="flex gap-2 mt-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="e.g. CryptoExchange.io, ACC-1234, DEV-..."
              className={inputCls}
            />
            <button
              onClick={runSearch}
              disabled={searching}
              className="h-10 px-4 rounded-lg bg-gradient-to-r from-[#3b82f6] to-[#00f0ff] text-white text-xs font-semibold shrink-0 shadow-lg hover:shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              {searching ? "..." : "Search"}
            </button>
          </div>
          <div className="mt-4 space-y-2 max-h-72 overflow-y-auto">
            {results.length === 0 && !searching && (
              <p className="text-xs text-[#64748b]">Results will appear here.</p>
            )}
            {results.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#111827] border border-[#1e293b]">
                <div className="min-w-0">
                  <span className="block text-xs text-white truncate">{r.merchant}</span>
                  <span className="block font-mono text-[10px] text-[#64748b]">{r.transaction_id} · {r.account_id}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-white tabular-nums">${r.amount.toLocaleString()}</span>
                  <RiskPill level={r.risk_level} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-neon rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <Icons.bell size={15} className="text-[#ec4899]" /> Recent Alerts
              </h4>
              <p className="text-xs text-[#64748b] mt-0.5">Latest detection alerts</p>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono border border-[#334155] text-[#64748b]">
              {alerts.filter((a) => !a.is_read).length} unread
            </span>
          </div>
          <div className="mt-4 space-y-2 max-h-72 overflow-y-auto">
            {loading && <p className="text-xs text-[#64748b]">Loading alerts...</p>}
            {!loading && alerts.length === 0 && <p className="text-xs text-[#64748b]">No alerts yet.</p>}
            {alerts.map((a) => (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl bg-[#111827] border border-[#1e293b]">
                <span
                  className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${a.is_read ? "bg-[#334155]" : "bg-[#ec4899]"}`}
                />
                <div className="min-w-0">
                  <span className="block text-xs text-white">{a.title}</span>
                  <span className="block text-[11px] text-[#64748b] mt-0.5">{a.message}</span>
                  <span className="block font-mono text-[10px] text-[#475569] mt-1">{new Date(a.created_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
