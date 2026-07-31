"use client";

import { useState, useEffect } from "react";
import { supabase, type Account, type Transaction, type Transfer } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

const riskColors: Record<string, { bg: string; text: string; dot: string }> = {
  critical: { bg: "rgba(239,68,68,0.15)", text: "#ef4444", dot: "#ef4444" },
  high: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b", dot: "#f59e0b" },
  medium: { bg: "rgba(59,130,246,0.15)", text: "#3b82f6", dot: "#3b82f6" },
  low: { bg: "rgba(34,197,94,0.15)", text: "#22c55e", dot: "#22c55e" },
};

const statusColors: Record<string, string> = {
  approved: "bg-[#22c55e]/10 text-[#22c55e]",
  completed: "bg-[#22c55e]/10 text-[#22c55e]",
  flagged: "bg-[#f59e0b]/10 text-[#f59e0b]",
  pending: "bg-[#3b82f6]/10 text-[#3b82f6]",
  blocked: "bg-[#ef4444]/10 text-[#ef4444]",
  failed: "bg-[#ef4444]/10 text-[#ef4444]",
};

interface HistoryRow {
  id: string;
  who: string;
  detail: string;
  when: string;
  amount: number;
  direction: "in" | "out" | "card";
  status: string;
  risk_level?: string;
}

export default function TransactionHistory() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      const accs = await supabase.getAccounts(user.id);
      if (!active) return;
      setAccounts(accs);

      const accountNumbers = accs.map((a) => a.account_number);
      const accountIds = accs.map((a) => a.id);
      const [txns, transfers] = await Promise.all([
        supabase.getTransactionsByAccounts(accountNumbers, 50),
        accountIds.length > 0 ? supabase.getTransfers(accountIds) : Promise.resolve([]),
      ]);
      if (!active) return;

      const [txUsernames, accountUsernames] = await Promise.all([
        supabase.getUsernamesByAccountNumbers(Array.from(new Set(txns.map((t) => t.account_id)))),
        supabase.getUsernamesByAccountIds(Array.from(new Set(transfers.flatMap((t) => [t.sender_account_id, t.receiver_account_id])))),
      ]);
      if (!active) return;

      const myAccountIds = new Set(accountIds);
      const myUsername = user.full_name || user.email || "";
      const merged: HistoryRow[] = [
        ...txns.map((t: Transaction) => ({
          id: `tx-${t.id}`,
          who: txUsernames[t.account_id] || myUsername || t.account_name || "Unknown",
          detail: t.merchant || t.transaction_type,
          when: t.timestamp,
          amount: Number(t.amount),
          direction: "card" as const,
          status: t.status,
          risk_level: t.risk_level,
        })),
        ...transfers.map((t: Transfer) => {
          const isReceived = myAccountIds.has(t.receiver_account_id) && !myAccountIds.has(t.sender_account_id);
          const counterpartyId = isReceived ? t.sender_account_id : t.receiver_account_id;
          const who = accountUsernames[counterpartyId] || (isReceived ? t.sender_name : t.receiver_name) || "Unknown";
          return {
            id: `tr-${t.id}`,
            who,
            detail: isReceived ? "Received transfer" : "Sent transfer",
            when: t.created_at,
            amount: Number(t.amount),
            direction: isReceived ? "in" as const : "out" as const,
            status: t.status,
          };
        }),
      ].sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());

      setRows(merged);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user?.id, user?.full_name, user?.email]);

  return (
    <div className="glass-neon rounded-2xl p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-white">Transaction History</h3>
          <p className="text-xs text-[#64748b] mt-0.5">Latest activity across your {accounts.length} {accounts.length === 1 ? "account" : "accounts"}</p>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-[#64748b] text-sm">Loading transactions...</div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-[#64748b] text-sm">No transactions yet on your accounts</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#64748b] text-xs uppercase tracking-wider border-b border-[#1e293b]">
                <th className="text-left font-medium pb-3 pr-4">Username</th>
                <th className="text-left font-medium pb-3 pr-4">Detail</th>
                <th className="text-left font-medium pb-3 pr-4">When</th>
                <th className="text-left font-medium pb-3 pr-4">Amount</th>
                <th className="text-left font-medium pb-3 pr-4">Risk</th>
                <th className="text-right font-medium pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rc = row.risk_level ? riskColors[row.risk_level] || riskColors.low : riskColors.low;
                return (
                  <tr key={row.id} className="border-b border-[#1e293b]/50 hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-2">
                        {row.direction !== "card" && (
                          <span
                            className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-[10px] font-bold"
                            style={row.direction === "in"
                              ? { background: "rgba(34,197,94,0.15)", color: "#22c55e" }
                              : { background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}
                          >
                            {row.direction === "in" ? "IN" : "OUT"}
                          </span>
                        )}
                        <span className="text-white text-xs font-medium">{row.who}</span>
                      </div>
                    </td>
                    <td className="py-3.5 pr-4">
                      <span className="text-[#94a3b8] text-xs">{row.detail}</span>
                    </td>
                    <td className="py-3.5 pr-4">
                      <span className="text-[#94a3b8] text-xs">{new Date(row.when).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
                    </td>
                    <td className="py-3.5 pr-4">
                      <span className={`font-semibold tabular-nums ${row.direction === "in" ? "text-[#22c55e]" : row.direction === "out" ? "text-[#f59e0b]" : "text-white"}`}>
                        {row.direction === "in" ? "+" : row.direction === "out" ? "-" : ""}
                        ${row.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4">
                      {row.risk_level ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: rc.bg, color: rc.text }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: rc.dot }} />
                          {row.risk_level.charAt(0).toUpperCase() + row.risk_level.slice(1)}
                        </span>
                      ) : (
                        <span className="text-[#64748b] text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3.5 text-right">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColors[row.status] || ""}`}>{row.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
