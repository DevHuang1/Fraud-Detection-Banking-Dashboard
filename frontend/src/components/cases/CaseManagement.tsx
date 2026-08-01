"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Icons } from "@/components/ui/Icons";
import { supabase, type FraudCase, type Transaction } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const severityColors: Record<string, string> = {
  critical: "#ef4444", high: "#f59e0b", medium: "#3b82f6", low: "#22c55e",
};

const statusStyles: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-400",
  investigating: "bg-amber-500/10 text-amber-400",
  resolved: "bg-emerald-500/10 text-emerald-400",
  dismissed: "bg-[#64748b]/10 text-[#64748b]",
};

const fraudTypes = [
  "account_takeover", "rapid_cashout", "geo_anomaly",
  "wire_fraud", "card_not_present", "identity_theft", "other",
];

interface Props {
  canAdjudicate?: boolean;
}

interface CaseForm {
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  fraud_type: string;
  amount_at_risk: string;
  assigned_to: string;
}

const allStatuses: FraudCase["status"][] = ["open", "investigating", "resolved", "dismissed"];
const triageStatuses: FraudCase["status"][] = ["open", "investigating"];

const emptyForm: CaseForm = {
  title: "",
  description: "",
  severity: "medium",
  fraud_type: "other",
  amount_at_risk: "",
  assigned_to: "",
};

export default function CaseManagement({ canAdjudicate = true }: Props) {
  const { user } = useAuth();
  const [cases, setCases] = useState<FraudCase[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CaseForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [assignees, setAssignees] = useState<{ id: string; full_name: string; email: string; role: string }[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<FraudCase | null>(null);

  const loadCases = useCallback(() => {
    supabase.getCases().then(setCases);
  }, []);

  useEffect(() => {
    loadCases();
    supabase.listUsers().then((rows) => {
      setAssignees(rows.filter((u) => u.role === "investigator" || u.role === "admin"));
      setUserMap(Object.fromEntries(rows.map((u) => [u.id, u.full_name || u.email])));
    });
    const unsub = supabase.subscribeToChannel("fraud_cases", "INSERT", () => loadCases());
    return unsub;
  }, [loadCases]);

  const updateStatus = async (id: number, status: FraudCase["status"]) => {
    setCases((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    await supabase.updateCase(id, { status });
  };

  const markFraud = async (c: FraudCase, val: boolean) => {
    const status: FraudCase["status"] = val ? "resolved" : "dismissed";
    setCases((prev) => prev.map((x) => (x.id === c.id ? { ...x, is_confirmed_fraud: val, status } : x)));
    if (c.transaction_id) {
      const txUpdates: Partial<Pick<Transaction, "status" | "is_fraud" | "is_suspicious" | "risk_level">> = val
        ? { status: "blocked", is_fraud: true, is_suspicious: true, risk_level: "critical" }
        : { status: "approved", is_fraud: false, is_suspicious: false };
      await supabase.updateTransactionStatus(c.transaction_id, txUpdates);
    }
    await supabase.updateCase(c.id, { is_confirmed_fraud: val, status });
  };

  const createCase = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    const res = await supabase.createCase({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      severity: form.severity,
      fraud_type: form.fraud_type,
      amount_at_risk: form.amount_at_risk ? Number(form.amount_at_risk) : undefined,
      assigned_to: form.assigned_to || undefined,
      assigned_by: user?.id || undefined,
    });
    setSaving(false);
    if (!res.success) {
      setNotice({ type: "error", text: res.error || "Failed to create case" });
      return;
    }
    setNotice({ type: "success", text: "Case created" });
    setOpen(false);
    setForm(emptyForm);
    loadCases();
  };

  const inputCls = "w-full h-10 px-3 rounded-lg text-xs bg-[#1e293b] border border-[#334155] text-white outline-none focus:border-[#00f0ff]/30 placeholder-[#4a5568]";
  const labelCls = "block text-[10px] uppercase tracking-wider text-[#64748b] mb-1";

  const activeCases = cases.filter((c) => c.status === "open" || c.status === "investigating");

  return (
    <div className="glass-neon rounded-2xl animate-slide-up delay-6">
      <div className="p-5 pb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white">Case Management</h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20">ACTIVE</span>
          </div>
          <p className="text-xs text-[#64748b] mt-0.5 font-mono">{activeCases.length} cases requiring review</p>
        </div>
        <button
          onClick={() => { setOpen(true); setNotice(null); }}
          className="h-9 px-4 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#00f0ff] text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg hover:shadow-blue-500/20 transition-shadow"
        >
          <Icons.plus size={14} /> New Case
        </button>
      </div>

      {notice && (
        <div className={`mx-5 mb-3 px-4 py-2.5 rounded-xl text-xs font-medium ${notice.type === "success" ? "bg-[#22c55e]/10 text-[#22c55e]" : "bg-[#ef4444]/10 text-[#ef4444]"}`}>
          {notice.text}
        </div>
      )}

      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <form onSubmit={createCase} className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-[#334155] p-6 space-y-4" style={{ background: "#0a0e1a" }}>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-white">Open New Fraud Case</h4>
                <p className="text-xs text-[#64748b] mt-0.5">Assign to an investigator and set severity</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="w-9 h-9 rounded-lg flex items-center justify-center text-[#64748b] hover:text-white hover:bg-[#1e293b] transition-all">
                <Icons.x size={16} />
              </button>
            </div>

            <div>
              <label className={labelCls}>Title</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Fraud: unusual wire transfer" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Summary of the suspicious activity" rows={2} className={`${inputCls} h-auto py-2 resize-none`} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Severity</label>
                <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as CaseForm["severity"] })} className={inputCls}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Fraud Type</label>
                <select value={form.fraud_type} onChange={(e) => setForm({ ...form, fraud_type: e.target.value })} className={inputCls}>
                  {fraudTypes.map((f) => (
                    <option key={f} value={f}>{f.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Amount at Risk</label>
                <input type="number" min="0" step="0.01" value={form.amount_at_risk} onChange={(e) => setForm({ ...form, amount_at_risk: e.target.value })} placeholder="0.00" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Assign To</label>
                <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} className={inputCls}>
                  <option value="">Unassigned</option>
                  {assignees.map((a) => (
                    <option key={a.id} value={a.id}>{a.full_name || a.email}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="flex-1 h-10 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#00f0ff] text-white text-xs font-semibold shadow-lg hover:shadow-blue-500/20 transition-all disabled:opacity-50">
                {saving ? "Creating..." : "Create Case"}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="h-10 px-4 rounded-xl bg-[#1e293b] border border-[#334155] text-[#64748b] text-xs hover:text-white transition-all">
                Cancel
              </button>
            </div>
          </form>
          </div>,
          document.body,
        )}

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
            {activeCases.map((c) => (
              <tr key={c.id} onClick={() => setSelected(c)} className="border-b border-[#1e293b]/50 hover:bg-white/[0.02] transition-colors relative cursor-pointer">
                <td className="px-4 py-3.5">
                  <span className="font-mono text-xs text-[#94a3b8]">{c.case_number}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-white text-xs font-medium">{c.title}</span>
                  <span className="block text-[10px] text-[#64748b]">{c.fraud_type} · {relativeTime(c.created_at)}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize" style={{ background: `${severityColors[c.severity]}15`, color: severityColors[c.severity] }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: severityColors[c.severity] }} />
                    {c.severity}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  {!canAdjudicate && (c.status === "resolved" || c.status === "dismissed") ? (
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize ${statusStyles[c.status]}`}>
                      {c.status}
                    </span>
                  ) : (
                    <select
                      value={c.status}
                      onChange={(e) => updateStatus(c.id, e.target.value as FraudCase["status"])}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border-0 outline-none cursor-pointer bg-[#0a0e1a] ${statusStyles[c.status]}`}
                    >
                      {(canAdjudicate ? allStatuses : triageStatuses).map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-white font-semibold tabular-nums text-xs">${(c.amount_at_risk || 0).toLocaleString()}</span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  {canAdjudicate ? (
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={(e) => { e.stopPropagation(); setSelected(c); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#64748b] hover:text-white hover:bg-[#1e293b] transition-all" title="View details">
                        <Icons.eye size={14} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); markFraud(c, true); }} className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[#22ff8b]/10 text-[#22ff8b] hover:bg-[#22ff8b]/20 transition-all">
                        Confirm
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); markFraud(c, false); }} className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[#64748b]/10 text-[#64748b] hover:bg-[#64748b]/20 transition-all">
                        Dismiss
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={(e) => { e.stopPropagation(); setSelected(c); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#64748b] hover:text-white hover:bg-[#1e293b] transition-all" title="View details">
                        <Icons.eye size={14} />
                      </button>
                      <span className="text-[10px] text-[#64748b] uppercase tracking-wider">
                        {c.status === "investigating" ? "In review" : "Triage · set to Investigating to escalate"}
                      </span>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {activeCases.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <span className="text-xs text-[#64748b]">No active cases — new flagged transactions auto-open cases here.</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelected(null)} />
            <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-[#334155]" style={{ background: "#0a0e1a" }}>
              <div className="sticky top-0 z-10 px-6 py-4 border-b border-[#1e293b] flex items-center justify-between" style={{ background: "#0a0e1a" }}>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-[#94a3b8]">{selected.case_number}</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize" style={{ background: `${severityColors[selected.severity]}15`, color: severityColors[selected.severity] }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: severityColors[selected.severity] }} />
                    {selected.severity}
                  </span>
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize ${statusStyles[selected.status]}`}>
                    {selected.status}
                  </span>
                </div>
                <button onClick={() => setSelected(null)} className="w-9 h-9 rounded-lg flex items-center justify-center text-[#64748b] hover:text-white hover:bg-[#1e293b] transition-all">
                  <Icons.x size={16} />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <h4 className="text-base font-semibold text-white">{selected.title}</h4>
                  {selected.is_confirmed_fraud && (
                    <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#22ff8b]/10 text-[#22ff8b]">
                      <Icons.checkCircle size={12} /> Confirmed fraud
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl bg-[#111827] border border-[#1e293b] px-4 py-3">
                    <span className="block text-[10px] uppercase tracking-wider text-[#64748b]">Fraud Type</span>
                    <span className="block text-sm text-white mt-1 capitalize">{selected.fraud_type.replace(/_/g, " ")}</span>
                  </div>
                  <div className="rounded-xl bg-[#111827] border border-[#1e293b] px-4 py-3">
                    <span className="block text-[10px] uppercase tracking-wider text-[#64748b]">Amount at Risk</span>
                    <span className="block text-sm text-white mt-1 tabular-nums">${(selected.amount_at_risk || 0).toLocaleString()}</span>
                  </div>
                  <div className="rounded-xl bg-[#111827] border border-[#1e293b] px-4 py-3">
                    <span className="block text-[10px] uppercase tracking-wider text-[#64748b]">Created</span>
                    <span className="block text-sm text-white mt-1">{formatDate(selected.created_at)}</span>
                  </div>
                  <div className="rounded-xl bg-[#111827] border border-[#1e293b] px-4 py-3">
                    <span className="block text-[10px] uppercase tracking-wider text-[#64748b]">Assigned To</span>
                    <span className="block text-sm text-white mt-1 truncate">{selected.assigned_to ? (userMap[selected.assigned_to] || selected.assigned_to) : "Unassigned"}</span>
                  </div>
                  <div className="rounded-xl bg-[#111827] border border-[#1e293b] px-4 py-3">
                    <span className="block text-[10px] uppercase tracking-wider text-[#64748b]">Transaction</span>
                    <span className="block text-sm font-mono text-[#00f0ff] mt-1">#{selected.transaction_id}</span>
                  </div>
                  <div className="rounded-xl bg-[#111827] border border-[#1e293b] px-4 py-3">
                    <span className="block text-[10px] uppercase tracking-wider text-[#64748b]">Status</span>
                    {!canAdjudicate && (selected.status === "resolved" || selected.status === "dismissed") ? (
                      <span className={`block mt-1 text-sm font-semibold capitalize ${statusStyles[selected.status]}`}>{selected.status}</span>
                    ) : (
                      <select
                        value={selected.status}
                        onChange={(e) => { updateStatus(selected.id, e.target.value as FraudCase["status"]); setSelected({ ...selected, status: e.target.value as FraudCase["status"] }); }}
                        className={`text-sm font-semibold px-2 py-1 rounded-lg border-0 outline-none cursor-pointer bg-[#0a0e1a] ${statusStyles[selected.status]}`}
                      >
                        {(canAdjudicate ? allStatuses : triageStatuses).map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {selected.description && (
                  <div className="rounded-xl bg-[#111827] border border-[#1e293b] px-4 py-3">
                    <span className="block text-[10px] uppercase tracking-wider text-[#64748b] mb-2">Description</span>
                    <p className="text-xs text-[#cbd5e1] leading-relaxed whitespace-pre-wrap">{selected.description}</p>
                  </div>
                )}
              </div>

              {canAdjudicate && (
                <div className="px-6 py-4 border-t border-[#1e293b] flex items-center justify-end gap-2">
                  <button onClick={() => setSelected(null)} className="h-10 px-4 rounded-xl bg-[#1e293b] border border-[#334155] text-[#64748b] text-xs hover:text-white transition-all">
                    Close
                  </button>
                  <button onClick={() => markFraud(selected, false)} className="h-10 px-4 rounded-xl bg-[#64748b]/10 text-[#64748b] text-xs font-semibold hover:bg-[#64748b]/20 transition-all">
                    Dismiss Case
                  </button>
                  <button onClick={() => markFraud(selected, true)} className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#22ff8b] to-[#00f0ff] text-[#0a0e1a] text-xs font-semibold shadow-lg hover:shadow-green-500/20 transition-all">
                    Confirm Fraud
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
