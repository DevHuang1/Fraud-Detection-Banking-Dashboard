"use client";

import { useState } from "react";
import { Icons } from "@/components/ui/Icons";
import type { FraudCase } from "@/lib/supabase";

const severityColors: Record<string, string> = {
  critical: "#ef4444", high: "#f59e0b", medium: "#3b82f6", low: "#22c55e",
};

const statusStyles: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-400",
  investigating: "bg-amber-500/10 text-amber-400",
  resolved: "bg-emerald-500/10 text-emerald-400",
  dismissed: "bg-[#64748b]/10 text-[#64748b]",
};

const initialCases: FraudCase[] = [
  { id: 1, transaction_id: 8294, case_number: "FC-2024-001", title: "Large Crypto Exchange Transfer", description: "$12,450 transfer to CryptoExchange.io from new device", severity: "critical", status: "investigating", assigned_to: "", fraud_type: "account_takeover", amount_at_risk: 12450, is_confirmed_fraud: false, created_at: new Date().toISOString() },
  { id: 2, transaction_id: 8292, case_number: "FC-2024-002", title: "Western Union Rapid Cash-Out", description: "$8,920 wire transfer flagged by velocity rule", severity: "high", status: "open", assigned_to: "", fraud_type: "rapid_cashout", amount_at_risk: 8920, is_confirmed_fraud: false, created_at: new Date().toISOString() },
  { id: 3, transaction_id: 8291, case_number: "FC-2024-003", title: "Geo Anomaly - Target.com", description: "Login from NYC, purchase from IP in Lagos", severity: "medium", status: "open", assigned_to: "", fraud_type: "geo_anomaly", amount_at_risk: 2150, is_confirmed_fraud: false, created_at: new Date().toISOString() },
  { id: 4, transaction_id: 8289, case_number: "FC-2024-004", title: "High-Value International Wire", description: "$15,800 HSBC transfer to unverified beneficiary", severity: "critical", status: "investigating", assigned_to: "", fraud_type: "wire_fraud", amount_at_risk: 15800, is_confirmed_fraud: false, created_at: new Date().toISOString() },
];

export default function CaseManagement() {
  const [cases, setCases] = useState(initialCases);
  const [selectedCase, setSelectedCase] = useState<FraudCase | null>(null);
  const [note, setNote] = useState("");

  const updateStatus = (id: number, status: string) => {
    setCases((prev) => prev.map((c) => (c.id === id ? { ...c, status: status as any } : c)));
  };

  const markFraud = (id: number, val: boolean) => {
    setCases((prev) => prev.map((c) => (c.id === id ? { ...c, is_confirmed_fraud: val, status: val ? "resolved" : "dismissed" } : c)));
  };

  return (
    <div className="glass rounded-2xl animate-slide-up delay-6">
      <div className="p-5 pb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">Case Management</h3>
          <p className="text-xs text-[#64748b] mt-0.5">{cases.length} active cases requiring review</p>
        </div>
        <button className="h-9 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg">
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
              <tr key={c.id} className="border-b border-[#1e293b]/50 hover:bg-white/[0.02] transition-colors">
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
                    <button onClick={() => markFraud(c.id, true)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all">
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
