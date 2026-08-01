"use client";

import { useState, useMemo, useEffect } from "react";
import type { ReactNode } from "react";
import type { Transaction } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { Icons } from "@/components/ui/Icons";
import { useAuth } from "@/context/AuthContext";
import {
  computeAnalysis,
  type Signal,
  type SignalStatus,
} from "@/lib/analyzeTransaction";

interface Props {
  tx: Transaction | null;
  onClose: () => void;
  onUpdated?: () => void;
  canModerate?: boolean;
  canTriage?: boolean;
}

interface RuleTrigger {
  rule: string;
  severity: string;
}

function isRuleTrigger(r: unknown): r is RuleTrigger {
  if (!r || typeof r !== "object") return false;
  const obj = r as Record<string, unknown>;
  return typeof obj.rule === "string";
}

function parseRuleTriggers(raw: unknown): RuleTrigger[] {
  let value: unknown = raw;
  for (let i = 0; i < 2; i++) {
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        value = null;
      }
    } else {
      break;
    }
  }
  if (!Array.isArray(value)) return [];
  return value.filter(isRuleTrigger);
}

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function statusColor(status: SignalStatus): string {
  return status === "critical" ? "#ef4444" : status === "warn" ? "#f59e0b" : "#22c55e";
}

const statusPill: Record<string, string> = {
  approved: "bg-[#22c55e]/10 text-[#22c55e]",
  flagged: "bg-[#f59e0b]/10 text-[#f59e0b]",
  blocked: "bg-[#ef4444]/10 text-[#ef4444]",
  pending: "bg-[#3b82f6]/10 text-[#3b82f6]",
};

function guessFraudType(tx: Transaction): string {
  if (tx.transaction_type === "transfer") return "wire_fraud";
  if (tx.transaction_type === "withdrawal") return "rapid_cashout";
  if (tx.transaction_type === "purchase" || tx.transaction_type === "payment") return "card_not_present";
  return "account_takeover";
}

type DrawerAction = "blocked" | "flagged" | "approved" | "confirmed_fraud";

const actionMeta: Record<DrawerAction, { notice: string; trigger: string; severity: string }> = {
  blocked: { notice: "Transaction blocked", trigger: "Manually Blocked by Analyst", severity: "critical" },
  flagged: { notice: "Transaction flagged for review", trigger: "Manually Flagged for Review", severity: "high" },
  approved: { notice: "Transaction approved", trigger: "Manually Approved", severity: "low" },
  confirmed_fraud: { notice: "Marked as confirmed fraud", trigger: "Confirmed Fraud", severity: "critical" },
};

function Section({ title, icon, right, children }: { title: string; icon?: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="glass rounded-2xl p-6 space-y-4 mb-7 break-inside-avoid">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#64748b] uppercase tracking-widest flex items-center gap-2">
          {icon}
          {title}
        </span>
        {right}
      </div>
      {children}
    </div>
  );
}

function SignalRow({ s }: { s: Signal }) {
  const color = statusColor(s.status);
  return (
    <div className="flex items-center gap-3.5 p-4 rounded-xl bg-[#111827] border border-[#1e293b]">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-white">{s.label}</span>
          <span className="text-[11px] font-mono uppercase" style={{ color }}>{s.status}</span>
        </div>
        <p className="text-xs text-[#64748b] truncate">{s.detail}</p>
      </div>
    </div>
  );
}

function MiniBar({ label, value }: { label: string; value: number }) {
  const color = value > 0.7 ? "#ef4444" : value > 0.4 ? "#f59e0b" : "#00f0ff";
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 shrink-0 text-xs text-[#94a3b8] truncate">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-[#1e293b] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, value * 100)}%`, background: color, boxShadow: value > 0.7 ? "0 0 8px rgba(239,68,68,0.5)" : "none" }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-xs font-mono text-[#64748b]">{Math.round(value * 100)}</span>
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl bg-[#111827] border border-[#1e293b] px-4 py-3.5">
      <span className="block text-[11px] uppercase tracking-wider text-[#64748b]">{label}</span>
      <span className="block text-lg font-semibold text-white mt-1 tabular-nums" style={accent ? { color: accent } : undefined}>{value}</span>
    </div>
  );
}

function RelatedRow({ t }: { t: Transaction }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-[#94a3b8] truncate flex-1">{t.merchant}</span>
      <span className="text-sm text-white tabular-nums">${t.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
      <span className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize ${statusPill[t.status] || ""}`}>{t.status}</span>
      <span className="text-[#64748b] whitespace-nowrap">{relativeTime(t.timestamp)}</span>
    </div>
  );
}

export default function TransactionDrawer({ tx, onClose, onUpdated, canModerate = true, canTriage = false }: Props) {
  const { user } = useAuth();
  const [current, setCurrent] = useState<Transaction | null>(tx);
  const [prevTx, setPrevTx] = useState<Transaction | null>(tx);
  const [updating, setUpdating] = useState<DrawerAction | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [related, setRelated] = useState<Transaction[]>([]);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [caseOpen, setCaseOpen] = useState(false);
  const [caseSaving, setCaseSaving] = useState(false);
  const [caseNotice, setCaseNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [caseForm, setCaseForm] = useState({ title: "", description: "", severity: "medium", fraud_type: "other", amount_at_risk: "", assigned_to: "" });
  const [assignees, setAssignees] = useState<{ id: string; full_name: string; email: string; role: string }[]>([]);

  useEffect(() => {
    supabase.listUsers().then((rows) =>
      setAssignees(rows.filter((u) => u.role === "investigator" || u.role === "admin")),
    );
  }, []);

  if (tx !== prevTx) {
    setPrevTx(tx);
    setCurrent(tx);
  }

  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    supabase.getRelatedTransactions(current).then((rows) => {
      if (!cancelled) {
        setRelated(rows);
        setAnalysisLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [current]);

  const analysis = useMemo(() => (current ? computeAnalysis(current, related) : null), [current, related]);

  if (!current || !analysis) return null;

  const riskColor = current.risk_level === "critical" ? "#ef4444" : current.risk_level === "high" ? "#f59e0b" : current.risk_level === "medium" ? "#3b82f6" : "#22c55e";
  const { signals, breakdown, accountStats, related: relatedGroups, deviceType, distanceFromHomeKm, merchantRisk, recommendations } = analysis;

  const runAction = async (action: DrawerAction) => {
    setUpdating(action);
    setNotice(null);
    setMoreOpen(false);

    const meta = actionMeta[action];
    let updates: Partial<Transaction> = { status: action };
    if (action === "confirmed_fraud") {
      updates = { status: "blocked", is_fraud: true, is_suspicious: true, risk_level: "critical" };
    }

    const res = await supabase.updateTransactionStatus(current.id, updates);
    if (!res.success) {
      setNotice({ type: "error", text: res.error || "Action failed" });
      setUpdating(null);
      return;
    }

    const triggers = parseRuleTriggers(current.rule_triggers);
    triggers.push({ rule: meta.trigger, severity: meta.severity });
    setCurrent({ ...current, ...updates, rule_triggers: triggers });
    setNotice({ type: "success", text: meta.notice });
    setUpdating(null);
    onUpdated?.();
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(current.transaction_id);
      setNotice({ type: "success", text: "Transaction ID copied" });
    } catch {
      setNotice({ type: "error", text: "Could not copy to clipboard" });
    }
    setMoreOpen(false);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(current, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${current.transaction_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMoreOpen(false);
  };

  const openCaseFromTx = () => {
    setCaseForm({
      title: `Fraud: ${current.merchant}`,
      description: `$${current.amount.toLocaleString()} at ${current.merchant} (${current.merchant_category}) via ${current.channel}. ${current.risk_level} risk — ML probability ${((current.ml_fraud_probability || 0) * 100).toFixed(0)}%.`,
      severity: current.risk_level === "low" ? "medium" : current.risk_level,
      fraud_type: guessFraudType(current),
      amount_at_risk: String(current.amount),
      assigned_to: "",
    });
    setCaseNotice(null);
    setMoreOpen(false);
    setCaseOpen(true);
  };

  const submitCase = async (e: React.FormEvent) => {
    e.preventDefault();
    setCaseSaving(true);
    setCaseNotice(null);
    const res = await supabase.createCase({
      title: caseForm.title.trim(),
      description: caseForm.description.trim() || undefined,
      severity: caseForm.severity as "low" | "medium" | "high" | "critical",
      fraud_type: caseForm.fraud_type,
      amount_at_risk: caseForm.amount_at_risk ? Number(caseForm.amount_at_risk) : undefined,
      assigned_to: caseForm.assigned_to || undefined,
      assigned_by: user?.id || undefined,
      transaction_id: current.id,
    });
    setCaseSaving(false);
    if (!res.success) {
      setCaseNotice({ type: "error", text: res.error || "Failed to create case" });
      return;
    }
    setCaseNotice({ type: "success", text: "Case created and linked to transaction" });
    setCaseOpen(false);
    onUpdated?.();
  };

  const isBlocked = current.status === "blocked";
  const isFlagged = current.status === "flagged";

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-10 animate-fade-in">
        <div className="w-full max-w-[1500px] h-full lg:h-auto lg:max-h-[90vh] flex flex-col rounded-2xl overflow-hidden scan-line border border-[#1e293b]" style={{ background: "#0a0e1a", boxShadow: "0 25px 80px rgba(0,0,0,0.65)" }}>
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between px-10 h-20 border-b border-[#1e293b] shrink-0">
            <div className="flex items-center gap-3.5">
              <div className="w-2.5 h-2.5 rounded-full animate-glow-pulse" style={{ background: riskColor, boxShadow: `0 0 6px ${riskColor}` }} />
              <h2 className="text-base font-semibold text-white">Transaction Detail</h2>
              <span className="font-mono text-sm text-[#94a3b8]">{current.transaction_id}</span>
            </div>
            <button onClick={onClose} data-action="close-drawer" className="w-10 h-10 rounded-lg flex items-center justify-center text-[#64748b] hover:text-white hover:bg-[#1e293b] transition-all">
              <Icons.x size={18} />
            </button>
          </div>

          {notice && (
            <div className={`px-10 py-3.5 text-sm font-medium ${notice.type === "success" ? "text-[#22c55e] bg-[#22c55e]/10" : "text-[#ef4444] bg-[#ef4444]/10"}`}>
              {notice.text}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-10">
            <div className="columns-1 xl:columns-2 2xl:columns-3 gap-7">
            <Section title="Transaction Info" icon={<Icons.fileText size={14} />}>
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-6">
                {[
                  { label: "Amount", value: `$${current.amount.toLocaleString()}` },
                  { label: "Type", value: current.transaction_type },
                  { label: "Channel", value: current.channel },
                  { label: "Status", value: current.status },
                  { label: "Merchant", value: current.merchant },
                  { label: "Category", value: current.merchant_category },
                  { label: "Date", value: new Date(current.timestamp).toLocaleString() },
                  { label: "Currency", value: current.currency },
                ].map((f) => (
                  <div key={f.label}>
                    <span className="block text-xs text-[#64748b]">{f.label}</span>
                    <span className="text-base font-medium text-white capitalize">{f.value}</span>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="ML Risk Assessment" icon={<Icons.cpu size={14} />} right={<span className="text-xs font-mono text-[#64748b]">risk score {current.risk_score}</span>}>
              <div className="flex items-center gap-6 flex-wrap">
                <div className="relative w-28 h-28 shrink-0">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="#1e293b" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke={riskColor} strokeWidth="3"
                      strokeDasharray={`${(current.ml_fraud_probability || 0) * 100} 100`}
                      strokeLinecap="round"
                      style={{ transition: "stroke-dasharray 1s ease" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-2xl font-bold text-white">{((current.ml_fraud_probability || 0) * 100).toFixed(0)}%</span>
                    <span className="text-[10px] text-[#64748b]">fraud prob</span>
                  </div>
                </div>
                <div className="flex-1 min-w-[260px] space-y-2.5">
                  {breakdown.map((b) => (
                    <MiniBar key={b.label} label={b.label} value={b.value} />
                  ))}
                </div>
              </div>
            </Section>

            <Section title="Signal Analysis" icon={<Icons.activity size={14} />} right={<span className="text-xs font-mono text-[#64748b]">{signals.filter((s) => s.status !== "clean").length} alerts</span>}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {signals.map((s) => (
                  <SignalRow key={s.key} s={s} />
                ))}
              </div>
            </Section>

            <Section title="Account Behavior" icon={<Icons.trendingUp size={14} />}>
              {analysisLoading ? (
                <p className="text-sm text-[#64748b]">Analyzing account history...</p>
              ) : (
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-3.5">
                  <StatBox label="Avg Amount" value={`$${accountStats.avgAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
                  <StatBox label="Max Amount" value={`$${accountStats.maxAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
                  <StatBox label="Last 24h" value={`${accountStats.last24hCount} txns`} accent={accountStats.last24hCount >= 5 ? "#f59e0b" : undefined} />
                  <StatBox label="Last 7 days" value={`${accountStats.last7dCount} txns`} accent={accountStats.last7dCount >= 20 ? "#f59e0b" : undefined} />
                  <StatBox label="Recent Volume" value={`${accountStats.total} txns`} />
                  <StatBox
                    label="This Amount vs Avg"
                    value={accountStats.avgAmount > 0 ? `${(current.amount / accountStats.avgAmount).toFixed(1)}x` : "—"}
                    accent={accountStats.avgAmount > 0 && current.amount / accountStats.avgAmount >= 2 ? "#ef4444" : undefined}
                  />
                </div>
              )}
            </Section>

            <Section title="Related Activity" icon={<Icons.nodes size={14} />} right={analysisLoading ? undefined : <span className="text-xs font-mono text-[#64748b]">{related.length} related</span>}>
              {analysisLoading ? (
                <p className="text-sm text-[#64748b]">Fetching related transactions...</p>
              ) : relatedGroups.length === 0 ? (
                <p className="text-sm text-[#64748b]">No related transactions found</p>
              ) : (
                <div className="grid grid-cols-1 gap-3.5">
                  {relatedGroups.map((g) => (
                    <div key={g.key} className="rounded-xl bg-[#111827] border border-[#1e293b] p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white">{g.label}</span>
                        <span className="text-xs font-mono text-[#64748b]">{g.count} txns</span>
                      </div>
                      <div className="space-y-2.5">
                        {g.recent.map((t) => (
                          <RelatedRow key={t.id} t={t} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Geo & Device" icon={<Icons.fingerprint size={14} />}>
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-6">
                <div>
                  <span className="block text-xs text-[#64748b]">Account</span>
                  <span className="text-base font-medium text-white">{current.account_name || current.account_id}</span>
                </div>
                <div>
                  <span className="block text-xs text-[#64748b]">Card</span>
                  <span className="text-base font-medium text-white font-mono">•••• {current.card_last_four}</span>
                </div>
                <div>
                  <span className="block text-xs text-[#64748b]">Device</span>
                  <span className="text-base font-medium text-white">{deviceType}</span>
                </div>
                <div>
                  <span className="block text-xs text-[#64748b]">Device ID</span>
                  <span className="text-base font-medium text-white font-mono text-sm">{current.device_id || "N/A"}</span>
                </div>
                <div>
                  <span className="block text-xs text-[#64748b]">IP Address</span>
                  <span className="text-base font-medium text-white font-mono">{current.ip_address || "N/A"}</span>
                </div>
                <div>
                  <span className="block text-xs text-[#64748b]">Distance from Home</span>
                  <span className="text-base font-medium text-white">{distanceFromHomeKm !== null ? `${distanceFromHomeKm.toLocaleString()} km` : "N/A"}</span>
                </div>
                <div>
                  <span className="block text-xs text-[#64748b]">Region</span>
                  <span className="text-base font-medium text-white">{current.region || current.country || "N/A"}</span>
                </div>
                <div>
                  <span className="block text-xs text-[#64748b]">Coordinates</span>
                  <span className="text-base font-medium text-white font-mono text-sm">{current.latitude ? `${current.latitude.toFixed(2)}, ${current.longitude?.toFixed(2)}` : "N/A"}</span>
                </div>
                <div>
                  <span className="block text-xs text-[#64748b]">Merchant Risk</span>
                  <span className="text-base font-medium capitalize" style={{ color: merchantRisk === "high" ? "#ef4444" : merchantRisk === "medium" ? "#f59e0b" : "#22c55e" }}>{merchantRisk}</span>
                </div>
                <div>
                  <span className="block text-xs text-[#64748b]">IP History</span>
                  <span className="text-base font-medium text-white">{analysisLoading ? "…" : analysis.ipSeenBefore ? "Seen previously" : "First sighting"}</span>
                </div>
              </div>
            </Section>

            <Section title="Rule Triggers" icon={<Icons.listChecks size={14} />}>
              {(() => {
                const triggers = parseRuleTriggers(current.rule_triggers);
                return triggers.length > 0 ? (
                  <div className="space-y-2.5">
                    {triggers.map((r, i) => (
                      <div key={i} className="flex items-center gap-3.5 p-4 rounded-xl bg-[#111827] border border-[#1e293b]">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${r.severity === "critical" ? "bg-red-500" : r.severity === "high" ? "bg-amber-500" : r.severity === "medium" ? "bg-blue-500" : "bg-emerald-500"}`} />
                        <span className="text-sm text-white flex-1">{r.rule}</span>
                        <span className="text-xs font-semibold uppercase text-[#64748b]">{r.severity}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#64748b]">No rules triggered for this transaction</p>
                );
              })()}
            </Section>

            <Section title="Recommendations" icon={<Icons.shieldCheck size={14} />} right={<span className="text-xs font-mono text-[#64748b]">{recommendations.filter((r) => !r.startsWith("No immediate")).length} actions</span>}>
              <div className="space-y-2.5">
                {recommendations.map((r, i) => (
                  <div key={i} className={`flex items-start gap-3 p-4 rounded-xl border ${r.startsWith("No immediate") ? "bg-[#111827] border-[#1e293b]" : "bg-[#f59e0b]/5 border-[#f59e0b]/20"}`}>
                    {r.startsWith("No immediate") ? <Icons.checkCircle size={16} className="mt-0.5 shrink-0 text-[#22c55e]" /> : <Icons.alertTriangle size={16} className="mt-0.5 shrink-0 text-[#f59e0b]" />}
                    <span className="text-sm text-[#cbd5e1]">{r}</span>
                  </div>
                ))}
              </div>
            </Section>
            </div>
          </div>

          <div className="px-10 py-5 border-t border-[#1e293b] flex gap-3 relative">
            {canModerate ? (
              <>
            <button
              onClick={() => runAction("blocked")}
              disabled={!!updating || isBlocked}
              data-action="blocked"
              className={`flex-1 h-12 rounded-xl text-white text-sm font-semibold shadow-lg transition-all flex items-center justify-center gap-2 ${
                isBlocked
                  ? "bg-[#1e293b] border border-[#334155] cursor-not-allowed"
                  : "bg-gradient-to-r from-[#ef4444] to-[#ec4899] hover:shadow-red-500/20"
              }`}
            >
              {updating === "blocked" ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : null}
              {isBlocked ? "Blocked" : "Block Transaction"}
            </button>
            <div className="relative">
              <button
                onClick={() => setMoreOpen((o) => !o)}
                data-action="more"
                className="w-12 h-12 rounded-xl bg-[#1e293b] border border-[#334155] flex items-center justify-center text-[#64748b] hover:text-white hover:border-[#00f0ff]/30 transition-all"
              >
                <Icons.moreHorizontal size={18} />
              </button>
              {moreOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                  <div className="absolute bottom-12 right-0 z-50 w-60 rounded-xl bg-[#111827] border border-[#334155] shadow-2xl overflow-hidden animate-fade-in">
                    <div className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[#64748b] border-b border-[#1e293b]">More Actions</div>
                    {[
                      { icon: <Icons.shield size={16} />, label: "Open Fraud Case", onClick: openCaseFromTx, action: "open_case" },
                      { icon: <Icons.checkCircle size={16} />, label: "Approve Transaction", onClick: () => runAction("approved"), action: "approved" },
                      { icon: <Icons.alertTriangle size={16} />, label: "Mark as Confirmed Fraud", onClick: () => runAction("confirmed_fraud"), action: "confirmed_fraud", danger: true },
                      { icon: <Icons.fileText size={16} />, label: "Export JSON", onClick: exportJson },
                      { icon: <Icons.refresh size={16} />, label: "Copy Transaction ID", onClick: copyId },
                    ].map((item, i) => (
                      <button
                        key={i}
                        onClick={item.onClick}
                        disabled={!!updating}
                        data-action={item.action || undefined}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${
                          item.danger ? "text-[#ef4444] hover:bg-[#ef4444]/10" : "text-[#cbd5e1] hover:bg-white/5"
                        }`}
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
              </>
            ) : canTriage ? (
              <>
            <button
              onClick={() => runAction("flagged")}
              disabled={!!updating || isFlagged}
              data-action="flagged"
              className={`flex-1 h-12 rounded-xl text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                isFlagged
                  ? "bg-[#1e293b] border border-[#334155] cursor-not-allowed"
                  : "bg-[#1e293b] border border-[#334155] hover:border-[#00f0ff]/30"
              }`}
            >
              {updating === "flagged" ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : null}
              {isFlagged ? "Flagged" : "Flag for Review"}
            </button>
            <button
              onClick={openCaseFromTx}
              className="flex-1 h-12 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#00f0ff] text-white text-sm font-semibold shadow-lg hover:shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Icons.shield size={16} /> Open Case
            </button>
              </>
            ) : (
              <div className="flex-1 h-12 rounded-xl bg-[#1e293b]/50 border border-[#334155] flex items-center justify-center gap-2 text-xs text-[#64748b]">
                <Icons.shield size={14} /> Read-only view — analysts can flag and open cases
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      {caseOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setCaseOpen(false)} />
          <form onSubmit={submitCase} className="relative w-full max-w-lg rounded-2xl border border-[#334155] p-6 space-y-4 scan-line" style={{ background: "#0a0e1a" }}>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-white">Open Fraud Case</h4>
                <p className="text-xs text-[#64748b] mt-0.5">Linked to {current.transaction_id}</p>
              </div>
              <button type="button" onClick={() => setCaseOpen(false)} className="w-9 h-9 rounded-lg flex items-center justify-center text-[#64748b] hover:text-white hover:bg-[#1e293b] transition-all">
                <Icons.x size={16} />
              </button>
            </div>

            {caseNotice && (
              <div className={`px-4 py-2.5 rounded-xl text-xs font-medium ${caseNotice.type === "success" ? "bg-[#22c55e]/10 text-[#22c55e]" : "bg-[#ef4444]/10 text-[#ef4444]"}`}>
                {caseNotice.text}
              </div>
            )}

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#64748b] mb-1">Title</label>
              <input required value={caseForm.title} onChange={(e) => setCaseForm({ ...caseForm, title: e.target.value })} data-field="case_title" className="w-full h-10 px-3 rounded-lg text-xs bg-[#1e293b] border border-[#334155] text-white outline-none focus:border-[#00f0ff]/30" />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#64748b] mb-1">Description</label>
              <textarea value={caseForm.description} onChange={(e) => setCaseForm({ ...caseForm, description: e.target.value })} rows={2} data-field="case_description" className="w-full px-3 py-2 rounded-lg text-xs bg-[#1e293b] border border-[#334155] text-white outline-none focus:border-[#00f0ff]/30 resize-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#64748b] mb-1">Severity</label>
                <select value={caseForm.severity} onChange={(e) => setCaseForm({ ...caseForm, severity: e.target.value })} data-field="case_severity" className="w-full h-10 px-3 rounded-lg text-xs bg-[#1e293b] border border-[#334155] text-white outline-none focus:border-[#00f0ff]/30">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#64748b] mb-1">Fraud Type</label>
                <select value={caseForm.fraud_type} onChange={(e) => setCaseForm({ ...caseForm, fraud_type: e.target.value })} data-field="case_fraud_type" className="w-full h-10 px-3 rounded-lg text-xs bg-[#1e293b] border border-[#334155] text-white outline-none focus:border-[#00f0ff]/30">
                  {["account_takeover", "rapid_cashout", "geo_anomaly", "wire_fraud", "card_not_present", "identity_theft", "other"].map((f) => (
                    <option key={f} value={f}>{f.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#64748b] mb-1">Amount at Risk</label>
                <input type="number" min="0" step="0.01" value={caseForm.amount_at_risk} onChange={(e) => setCaseForm({ ...caseForm, amount_at_risk: e.target.value })} data-field="case_amount" className="w-full h-10 px-3 rounded-lg text-xs bg-[#1e293b] border border-[#334155] text-white outline-none focus:border-[#00f0ff]/30" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#64748b] mb-1">Assign To</label>
                <select value={caseForm.assigned_to} onChange={(e) => setCaseForm({ ...caseForm, assigned_to: e.target.value })} className="w-full h-10 px-3 rounded-lg text-xs bg-[#1e293b] border border-[#334155] text-white outline-none focus:border-[#00f0ff]/30">
                  <option value="">Unassigned</option>
                  {assignees.map((a) => (
                    <option key={a.id} value={a.id}>{a.full_name || a.email}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={caseSaving} data-field="case_submit" className="flex-1 h-10 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#00f0ff] text-white text-xs font-semibold shadow-lg hover:shadow-blue-500/20 transition-all disabled:opacity-50">
                {caseSaving ? "Creating..." : "Create Case"}
              </button>
              <button type="button" onClick={() => setCaseOpen(false)} className="h-10 px-4 rounded-xl bg-[#1e293b] border border-[#334155] text-[#64748b] text-xs hover:text-white transition-all">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
