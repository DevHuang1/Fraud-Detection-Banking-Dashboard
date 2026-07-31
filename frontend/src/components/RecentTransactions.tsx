"use client";

import { useState, useEffect } from "react";
import { supabase, type Transaction } from "@/lib/supabase";

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

const statusLabels: Record<string, string> = {
  pending: "Review",
  approved: "Approved",
  blocked: "Blocked",
  flagged: "Flagged",
};

const riskColors = {
  critical: { bg: "rgba(239,68,68,0.15)", text: "#ef4444", dot: "#ef4444" },
  high: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b", dot: "#f59e0b" },
  medium: { bg: "rgba(59,130,246,0.15)", text: "#3b82f6", dot: "#3b82f6" },
  low: { bg: "rgba(34,197,94,0.15)", text: "#22c55e", dot: "#22c55e" },
};

const statusColors: Record<string, string> = {
  Blocked: "rgba(239,68,68,0.15) text-[#ef4444]",
  Flagged: "rgba(245,158,11,0.15) text-[#f59e0b]",
  Review: "rgba(59,130,246,0.15) text-[#3b82f6]",
  Approved: "rgba(34,197,94,0.15) text-[#22c55e]",
};

export default function RecentTransactions({ onSelect }: { onSelect?: (tx: Transaction) => void }) {
  const [txns, setTxns] = useState<Transaction[]>([]);

  useEffect(() => {
    let active = true;
    supabase.getTransactions(20).then((data) => {
      if (active) setTxns(data);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="glass-card rounded-2xl p-6 animate-slide-up delay-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-white">Recent Transactions</h3>
          <p className="text-xs text-[#64748b] mt-0.5">Latest flagged activity requiring attention</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[#64748b] text-xs uppercase tracking-wider border-b border-[#1e293b]">
              <th className="text-left font-medium pb-3 pr-4">ID</th>
              <th className="text-left font-medium pb-3 pr-4">Card</th>
              <th className="text-left font-medium pb-3 pr-4">Amount</th>
              <th className="text-left font-medium pb-3 pr-4">Merchant</th>
              <th className="text-left font-medium pb-3 pr-4">Risk</th>
              <th className="text-left font-medium pb-3 pr-4">Status</th>
              <th className="text-right font-medium pb-3 pr-4">Time</th>
              <th className="text-right font-medium pb-3" />
            </tr>
          </thead>
          <tbody>
            {txns.map((tx) => {
              const rc = riskColors[tx.risk_level as keyof typeof riskColors] || riskColors.low;
              return (
                <tr key={tx.id} className="border-b border-[#1e293b]/50 hover:bg-white/[0.02] transition-colors group">
                  <td className="py-3.5 pr-4">
                    <span className="font-mono text-xs text-[#94a3b8]">{tx.transaction_id}</span>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className="text-white text-xs font-mono">**** {tx.card_last_four}</span>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className="text-white font-medium">${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className="text-[#94a3b8] text-xs">{tx.merchant}</span>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: rc.bg, color: rc.text }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: rc.dot }} />
                      {tx.risk_level.charAt(0).toUpperCase() + tx.risk_level.slice(1)}
                    </span>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[statusLabels[tx.status] || tx.status] || ""}`}>
                      {statusLabels[tx.status] || tx.status}
                    </span>
                  </td>
                  <td className="py-3.5 text-right pr-4">
                    <span className="text-[#64748b] text-xs">{relativeTime(tx.timestamp)}</span>
                  </td>
                  <td className="py-3.5 text-right">
                    <button
                      onClick={() => onSelect?.(tx)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg bg-[#1e293b] border border-[#334155] flex items-center justify-center hover:border-blue-500/30"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
