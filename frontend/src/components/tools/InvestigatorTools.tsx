"use client";

import { useState, useEffect } from "react";
import { Icons } from "@/components/ui/Icons";
import { supabase, type Transaction } from "@/lib/supabase";

const statusPill: Record<string, string> = {
  blocked: "bg-[#ef4444]/15 text-[#ef4444]",
  flagged: "bg-[#f59e0b]/15 text-[#f59e0b]",
  pending: "bg-[#3b82f6]/15 text-[#3b82f6]",
  approved: "bg-[#22c55e]/15 text-[#22c55e]",
};

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function InvestigatorTools() {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [lookup, setLookup] = useState<Transaction[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.getTransactions(1000).then((t) => {
      if (!active) return;
      setTxns(t);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const runLookup = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setLookup(await supabase.searchTransactions(query, 20));
    setSearching(false);
  };

  const exportTransactions = () => {
    const header = "transaction_id,account_id,merchant,merchant_category,amount,currency,channel,status,risk_level,risk_score,is_fraud,is_suspicious,timestamp\n";
    const body = txns
      .map((t) => `${t.transaction_id},"${t.merchant}","${t.merchant_category}",${t.amount},${t.currency},${t.channel},${t.status},${t.risk_level},${t.risk_score},${t.is_fraud},${t.is_suspicious},${t.timestamp}`)
      .join("\n");
    downloadCsv(header + body, `transactions-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportHighRisk = () => {
    const header = "transaction_id,account_id,merchant,amount,currency,status,risk_level,risk_score,is_fraud,is_suspicious,timestamp\n";
    const highRisk = txns.filter((t) => t.risk_level === "high" || t.risk_level === "critical" || t.is_suspicious).sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0));
    const body = highRisk
      .map((t) => `${t.transaction_id},${t.account_id},"${t.merchant}",${t.amount},${t.currency},${t.status},${t.risk_level},${t.risk_score},${t.is_fraud},${t.is_suspicious},${t.timestamp}`)
      .join("\n");
    downloadCsv(header + body, `high-risk-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="glass-neon rounded-2xl p-5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white">Investigator Tools</h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#a78bfa]/10 text-[#a78bfa] border border-[#a78bfa]/20">INVESTIGATOR</span>
          </div>
          <p className="text-xs text-[#64748b] mt-0.5 font-mono">Entity lookups, exports and case accelerators</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-neon rounded-2xl p-5">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Icons.eye size={15} className="text-[#8b5cf6]" /> Entity Lookup
          </h4>
          <p className="text-xs text-[#64748b] mt-0.5">Find activity by account, device, IP or merchant</p>
          <div className="flex gap-2 mt-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runLookup()}
              placeholder="e.g. ACC-4321, DEV-12345, 45.67.89.10"
              className="w-full h-10 px-3 rounded-lg text-xs bg-[#1e293b] border border-[#334155] text-white placeholder-[#4a5568] outline-none focus:border-[#00f0ff]/30"
            />
            <button
              onClick={runLookup}
              disabled={searching}
              className="h-10 px-4 rounded-lg bg-gradient-to-r from-[#3b82f6] to-[#00f0ff] text-white text-xs font-semibold shrink-0 shadow-lg hover:shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              {searching ? "..." : "Trace"}
            </button>
          </div>
          <div className="mt-4 space-y-2 max-h-80 overflow-y-auto">
            {lookup.length === 0 && !searching && <p className="text-xs text-[#64748b]">Related transactions will appear here.</p>}
            {lookup.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#111827] border border-[#1e293b]">
                <div className="min-w-0">
                  <span className="block text-xs text-white truncate">{r.merchant} · {r.account_id}</span>
                  <span className="block font-mono text-[10px] text-[#64748b]">{r.transaction_id} · {r.device_id}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-white tabular-nums">${r.amount.toLocaleString()}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize ${statusPill[r.status] || ""}`}>
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-neon rounded-2xl p-5">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Icons.download size={15} className="text-[#22ff8b]" /> Export Center
          </h4>
          <p className="text-xs text-[#64748b] mt-0.5">Download datasets for offline investigation</p>
          <div className="mt-4 grid grid-cols-1 gap-3">
            <button
              onClick={exportTransactions}
              className="flex items-center justify-between p-4 rounded-xl bg-[#111827] border border-[#1e293b] hover:border-[#00f0ff]/30 transition-all text-left"
            >
              <div>
                <span className="block text-sm font-semibold text-white">Transactions Export</span>
                <span className="block text-xs text-[#64748b] mt-0.5">{loading ? "…" : txns.length.toLocaleString()} rows · full risk fields</span>
              </div>
              <span className="w-9 h-9 rounded-lg bg-[#3b82f6]/15 text-[#00f0ff] flex items-center justify-center"><Icons.download size={16} /></span>
            </button>
            <button
              onClick={exportHighRisk}
              className="flex items-center justify-between p-4 rounded-xl bg-[#111827] border border-[#1e293b] hover:border-[#00f0ff]/30 transition-all text-left"
            >
              <div>
                <span className="block text-sm font-semibold text-white">High-Risk Export</span>
                <span className="block text-xs text-[#64748b] mt-0.5">Suspicious / high & critical risk rows only</span>
              </div>
              <span className="w-9 h-9 rounded-lg bg-[#ef4444]/15 text-[#ef4444] flex items-center justify-center"><Icons.download size={16} /></span>
            </button>
          </div>

          <div className="mt-5 pt-5 border-t border-[#1e293b]">
            <h5 className="text-xs font-semibold text-white flex items-center gap-2">
              <Icons.wand size={14} className="text-[#a78bfa]" /> Case Accelerators
            </h5>
            <p className="text-[11px] text-[#64748b] mt-1">Full case management lives in the Fraud Cases tab. Use the AI Agent below to investigate and open cases automatically.</p>
            <ul className="mt-3 space-y-2 text-[11px] text-[#94a3b8]">
              <li className="flex items-start gap-2"><Icons.checkCircle size={13} className="mt-0.5 text-[#22c55e]" /> Triage highest-risk flagged transactions from the queue</li>
              <li className="flex items-start gap-2"><Icons.checkCircle size={13} className="mt-0.5 text-[#22c55e]" /> Open case workbench in Fraud Cases for deep dives</li>
              <li className="flex items-start gap-2"><Icons.checkCircle size={13} className="mt-0.5 text-[#22c55e]" /> Delegate repetitive triage to the AI Agent</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
