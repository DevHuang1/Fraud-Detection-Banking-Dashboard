"use client";

import { useState, useMemo } from "react";
import { Icons } from "@/components/ui/Icons";
import type { Transaction } from "@/lib/supabase";

interface Props {
  transactions: Transaction[];
  onSelect: (tx: Transaction) => void;
}

const riskConfig = {
  critical: { bg: "rgba(239,68,68,0.12)", text: "#ef4444", dot: "#ef4444", label: "Critical" },
  high: { bg: "rgba(245,158,11,0.12)", text: "#f59e0b", dot: "#f59e0b", label: "High" },
  medium: { bg: "rgba(59,130,246,0.12)", text: "#3b82f6", dot: "#3b82f6", label: "Medium" },
  low: { bg: "rgba(34,197,94,0.12)", text: "#22c55e", dot: "#22c55e", label: "Low" },
};

const statusConfig: Record<string, { bg: string; text: string }> = {
  blocked: { bg: "rgba(239,68,68,0.12)", text: "#ef4444" },
  flagged: { bg: "rgba(245,158,11,0.12)", text: "#f59e0b" },
  pending: { bg: "rgba(59,130,246,0.12)", text: "#3b82f6" },
  approved: { bg: "rgba(34,197,94,0.12)", text: "#22c55e" },
};

export default function TransactionTable({ transactions, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (search && !tx.transaction_id.toLowerCase().includes(search.toLowerCase()) &&
          !tx.merchant?.toLowerCase().includes(search.toLowerCase()) &&
          !tx.account_id?.toLowerCase().includes(search.toLowerCase())) return false;
      if (riskFilter !== "all" && tx.risk_level !== riskFilter) return false;
      if (statusFilter !== "all" && tx.status !== statusFilter) return false;
      return true;
    });
  }, [transactions, search, riskFilter, statusFilter]);

  return (
    <div className="glass-neon rounded-2xl overflow-hidden animate-slide-up delay-3">
      <div className="p-5 pb-0 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white">Live Transaction Feed</h3>
            <span className="w-1.5 h-1.5 rounded-full bg-[#22ff8b] animate-glow-pulse" />
          </div>
          <p className="text-xs text-[#64748b] mt-0.5 font-mono">Real-time monitoring · {filtered.length} transactions</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]"><Icons.search size={14} /></span>
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-44 h-9 pl-9 pr-3 rounded-lg text-xs bg-[#1e293b] border border-[#334155] text-white placeholder-[#4a5568] outline-none focus:border-[#00f0ff]/30"
            />
          </div>
          <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}
            className="h-9 px-3 rounded-lg text-xs bg-[#1e293b] border border-[#334155] text-[#94a3b8] outline-none focus:border-[#00f0ff]/30">
            <option value="all">All Risk</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 rounded-lg text-xs bg-[#1e293b] border border-[#334155] text-[#94a3b8] outline-none focus:border-[#00f0ff]/30">
            <option value="all">All Status</option>
            <option value="approved">Approved</option>
            <option value="flagged">Flagged</option>
            <option value="blocked">Blocked</option>
            <option value="pending">Pending</option>
          </select>
          <button className="h-9 px-3 rounded-lg text-xs bg-[#1e293b] border border-[#334155] text-[#94a3b8] hover:text-white hover:border-[#00f0ff]/20 flex items-center gap-1.5 transition-all">
            <Icons.download size={14} /> Export
          </button>
        </div>
      </div>

      <div className="overflow-x-auto mt-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[#64748b] text-[11px] uppercase tracking-wider border-y border-[#1e293b]">
              <th className="text-left font-medium px-4 py-3">ID</th>
              <th className="text-left font-medium px-4 py-3">From</th>
              <th className="text-left font-medium px-4 py-3">Amount</th>
              <th className="text-left font-medium px-4 py-3">To</th>
              <th className="text-left font-medium px-4 py-3">Region</th>
              <th className="text-left font-medium px-4 py-3">Type</th>
              <th className="text-left font-medium px-4 py-3">Risk</th>
              <th className="text-left font-medium px-4 py-3">Status</th>
              <th className="text-left font-medium px-4 py-3">ML Score</th>
              <th className="text-right font-medium px-4 py-3">Time</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 15).map((tx) => {
              const rc = riskConfig[tx.risk_level] || riskConfig.low;
              const sc = statusConfig[tx.status] || statusConfig.approved;
              return (
                <tr
                  key={tx.id}
                  onClick={() => onSelect(tx)}
                  className="border-b border-[#1e293b]/50 hover:bg-white/[0.02] transition-colors cursor-pointer group relative"
                >
                  <td className="px-4 py-3.5">
                    <span className="font-mono text-xs text-[#94a3b8]">{tx.transaction_id}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="block text-xs text-[#60a5fa] font-medium">→ {tx.account_name || tx.account_id}</span>
                    <span className="block text-[10px] text-[#64748b] font-mono">•••• {tx.card_last_four}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-white font-semibold tabular-nums">${tx.amount.toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-[#94a3b8] text-xs">{tx.merchant}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="flex items-center gap-1 text-[#94a3b8] text-xs">
                      <Icons.mapPin size={12} /> {tx.region || tx.country}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-[#94a3b8] text-xs capitalize">{tx.transaction_type}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: rc.bg, color: rc.text }}>
                      <span className="w-1.5 h-1.5 rounded-full animate-glow-pulse" style={{ background: rc.dot }} />
                      {rc.label}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize" style={{ background: sc.bg, color: sc.text }}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-[#1e293b] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${((tx.ml_fraud_probability || 0) * 100)}%`,
                            background: (tx.ml_fraud_probability || 0) > 0.7 ? "#ef4444" : (tx.ml_fraud_probability || 0) > 0.4 ? "#f59e0b" : "#22ff8b",
                            boxShadow: (tx.ml_fraud_probability || 0) > 0.7 ? "0 0 8px rgba(239,68,68,0.5)" : "none",
                          }}
                        />
                      </div>
                      <span className="text-[11px] text-[#64748b] font-mono">{((tx.ml_fraud_probability || 0) * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-[#64748b] text-xs font-mono">{new Date(tx.timestamp).toLocaleTimeString()}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-[#64748b] text-sm">No transactions match your filters</div>
      )}
    </div>
  );
}
