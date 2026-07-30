"use client";

import type { Transaction } from "@/lib/supabase";
import { Icons } from "@/components/ui/Icons";

interface Props {
  tx: Transaction | null;
  onClose: () => void;
}

export default function TransactionDrawer({ tx, onClose }: Props) {
  if (!tx) return null;

  const riskColor = tx.risk_level === "critical" ? "#ef4444" : tx.risk_level === "high" ? "#f59e0b" : tx.risk_level === "medium" ? "#3b82f6" : "#22c55e";

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-[520px] z-50 animate-slide-up scan-line" style={{ background: "#0a0e1a", borderLeft: "1px solid rgba(51,65,85,0.3)" }}>
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between px-6 h-16 border-b border-[#1e293b] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full animate-glow-pulse" style={{ background: riskColor, boxShadow: `0 0 6px ${riskColor}` }} />
              <h2 className="text-sm font-semibold text-white">Transaction Detail</h2>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748b] hover:text-white hover:bg-[#1e293b] transition-all">
              <Icons.x size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="glass rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#64748b] uppercase tracking-widest">Transaction Info</span>
                <span className="font-mono text-xs text-[#94a3b8]">{tx.transaction_id}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Amount", value: `$${tx.amount.toLocaleString()}` },
                  { label: "Type", value: tx.transaction_type },
                  { label: "Channel", value: tx.channel },
                  { label: "Status", value: tx.status },
                  { label: "Merchant", value: tx.merchant },
                  { label: "Category", value: tx.merchant_category },
                  { label: "Date", value: new Date(tx.timestamp).toLocaleString() },
                  { label: "Currency", value: tx.currency },
                ].map((f) => (
                  <div key={f.label}>
                    <span className="block text-[11px] text-[#64748b]">{f.label}</span>
                    <span className="text-sm font-medium text-white capitalize">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass rounded-2xl p-5 space-y-3">
              <span className="text-[11px] font-semibold text-[#64748b] uppercase tracking-widest block">ML Risk Assessment</span>
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="#1e293b" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke={riskColor} strokeWidth="3"
                      strokeDasharray={`${(tx.ml_fraud_probability || 0) * 100} 100`}
                      strokeLinecap="round"
                      style={{ transition: "stroke-dasharray 1s ease" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-lg font-bold text-white">{(tx.ml_fraud_probability || 0 * 100).toFixed(0)}%</span>
                    <span className="text-[9px] text-[#64748b]">fraud prob</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[#94a3b8]">Legitimate</span>
                    <span className="text-white font-medium ml-auto">{((1 - (tx.ml_fraud_probability || 0)) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full" style={{ background: riskColor }} />
                    <span className="text-[#94a3b8]">Fraudulent</span>
                    <span className="text-white font-medium ml-auto">{(tx.ml_fraud_probability || 0 * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full" style={{ background: riskColor }} />
                    <span className="text-[#94a3b8]">Risk Score</span>
                    <span className="text-white font-medium ml-auto">{tx.risk_score}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl p-5 space-y-3">
              <span className="text-[11px] font-semibold text-[#64748b] uppercase tracking-widest block">Rule Triggers</span>
              {(() => {
                const triggers = typeof tx.rule_triggers === "string" ? JSON.parse(tx.rule_triggers) : tx.rule_triggers;
                return triggers && triggers.length > 0 ? (
                <div className="space-y-2">
                  {triggers.map((r: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[#111827] border border-[#1e293b]">
                      <span className={`w-1.5 h-1.5 rounded-full ${r.severity === "critical" ? "bg-red-500" : r.severity === "high" ? "bg-amber-500" : "bg-blue-500"}`} />
                      <span className="text-xs text-white flex-1">{r.rule}</span>
                      <span className="text-[10px] font-semibold uppercase text-[#64748b]">{r.severity}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#64748b]">No rules triggered for this transaction</p>
              );})()}
            </div>

            <div className="glass rounded-2xl p-5 space-y-3">
              <span className="text-[11px] font-semibold text-[#64748b] uppercase tracking-widest block">Customer & Device</span>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-[11px] text-[#64748b]">Account</span>
                  <span className="text-sm font-medium text-white">{tx.account_name || tx.account_id}</span>
                </div>
                <div>
                  <span className="block text-[11px] text-[#64748b]">Card</span>
                  <span className="text-sm font-medium text-white font-mono">•••• {tx.card_last_four}</span>
                </div>
                <div>
                  <span className="block text-[11px] text-[#64748b]">IP Address</span>
                  <span className="text-sm font-medium text-white font-mono">{tx.ip_address || "N/A"}</span>
                </div>
                <div>
                  <span className="block text-[11px] text-[#64748b]">Device ID</span>
                  <span className="text-sm font-medium text-white font-mono text-xs">{tx.device_id || "N/A"}</span>
                </div>
                <div>
                  <span className="block text-[11px] text-[#64748b]">Region</span>
                  <span className="text-sm font-medium text-white">{tx.region || tx.country || "N/A"}</span>
                </div>
                <div>
                  <span className="block text-[11px] text-[#64748b]">Coordinates</span>
                  <span className="text-sm font-medium text-white font-mono text-xs">{tx.latitude ? `${tx.latitude.toFixed(2)}, ${tx.longitude?.toFixed(2)}` : "N/A"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-[#1e293b] flex gap-2">
            <button className="flex-1 h-10 rounded-xl bg-gradient-to-r from-[#ef4444] to-[#ec4899] text-white text-xs font-semibold shadow-lg hover:shadow-red-500/20 transition-shadow">Block Transaction</button>
            <button className="flex-1 h-10 rounded-xl bg-[#1e293b] border border-[#334155] text-white text-xs font-semibold hover:border-[#00f0ff]/30 transition-all">Flag for Review</button>
            <button className="w-10 h-10 rounded-xl bg-[#1e293b] border border-[#334155] flex items-center justify-center text-[#64748b] hover:text-white"><Icons.moreHorizontal size={16} /></button>
          </div>
        </div>
      </div>
    </>
  );
}
