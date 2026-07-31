"use client";

import { useState, useEffect, useCallback } from "react";
import { Icons } from "@/components/ui/Icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

interface Rule {
  id: number;
  name: string;
  description: string;
  rule_type: string;
  action: string;
  is_active: boolean;
  hit_count: number;
  severity: string;
}

const severityColors: Record<string, string> = {
  critical: "#ef4444", high: "#f59e0b", medium: "#3b82f6", low: "#22c55e",
};

export default function FraudRules() {
  const { user } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [form, setForm] = useState({ name: "", description: "", severity: "medium", action: "flag" });
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === "admin";

  const loadRules = useCallback(() => {
    supabase.getRules().then((data) => setRules(data as Rule[]));
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const toggleRule = async (rule: Rule) => {
    const prev = rule.is_active;
    setRules((prevRules) => prevRules.map((r) => (r.id === rule.id ? { ...r, is_active: !prev } : r)));
    const res = await supabase.updateRule(rule.id, { is_active: !prev });
    if (!res.success) {
      setRules((prevRules) => prevRules.map((r) => (r.id === rule.id ? { ...r, is_active: prev } : r)));
      setNotice({ type: "error", text: res.error || "Failed to update rule" });
    } else {
      setNotice({ type: "success", text: `${rule.name} ${prev ? "disabled" : "enabled"}` });
    }
  };

  const startEdit = (rule: Rule) => {
    setForm({ name: rule.name, description: rule.description, severity: rule.severity, action: rule.action });
    setEditing(rule);
    setNotice(null);
  };

  const saveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setNotice(null);
    const res = await supabase.updateRule(editing.id, form);
    setSaving(false);
    if (!res.success) {
      setNotice({ type: "error", text: res.error || "Failed to save rule" });
      return;
    }
    setNotice({ type: "success", text: `${form.name} updated` });
    setEditing(null);
    loadRules();
  };

  const inputCls = "w-full h-10 px-3 rounded-lg text-xs bg-[#1e293b] border border-[#334155] text-white outline-none focus:border-[#00f0ff]/30 placeholder-[#4a5568]";
  const labelCls = "block text-[10px] uppercase tracking-wider text-[#64748b] mb-1";

  return (
    <div className="glass-card rounded-2xl p-6 animate-slide-up delay-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-white">Fraud Detection Rules</h3>
          <p className="text-xs text-[#64748b] mt-0.5">
            {isAdmin ? "Configure rules and triggers" : "Active monitoring rules — toggle rules on or off"}
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold font-mono border" style={{ color: severityColors.high, background: `${severityColors.high}12`, borderColor: `${severityColors.high}25` }}>
          {rules.filter((r) => r.is_active).length} ACTIVE
        </span>
      </div>

      {notice && (
        <div className={`mb-4 px-4 py-2.5 rounded-xl text-xs font-medium ${notice.type === "success" ? "bg-[#22c55e]/10 text-[#22c55e]" : "bg-[#ef4444]/10 text-[#ef4444]"}`}>
          {notice.text}
        </div>
      )}

      <div className="space-y-3">
        {rules.map((rule) => {
          const sc = severityColors[rule.severity] || severityColors.medium;
          return (
            <div key={rule.id} className="flex items-center justify-between p-3.5 rounded-xl bg-[#111827] border border-[#1e293b] hover:border-blue-500/20 transition-all">
              <div className="flex items-center gap-3.5">
                <div className={`w-2 h-2 rounded-full shrink-0 ${rule.is_active ? "bg-[#22c55e]" : "bg-[#64748b]"}`} />
                <div>
                  <span className="flex items-center gap-2 text-sm font-medium text-white">
                    {rule.name}
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider" style={{ background: `${sc}15`, color: sc }}>{rule.severity}</span>
                  </span>
                  <span className="text-xs text-[#64748b]">{rule.description}</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="block text-sm font-semibold text-white">{rule.hit_count}</span>
                  <span className="text-xs text-[#64748b]">triggers</span>
                </div>

                {isAdmin && (
                  <button
                    onClick={() => startEdit(rule)}
                    className="w-8 h-8 rounded-lg bg-[#1e293b] border border-[#334155] flex items-center justify-center text-[#64748b] hover:text-[#00f0ff] hover:border-[#00f0ff]/30 transition-all"
                    title="Edit rule"
                  >
                    <Icons.settings size={14} />
                  </button>
                )}

                <button
                  onClick={() => toggleRule(rule)}
                  className={`w-12 h-6 rounded-full relative transition-colors ${rule.is_active ? "bg-[#22c55e]/30" : "bg-[#1e293b] border border-[#334155]"}`}
                  title={rule.is_active ? "Deactivate rule" : "Activate rule"}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full transition-all ${rule.is_active ? "left-[26px] bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "left-0.5 bg-[#64748b]"}`} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <form onSubmit={saveRule} className="relative w-full max-w-md rounded-2xl border border-[#334155] p-6 space-y-4" style={{ background: "#0a0e1a" }}>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-white">Edit Rule</h4>
                <p className="text-xs text-[#64748b] mt-0.5">{editing.rule_type} rule · {editing.hit_count} triggers</p>
              </div>
              <button type="button" onClick={() => setEditing(null)} className="w-9 h-9 rounded-lg flex items-center justify-center text-[#64748b] hover:text-white hover:bg-[#1e293b] transition-all">
                <Icons.x size={16} />
              </button>
            </div>

            <div>
              <label className={labelCls}>Name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className={`${inputCls} h-auto py-2 resize-none`} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Severity</label>
                <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} className={inputCls}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Action</label>
                <select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} className={inputCls}>
                  <option value="flag">Flag</option>
                  <option value="block">Block</option>
                  <option value="review">Review</option>
                  <option value="notify">Notify</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="flex-1 h-10 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#00f0ff] text-white text-xs font-semibold shadow-lg hover:shadow-blue-500/20 transition-all disabled:opacity-50">
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button type="button" onClick={() => setEditing(null)} className="h-10 px-4 rounded-xl bg-[#1e293b] border border-[#334155] text-[#64748b] text-xs hover:text-white transition-all">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
