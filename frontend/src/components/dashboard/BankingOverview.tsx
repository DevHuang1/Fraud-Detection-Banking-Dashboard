"use client";

import { useState, useEffect } from "react";
import { Icons } from "@/components/ui/Icons";
import { supabase, type Account, type Transfer } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

const quickServices = [
  { label: "Send Money", icon: "send" as const, color: "from-[#3b82f6] to-[#00f0ff]", desc: "Transfer to any account" },
  { label: "Receive", icon: "receive" as const, color: "from-[#8b5cf6] to-[#ec4899]", desc: "Share account details" },
  { label: "Pay Bills", icon: "fileText" as const, color: "from-[#f59e0b] to-[#ef4444]", desc: "Utilities & services" },
  { label: "Exchange", icon: "refresh" as const, color: "from-[#22ff8b] to-[#00f0ff]", desc: "Currency conversion" },
];

interface BankingOverviewProps {
  onNavigate: (section: string) => void;
}

export default function BankingOverview({ onNavigate }: BankingOverviewProps) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [usernames, setUsernames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const accs = await supabase.getAccounts(user.id);
      setAccounts(accs);
      if (accs.length > 0) {
        const txns = await supabase.getTransfers(accs.map((a) => a.id));
        setTransfers(txns);
        const ids = Array.from(new Set(txns.flatMap((t) => [t.sender_account_id, t.receiver_account_id])));
        const names = await supabase.getUsernamesByAccountIds(ids);
        setUsernames(names);
      }
      setLoading(false);
    })();
  }, [user?.id]);

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const accountColors = ["from-[#3b82f6] to-[#00f0ff]", "from-[#8b5cf6] to-[#ec4899]", "from-[#22ff8b] to-[#00f0ff]"];

  if (loading) {
    return (
      <div className="animate-fade-in space-y-5">
        <div className="glass-neon rounded-2xl p-6">
          <div className="h-8 w-48 bg-[#1e293b] rounded animate-pulse mb-3" />
          <div className="h-12 w-64 bg-[#1e293b] rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Welcome back{user?.email ? `, ${user.email.split("@")[0]}` : ""}</h2>
          <p className="text-sm text-[#64748b] mt-0.5">Here&apos;s your account summary for today</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {accounts.slice(0, 3).map((_, i) => (
              <div key={i} className="w-7 h-7 rounded-full border-2 border-[#0a0e1a]" style={{ background: accountColors[i]?.match(/#[a-f0-9]{6}/g)?.[0] || "#3b82f6" }} />
            ))}
          </div>
          <span className="text-xs text-[#64748b] font-mono">{accounts.length} {accounts.length === 1 ? "account" : "accounts"}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <div className="glass-neon rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-[#00f0ff]/8 to-[#8b5cf6]/8 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-[#3b82f6]/5 to-transparent rounded-full blur-2xl pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-semibold text-[#64748b] uppercase tracking-widest">Total Balance</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-bold text-white tabular-nums tracking-tight">${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                <span className="text-sm text-[#00f0ff] font-mono">USD</span>
              </div>
              <div className="flex items-center gap-4 mt-6">
                <button
                  onClick={() => onNavigate("banking")}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#00f0ff] text-white text-xs font-semibold shadow-lg hover:shadow-blue-500/20 transition-all"
                >
                  <Icons.send size={14} /> Send Money
                </button>
                <button
                  onClick={() => onNavigate("banking")}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1e293b] border border-[#334155] text-white text-xs font-semibold hover:border-[#00f0ff]/30 transition-all"
                >
                  <Icons.receive size={14} /> Request
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {quickServices.map((s) => (
              <button
                key={s.label}
                onClick={() => onNavigate("banking")}
                className="glass-neon rounded-xl p-4 text-center hover:scale-[1.02] transition-all group"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} mx-auto flex items-center justify-center shadow-lg mb-2 group-hover:scale-110 transition-transform`}>
                  {s.icon === "send" ? <Icons.send size={16} /> : s.icon === "receive" ? <Icons.receive size={16} /> : s.icon === "fileText" ? <Icons.fileText size={16} /> : <Icons.refresh size={16} />}
                </div>
                <span className="block text-xs font-medium text-white">{s.label}</span>
                <span className="block text-[9px] text-[#64748b] mt-0.5">{s.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass-neon rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-white">Accounts</h3>
            </div>
            <div className="space-y-3">
              {accounts.length === 0 && (
                <p className="text-xs text-[#64748b] text-center py-4">No accounts yet</p>
              )}
              {accounts.map((a, i) => (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#1e293b]/50 border border-[#1e293b]">
                  <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${accountColors[i % accountColors.length]}`} />
                  <div className="flex-1 min-w-0">
                    <span className="block text-xs font-medium text-white truncate">{a.account_name}</span>
                    <span className="block text-[10px] text-[#64748b] font-mono">**** {a.account_number.slice(-4)}</span>
                  </div>
                  <span className="text-xs font-semibold text-white tabular-nums">${Number(a.balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-neon rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-white">Quick Stats</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Total Accounts", value: accounts.length.toString(), sub: accounts.length > 0 ? "Active" : "None" },
                { label: "Transfers", value: transfers.length.toString(), sub: "All time" },
              ].map((s) => (
                <div key={s.label} className="p-3 rounded-xl bg-[#1e293b]/50 border border-[#1e293b]">
                  <span className="block text-[10px] text-[#64748b]">{s.label}</span>
                  <span className="block text-sm font-bold text-white tabular-nums mt-0.5">{s.value}</span>
                  <span className="block text-[10px] font-medium text-[#64748b] mt-0.5">{s.sub}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="glass-neon rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
            <p className="text-xs text-[#64748b] mt-0.5">Your latest transfers</p>
          </div>
          <button
            onClick={() => onNavigate("banking")}
            className="flex items-center gap-1 text-xs text-[#00f0ff] font-medium"
          >
            View All <Icons.arrowRight size={12} />
          </button>
        </div>
        <div className="space-y-1">
          {transfers.length === 0 && (
            <p className="text-xs text-[#64748b] text-center py-6">No transfers yet. Send your first payment!</p>
          )}
          {transfers.slice(0, 5).map((t) => {
            const accountIds = accounts.map((a) => a.id);
            const isReceived = accountIds.includes(t.receiver_account_id) && !accountIds.includes(t.sender_account_id);
            const counterpartyId = isReceived ? t.sender_account_id : t.receiver_account_id;
            const counterpartyName = usernames[counterpartyId] || (isReceived ? t.sender_name : t.receiver_name);
            return (
              <div key={t.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-[#1e293b]/50 transition-colors">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isReceived ? "bg-[#22ff8b]/10 text-[#22ff8b]" : "bg-[#f59e0b]/10 text-[#f59e0b]"
                }`}>
                  {isReceived ? <Icons.receive size={16} /> : <Icons.send size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-white truncate">{counterpartyName || "Unknown"}</span>
                  <span className="block text-[11px] text-[#64748b]">{new Date(t.created_at).toLocaleDateString()} {new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="text-right">
                  <span className={`block text-sm font-semibold tabular-nums ${isReceived ? "text-[#22ff8b]" : "text-white"}`}>
                    {isReceived ? "+" : "-"}${Number(t.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                  <span className={`block text-[10px] font-medium ${t.status === "completed" ? "text-[#22ff8b]" : "text-[#f59e0b]"}`}>
                    {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
