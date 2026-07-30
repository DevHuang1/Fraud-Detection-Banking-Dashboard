"use client";

import { useState, useEffect, useCallback } from "react";
import { Icons } from "@/components/ui/Icons";
import { supabase, type FraudCase } from "@/lib/supabase";

const severityColors: Record<string, string> = {
  critical: "#ef4444", high: "#f59e0b", medium: "#3b82f6", low: "#22c55e",
};

const statusStyles: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-400",
  investigating: "bg-amber-500/10 text-amber-400",
  resolved: "bg-emerald-500/10 text-emerald-400",
  dismissed: "bg-[#64748b]/10 text-[#64748b]",
};

export default function CaseManagement() {
  const [cases, setCases] = useState<FraudCase[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCases = useCallback(async () => {
    setLoading(true);
    const fetched = await supabase.getCases();
    setCases(fetched);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCases();
  }, [loadCases]);
  const [selectedCase, setSelectedCase] = useState<FraudCase | null>(null);
  const [note, setNote] = useState("");

  const updateStatus = async (id: number, status: string) => {
    setCases((prev) => prev.map((c) => (c.id === id ? { ...c, status: status as any } : c)));
    await supabase.updateCase(id, { status: status as any });
  };

  const markFraud = async (id: number, val: boolean) => {
    setCases((prev) => prev.map((c) => (c.id === id ? { ...c, is_confirmed_fraud: val, status: val ? "resolved" : "dismissed" } : c)));
    await supabase.updateCase(id, { is_confirmed_fraud: val, status: val ? "resolved" : "dismissed" } as any);
  };

  return (
    <div className="glass-neon rounded-2xl animate-slide-up delay-6">
      <div className="p-5 pb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white">Case Management</h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20">ACTIVE</span>
          </div>
          <p className="text-xs text-[#64748b] mt-0.5 font-mono">{cases.length} active cases requiring review</p>
        </div>
        <button className="h-9 px-4 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#00f0ff] text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg hover:shadow-blue-500/20 transition-shadow">
          <Icons.plus size={14} /> New Case
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[#64748b] text-[11px] uppercase tracking-wider border-y border-[#1e293b]">
              <th className="text-left font-medium px-4 py-3">Case</th>
              <th className="text-left font-medium px-4 py-3">Title</th>
              <th className="text-left font-medium px-4 py-3">Severity</th>
              <th className="text-left font-medium px-4 py-3">Status</th>
              <th className="text-left font-medium px-4 py-3">Amount at Risk</th>
              <th className="text-right font-medium px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id} className="border-b border-[#1e293b]/50 hover:bg-white/[0.02] transition-colors relative">
                <td className="px-4 py-3.5">
                  <span className="font-mono text-xs text-[#94a3b8]">{c.case_number}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-white text-xs font-medium">{c.title}</span>
                  <span className="block text-[10px] text-[#64748b]">{c.fraud_type}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize" style={{ background: `${severityColors[c.severity]}15`, color: severityColors[c.severity] }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: severityColors[c.severity] }} />
                    {c.severity}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <select
                    value={c.status}
                    onChange={(e) => updateStatus(c.id, e.target.value)}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border-0 outline-none cursor-pointer ${statusStyles[c.status]}`}
                  >
                    <option value="open">Open</option>
                    <option value="investigating">Investigating</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-white font-semibold tabular-nums text-xs">${c.amount_at_risk.toLocaleString()}</span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => markFraud(c.id, true)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[#22ff8b]/10 text-[#22ff8b] hover:bg-[#22ff8b]/20 transition-all">
                      Confirm
                    </button>
                    <button onClick={() => markFraud(c.id, false)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[#64748b]/10 text-[#64748b] hover:bg-[#64748b]/20 transition-all">
                      Dismiss
                    </button>
                    <button onClick={() => setSelectedCase(c)} className="p-1.5 rounded-lg text-[#64748b] hover:text-white hover:bg-white/[0.05] transition-all">
                      <Icons.arrowRight size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
