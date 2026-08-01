"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Icons } from "./Icons";
import { supabase, type Transaction, type FraudCase, type Alert } from "@/lib/supabase";

interface Props {
  onSelectTransaction?: (tx: Transaction) => void;
  onOpenTab?: (tab: string) => void;
}

const riskColor: Record<string, string> = {
  critical: "text-[#ef4444]",
  high: "text-[#f59e0b]",
  medium: "text-[#3b82f6]",
  low: "text-[#22c55e]",
};

const statusPill: Record<string, string> = {
  blocked: "bg-[#ef4444]/15 text-[#ef4444]",
  flagged: "bg-[#f59e0b]/15 text-[#f59e0b]",
  pending: "bg-[#3b82f6]/15 text-[#3b82f6]",
  approved: "bg-[#22c55e]/15 text-[#22c55e]",
};

const alertSeverity: Record<string, string> = {
  critical: "bg-[#ef4444]/15 text-[#ef4444]",
  warning: "bg-[#f59e0b]/15 text-[#f59e0b]",
  info: "bg-[#3b82f6]/15 text-[#00f0ff]",
};

export default function Header({ onSelectTransaction, onOpenTab }: Props) {
  const [throughput, setThroughput] = useState("--");
  const [query, setQuery] = useState("");
  const [txResults, setTxResults] = useState<Transaction[]>([]);
  const [caseResults, setCaseResults] = useState<FraudCase[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    supabase.getStats().then((stats) => {
      if (!active) return;
      setThroughput(`${(stats.totalTransactions / 24).toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = () => {
      supabase.getAlerts().then((rows) => {
        if (active) setAlerts(rows);
      });
    };
    load();
    const client = supabase.getClient();
    const channel = client
      .channel("alerts_bell")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, load)
      .subscribe();
    return () => {
      active = false;
      client.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const toggleAlertRead = async (a: Alert) => {
    const next = !a.is_read;
    setAlerts((prev) => prev.map((x) => (x.id === a.id ? { ...x, is_read: next } : x)));
    const res = await supabase.updateAlert(a.id, { is_read: next });
    if (!res.success) setAlerts((prev) => prev.map((x) => (x.id === a.id ? { ...x, is_read: a.is_read } : x)));
  };

  const markAllRead = async () => {
    const unread = alerts.filter((a) => !a.is_read);
    if (unread.length === 0) return;
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    await Promise.all(unread.map((a) => supabase.updateAlert(a.id, { is_read: true })));
  };

  const openAlert = async (a: Alert) => {
    if (!a.is_read) await toggleAlertRead(a);
    setNotifOpen(false);
    if (a.transaction_id && onSelectTransaction) {
      const tx = await supabase.getTransaction(a.transaction_id);
      if (tx) onSelectTransaction(tx);
    }
  };

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  const runSearch = useCallback(async (q: string) => {
    const needle = q.trim();
    if (!needle) {
      setTxResults([]);
      setCaseResults([]);
      setOpen(false);
      return;
    }
    setSearching(true);
    const lower = needle.toLowerCase();
    const [txns, cases] = await Promise.all([
      supabase.searchTransactions(needle, 8),
      supabase.getCases().then((c) =>
        c
          .filter((x) => x.title?.toLowerCase().includes(lower) || x.case_number?.toLowerCase().includes(lower) || x.fraud_type?.toLowerCase().includes(lower))
          .slice(0, 5),
      ),
    ]);
    setTxResults(txns);
    setCaseResults(cases);
    setSearching(false);
  }, []);

  const onQueryChange = (value: string) => {
    setQuery(value);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), 300);
  };

  const selectTx = (tx: Transaction) => {
    setOpen(false);
    setQuery("");
    onSelectTransaction?.(tx);
  };

  const openTab = (tab: string) => {
    setOpen(false);
    setQuery("");
    onOpenTab?.(tab);
  };

  const total = txResults.length + caseResults.length;
  const firstTx = txResults[0];

  return (
    <header
      className="sticky top-0 z-40 h-16 flex items-center justify-between px-6 lg:px-8"
      style={{
        background: "rgba(10,14,26,0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(51,65,85,0.2)",
      }}
    >
      <div className="flex items-center gap-4" ref={rootRef}>
        <div className="relative group">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748b] group-focus-within:text-[#00f0ff] transition-colors">
            <Icons.search size={16} />
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => query.trim() && setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && firstTx) selectTx(firstTx);
            }}
            placeholder="Search transactions, cases, accounts..."
            className="w-[420px] h-10 pl-10 pr-4 rounded-xl text-sm bg-[#1e293b] border border-[#334155] text-white placeholder-[#4a5568] outline-none focus:border-[#00f0ff]/30 focus:ring-1 focus:ring-[#00f0ff]/10 transition-all"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#4a5568] bg-[#0a0e1a] px-1.5 py-0.5 rounded border border-[#1e293b]">⌘K</span>

          {open && (
            <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-[#334155] shadow-2xl overflow-hidden animate-fade-in" style={{ background: "#0a0e1a" }}>
              <div className="max-h-[420px] overflow-y-auto">
                {searching && total === 0 && (
                  <div className="px-4 py-8 text-center text-xs text-[#64748b]">Searching…</div>
                )}
                {!searching && query.trim() && total === 0 && (
                  <div className="px-4 py-8 text-center text-xs text-[#64748b]">No matches for “{query.trim()}”</div>
                )}

                {txResults.length > 0 && (
                  <>
                    <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-[#64748b] bg-[#111827] border-b border-[#1e293b]">
                      Transactions
                    </div>
                    {txResults.map((tx) => (
                      <button
                        key={tx.id}
                        onClick={() => selectTx(tx)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.04] transition-colors border-b border-[#1e293b]/50"
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${tx.risk_level === "critical" ? "bg-[#ef4444]" : tx.risk_level === "high" ? "bg-[#f59e0b]" : tx.risk_level === "medium" ? "bg-[#3b82f6]" : "bg-[#22c55e]"}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs text-white truncate">{tx.merchant} · {tx.account_name || tx.account_id}</span>
                          <span className="block font-mono text-[10px] text-[#64748b]">{tx.transaction_id}</span>
                        </span>
                        <span className="text-xs font-semibold text-white tabular-nums shrink-0">${tx.amount.toLocaleString()}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize shrink-0 ${statusPill[tx.status] || ""}`}>{tx.status}</span>
                      </button>
                    ))}
                  </>
                )}

                {caseResults.length > 0 && (
                  <>
                    <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-[#64748b] bg-[#111827] border-b border-[#1e293b]">
                      Cases
                    </div>
                    {caseResults.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => openTab("cases")}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.04] transition-colors border-b border-[#1e293b]/50"
                      >
                        <Icons.shield size={14} className={`shrink-0 ${severityColor(c.severity)}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs text-white truncate">{c.title || "Untitled case"}</span>
                          <span className="block font-mono text-[10px] text-[#64748b]">{c.case_number} · {c.fraud_type}</span>
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize shrink-0 ${statusPill[c.status] || ""}`}>{c.status}</span>
                      </button>
                    ))}
                  </>
                )}

                {query.trim() && txResults.length > 0 && (
                  <button
                    onClick={() => firstTx && selectTx(firstTx)}
                    className="w-full px-4 py-2.5 text-left text-[11px] text-[#64748b] hover:text-[#00f0ff] hover:bg-white/[0.04] transition-colors"
                  >
                    Press <span className="text-white font-mono">Enter</span> to open {firstTx?.transaction_id}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((o) => !o)}
            className={`relative w-10 h-10 rounded-xl bg-[#1e293b] border flex items-center justify-center transition-all group ${notifOpen ? "border-[#00f0ff]/40" : "border-[#334155] hover:border-[#00f0ff]/30"}`}
          >
            <span className={`transition-colors ${notifOpen ? "text-[#00f0ff]" : "text-[#64748b] group-hover:text-[#00f0ff]"}`}><Icons.bell size={18} /></span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-br from-[#ef4444] to-[#ec4899] text-[10px] font-bold text-white flex items-center justify-center shadow-lg tabular-nums">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-[380px] rounded-2xl border border-[#334155] shadow-2xl overflow-hidden animate-fade-in" style={{ background: "#0a0e1a" }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e293b]">
                <span className="text-xs font-semibold text-white">Notifications</span>
                <div className="flex items-center gap-3">
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-[11px] text-[#00f0ff] hover:text-white transition-colors">
                      Mark all read
                    </button>
                  )}
                  <span className="font-mono text-[10px] text-[#64748b]">{unreadCount} unread</span>
                </div>
              </div>

              <div className="max-h-[380px] overflow-y-auto">
                {alerts.length === 0 && (
                  <div className="px-4 py-10 text-center text-xs text-[#64748b]">No notifications</div>
                )}
                {alerts.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => openAlert(a)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 border-b border-[#1e293b]/50 transition-colors hover:bg-white/[0.04] ${a.is_read ? "" : "bg-[#111827]"}`}
                  >
                    <span className={`mt-0.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase shrink-0 ${alertSeverity[a.severity] || alertSeverity.info}`}>{a.severity}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-white truncate">{a.title}</span>
                      <span className="block text-[11px] text-[#94a3b8] mt-0.5 line-clamp-2">{a.message}</span>
                      <span className="block font-mono text-[10px] text-[#64748b] mt-1">
                        {a.alert_type} · {new Date(a.created_at).toLocaleString()}
                      </span>
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleAlertRead(a);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.stopPropagation();
                          void toggleAlertRead(a);
                        }
                      }}
                      className={`shrink-0 mt-0.5 px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all ${a.is_read ? "border-[#334155] text-[#64748b] hover:text-white" : "border-[#00f0ff]/30 text-[#00f0ff] hover:bg-[#00f0ff]/10"}`}
                    >
                      {a.is_read ? "Read" : "Unread"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="h-8 w-px bg-[#1e293b] mx-1" />

        <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-[#1e293b]/50 border border-[#00f0ff]/10 neon-border-cyan">
          <div className="flex items-center gap-2">
            <span className="relative flex w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-[#22ff8b]" />
              <span className="absolute inset-0 rounded-full bg-[#22ff8b] animate-ping opacity-50" />
            </span>
            <span className="text-xs text-[#22ff8b] font-medium">Live</span>
          </div>
          <span className="text-[10px] text-[#64748b] font-mono">{throughput} txn/h</span>
        </div>
      </div>
    </header>
  );
}

function severityColor(severity: string): string {
  return riskColor[severity] || "text-[#64748b]";
}
