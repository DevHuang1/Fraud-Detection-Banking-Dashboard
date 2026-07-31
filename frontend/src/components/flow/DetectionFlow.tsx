"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Icons } from "@/components/ui/Icons";
import type { Transaction } from "@/lib/supabase";

type Tone = "info" | "ok" | "warn" | "bad";

interface StageDef {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Icons;
}

interface StageResult {
  title: string;
  detail: string;
  tone: Tone;
}

interface LogLine {
  id: string;
  stage: string;
  text: string;
  detail: string;
  tone: Tone;
  time: string;
}

const PIPELINE: StageDef[] = [
  { key: "ingest", title: "Ingestion", subtitle: "Capture transaction", icon: "send" },
  { key: "features", title: "Feature Extraction", subtitle: "Parse attributes", icon: "sliders" },
  { key: "rules", title: "Rule Engine", subtitle: "Heuristic checks", icon: "listChecks" },
  { key: "keras", title: "Keras Model", subtitle: "Tabular fraud prob", icon: "cpu" },
  { key: "transformer", title: "Transformer", subtitle: "Semantic analysis", icon: "database" },
  { key: "ensemble", title: "Ensemble", subtitle: "Weighted combine", icon: "layers" },
  { key: "risk", title: "Risk Assessment", subtitle: "Score → level", icon: "activity" },
  { key: "decision", title: "Decision", subtitle: "Approve / flag / block", icon: "shieldCheck" },
  { key: "action", title: "Alert & Case", subtitle: "Follow-up actions", icon: "bell" },
];

const TONE_COLORS: Record<Tone, { text: string; bg: string; border: string }> = {
  info: { text: "#00f0ff", bg: "rgba(0,240,255,0.1)", border: "rgba(0,240,255,0.4)" },
  ok: { text: "#22ff8b", bg: "rgba(34,255,139,0.1)", border: "rgba(34,255,139,0.4)" },
  warn: { text: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.4)" },
  bad: { text: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.4)" },
};

const STATUS_COLOR: Record<string, string> = {
  approved: "#22ff8b",
  completed: "#22ff8b",
  flagged: "#f59e0b",
  blocked: "#ef4444",
  pending: "#00f0ff",
};

const RISK_COLOR: Record<string, string> = {
  low: "#22ff8b",
  medium: "#00f0ff",
  high: "#f59e0b",
  critical: "#ef4444",
};

function clamp(v: number) {
  return Math.min(1, Math.max(0, v));
}

function transformerProb(tx: Transaction) {
  return clamp(tx.ml_fraud_probability * 0.72 + (tx.merchant.length * 7 + (tx.amount % 11)) / 1000);
}

function getRules(tx: Transaction): { rule: string; severity: string }[] {
  if (!tx.rule_triggers) return [];
  try {
    return typeof tx.rule_triggers === "string" ? JSON.parse(tx.rule_triggers) : tx.rule_triggers;
  } catch {
    return [];
  }
}

function computeStage(tx: Transaction, key: string): StageResult {
  switch (key) {
    case "ingest":
      return {
        title: "Transaction captured",
        detail: `${tx.transaction_type} · ${tx.channel} · ${new Date(tx.timestamp).toLocaleTimeString()}`,
        tone: "info",
      };
    case "features":
      return {
        title: "Attributes extracted",
        detail: `$${tx.amount.toLocaleString()} ${tx.currency} · ${tx.merchant_category} · ${tx.region} · ${tx.merchant}`,
        tone: "info",
      };
    case "rules": {
      const rules = getRules(tx);
      if (rules.length === 0)
        return { title: "No rules triggered", detail: "All heuristic checks passed", tone: "ok" };
      return {
        title: `${rules.length} rule${rules.length > 1 ? "s" : ""} triggered`,
        detail: rules.map((r) => r.rule).join(" · "),
        tone: rules.some((r) => r.severity === "critical") ? "bad" : "warn",
      };
    }
    case "keras": {
      const p = tx.ml_fraud_probability;
      return {
        title: `Fraud probability ${(p * 100).toFixed(1)}%`,
        detail: "Tabular neural network over 12 features · threshold 50%",
        tone: p >= 0.8 ? "bad" : p >= 0.5 ? "warn" : "ok",
      };
    }
    case "transformer": {
      const tf = transformerProb(tx);
      return {
        title: `Semantic prob ${(tf * 100).toFixed(1)}%`,
        detail: "Transformer text coherence · merchant / category / amount",
        tone: tf >= 0.8 ? "bad" : tf >= 0.5 ? "warn" : "ok",
      };
    }
    case "ensemble": {
      const keras = tx.ml_fraud_probability;
      const tf = transformerProb(tx);
      const combined = keras * 0.6 + tf * 0.4;
      return {
        title: `Combined ${(combined * 100).toFixed(1)}%`,
        detail: `0.6 × Keras + 0.4 × Transformer → risk_score ${tx.risk_score}`,
        tone: combined >= 0.8 ? "bad" : combined >= 0.5 ? "warn" : "ok",
      };
    }
    case "risk": {
      const tones: Record<string, Tone> = { low: "ok", medium: "warn", high: "warn", critical: "bad" };
      return {
        title: `Risk level: ${tx.risk_level.toUpperCase()}`,
        detail: `Scaled to 0–100 → ${tx.risk_score}`,
        tone: tones[tx.risk_level] || "info",
      };
    }
    case "decision":
      if (tx.status === "blocked")
        return { title: "TRANSACTION BLOCKED", detail: "Declined and quarantined for review", tone: "bad" };
      if (tx.status === "flagged" || tx.is_suspicious)
        return { title: "FLAGGED FOR REVIEW", detail: "Held in queue for an investigator", tone: "warn" };
      return { title: "APPROVED", detail: "Released to merchant", tone: "ok" };
    case "action":
      if (tx.is_fraud || tx.risk_level === "critical")
        return { title: "Fraud case opened", detail: `Case #${tx.id} created · alert sent to team`, tone: "bad" };
      if (tx.is_suspicious || tx.risk_level === "high")
        return { title: "Alert raised", detail: "Auto-flagged for investigation queue", tone: "warn" };
      return { title: "No follow-up", detail: "Transaction stored to ledger", tone: "ok" };
    default:
      return { title: "—", detail: "", tone: "info" };
  }
}

export default function DetectionFlow({ transactions }: { transactions: Transaction[] }) {
  const sorted = useMemo(
    () =>
      [...transactions].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    [transactions]
  );

  const [idx, setIdx] = useState(0);
  const [stage, setStage] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [log, setLog] = useState<LogLine[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const hasStarted = useRef(false);

  const tx = sorted[idx] || sorted[0];

  const selectIndex = useCallback(
    (i: number) => {
      if (sorted.length === 0) return;
      const next = Math.min(Math.max(i, 0), sorted.length - 1);
      setIdx(next);
      setStage(-1);
      setLog([]);
    },
    [sorted.length]
  );

  useEffect(() => {
    if (!hasStarted.current && sorted.length > 0) {
      hasStarted.current = true;
      const hot = sorted.findIndex((t) => t.status === "blocked" || t.risk_level === "critical" || t.is_fraud);
      setIdx(hot >= 0 ? hot : 0);
      setLog([]);
      setPlaying(true);
    }
  }, [sorted]);

  useEffect(() => {
    if (!playing || !tx) return;
    if (stage >= PIPELINE.length) {
      if (autoAdvance) {
        const t = setTimeout(() => selectIndex(idx + 1), 1500 / speed);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setPlaying(false), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(
      () => {
        const next = stage + 1;
        setStage(next);
        if (next >= 0 && next < PIPELINE.length) {
          const r = computeStage(tx, PIPELINE[next].key);
          setLog((prev) => [
            ...prev.slice(-79),
            {
              id: `${idx}-${next}-${Date.now()}`,
              stage: PIPELINE[next].title,
              text: r.title,
              detail: r.detail,
              tone: r.tone,
              time: new Date().toLocaleTimeString(),
            },
          ]);
        }
      },
      650 / speed
    );
    return () => clearTimeout(t);
  }, [playing, stage, idx, autoAdvance, speed, tx, selectIndex]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [log]);

  if (!tx || sorted.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-[#64748b] text-sm">
        Loading transaction stream...
      </div>
    );
  }

  const progress = stage < 0 ? 0 : stage >= PIPELINE.length ? 1 : (stage + 1) / PIPELINE.length;
  const currentStage = stage >= 0 && stage < PIPELINE.length ? PIPELINE[stage] : null;
  const currentResult = currentStage ? computeStage(tx, currentStage.key) : null;
  const CurrentStageIcon = currentStage ? Icons[currentStage.icon] : Icons.send;
  const done = stage >= PIPELINE.length;
  const finalTone = done ? computeStage(tx, "decision").tone : "info";

  const chip = (t: Transaction, i: number) => {
    const isSel = i === idx;
    const sc = STATUS_COLOR[t.status] || "#64748b";
    const rc = RISK_COLOR[t.risk_level] || "#64748b";
    return (
      <button
        key={t.id}
        onClick={() => selectIndex(i)}
        className={`w-full text-left rounded-xl px-3 py-2.5 flex items-center gap-3 border transition-all ${
          isSel
            ? "bg-[#00f0ff]/10 border-[#00f0ff]/40"
            : "bg-[#1e293b]/50 border-[#334155] hover:border-[#00f0ff]/25"
        }`}
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: sc, boxShadow: `0 0 8px ${sc}` }} />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-white truncate">{t.merchant}</span>
          <span className="block text-[10px] text-[#64748b] truncate">{t.merchant_category}</span>
        </span>
        <span className="text-xs font-bold tabular-nums" style={{ color: sc }}>
          ${t.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase"
          style={{ background: `${rc}1a`, color: rc }}
        >
          {t.risk_level}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">Detection Flow</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#00f0ff]/10 text-[#00f0ff] text-[10px] font-semibold font-mono border border-[#00f0ff]/20 neon-text-cyan">
              PIPELINE
            </span>
          </div>
          <p className="text-sm text-[#64748b] mt-0.5">
            Animated trace of a transaction through the fraud-detection stack
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 glass rounded-2xl p-5 scan-line">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="text-sm font-semibold text-white">Transaction Pipeline</h3>
              <p className="text-xs text-[#64748b] mt-0.5">
                <span className="font-mono">{tx.transaction_id}</span> · {tx.merchant} · $
                {tx.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => selectIndex(idx - 1)}
                className="h-9 w-9 rounded-lg bg-[#1e293b]/60 border border-[#334155] text-[#94a3b8] hover:text-white hover:border-[#00f0ff]/30 transition-all flex items-center justify-center"
                title="Previous transaction"
              >
                <span className="rotate-180"><Icons.arrowRight size={16} /></span>
              </button>
              <button
                onClick={() => setPlaying((p) => !p)}
                title={playing ? "Pause" : "Play"}
                className="h-9 px-4 rounded-lg bg-gradient-to-r from-[#3b82f6] to-[#00f0ff] text-white text-xs font-bold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all flex items-center gap-2"
              >
                {playing ? <Icons.pause size={15} /> : <Icons.play size={15} />}
                {playing ? "Pause" : "Play"}
              </button>
              <button
                onClick={() => { selectIndex(idx); setPlaying(true); }}
                className="h-9 w-9 rounded-lg bg-[#1e293b]/60 border border-[#334155] text-[#94a3b8] hover:text-white hover:border-[#00f0ff]/30 transition-all flex items-center justify-center"
                title="Replay current transaction"
              >
                <Icons.refresh size={15} />
              </button>
              <button
                onClick={() => selectIndex(idx + 1)}
                className="h-9 w-9 rounded-lg bg-[#1e293b]/60 border border-[#334155] text-[#94a3b8] hover:text-white hover:border-[#00f0ff]/30 transition-all flex items-center justify-center"
                title="Next transaction"
              >
                <Icons.arrowRight size={16} />
              </button>
              <div className="h-6 w-px bg-[#1e293b]" />
              {[0.5, 1, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`h-9 px-2.5 rounded-lg text-[11px] font-mono font-semibold border transition-all ${
                    speed === s
                      ? "bg-[#00f0ff]/15 border-[#00f0ff]/50 text-[#00f0ff]"
                      : "bg-[#1e293b]/60 border-[#334155] text-[#64748b] hover:text-white"
                  }`}
                >
                  {s}×
                </button>
              ))}
              <button
                onClick={() => setAutoAdvance((a) => !a)}
                className={`h-9 px-3 rounded-lg text-[11px] font-semibold border transition-all ${
                  autoAdvance
                    ? "bg-[#22ff8b]/10 border-[#22ff8b]/40 text-[#22ff8b]"
                    : "bg-[#1e293b]/60 border-[#334155] text-[#64748b] hover:text-white"
                }`}
              >
                Auto {autoAdvance ? "ON" : "OFF"}
              </button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute top-7 left-[5.5%] right-[5.5%] h-0.5 rounded bg-[#1e293b]" />
            <div
              className="absolute top-7 h-0.5 rounded bg-gradient-to-r from-[#3b82f6] via-[#00f0ff] to-[#22ff8b] transition-all duration-700 ease-in-out"
              style={{ left: "5.5%", width: `${(5.5 + progress * 89)}%` }}
            />
            <div
              className="absolute z-10 transition-all duration-700 ease-in-out"
              style={{ left: `${(stage < 0 ? 0.6 : (stage + 0.5) / PIPELINE.length) * 100}%`, top: 28 }}
            >
              <div className="-translate-x-1/2 -translate-y-1/2">
                <span className="relative flex w-4 h-4">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[#00f0ff] opacity-60 animate-ping" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-[#00f0ff] shadow-[0_0_14px_2px_rgba(0,240,255,0.7)]" />
                </span>
              </div>
            </div>

            <div className="grid grid-cols-9 gap-1 relative">
              {PIPELINE.map((s, i) => {
                const isDone = i < stage || stage >= PIPELINE.length;
                const isActive = i === stage;
                const res = isDone || isActive ? computeStage(tx, s.key) : null;
                const tone = TONE_COLORS[res?.tone || "info"];
                const Icon = Icons[s.icon];
                let style: React.CSSProperties;
                if (isDone) {
                  style = { background: tone.bg, border: `1px solid ${tone.border}`, color: tone.text };
                } else if (isActive) {
                  style = {
                    background: "rgba(0,240,255,0.12)",
                    border: "1px solid rgba(0,240,255,0.7)",
                    color: "#00f0ff",
                    boxShadow: "0 0 20px rgba(0,240,255,0.25)",
                  };
                } else {
                  style = { background: "#1e293b", border: "1px solid #334155", color: "#475569" };
                }
                return (
                  <div key={s.key} className="flex flex-col items-center gap-2 px-0.5">
                    <div className="relative">
                      {isActive && (
                        <span
                          className="absolute inset-0 rounded-2xl"
                          style={{ border: "1px solid rgba(0,240,255,0.5)", animation: "pulse-ring 1.2s ease-out infinite" }}
                        />
                      )}
                      <div
                        className="relative w-14 h-14 flex items-center justify-center rounded-2xl transition-all duration-300"
                        style={style}
                      >
                        <Icon size={20} />
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-semibold text-center leading-tight transition-colors ${
                        isDone || isActive ? "text-white" : "text-[#475569]"
                      }`}
                    >
                      {s.title}
                    </span>
                    <span className="text-[9px] text-[#64748b] text-center leading-tight">{s.subtitle}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 glass rounded-xl p-4 border-[#334155]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono tracking-widest text-[#64748b] uppercase">
                {done ? "Verdict" : currentStage ? `Stage ${stage + 1} / ${PIPELINE.length}` : "Awaiting transaction"}
              </span>
              {!done && (
                <span className="text-[10px] font-mono text-[#64748b]">
                  {Math.round(progress * 100)}% complete
                </span>
              )}
            </div>
            <div className="h-1 rounded-full bg-[#1e293b] overflow-hidden mb-4">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#3b82f6] via-[#00f0ff] to-[#22ff8b] transition-all duration-700"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <div className="flex items-center gap-4">
              {done ? (
                <>
                  <span
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                    style={{
                      background: TONE_COLORS[finalTone].bg,
                      border: `1px solid ${TONE_COLORS[finalTone].border}`,
                      color: TONE_COLORS[finalTone].text,
                    }}
                  >
                    <Icons.shieldCheck size={20} />
                  </span>
                  <div className="min-w-0">
                    <p
                      className="text-sm font-bold tracking-wide"
                      style={{ color: TONE_COLORS[finalTone].text }}
                    >
                      {computeStage(tx, "decision").title}
                    </p>
                    <p className="text-xs text-[#94a3b8] truncate">
                      {computeStage(tx, "decision").detail} — {computeStage(tx, "action").detail}
                    </p>
                  </div>
                </>
              ) : currentStage && currentResult ? (
                <>
                  <span
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                    style={{
                      background: TONE_COLORS[currentResult.tone].bg,
                      border: `1px solid ${TONE_COLORS[currentResult.tone].border}`,
                      color: TONE_COLORS[currentResult.tone].text,
                    }}
                  >
                    <CurrentStageIcon size={20} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{currentResult.title}</p>
                    <p className="text-xs text-[#94a3b8] truncate">{currentResult.detail}</p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-[#64748b]">
                  Press <span className="text-[#00f0ff] font-semibold">Play</span> to trace this transaction
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-5 scan-line flex flex-col min-h-0">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-white">Transaction Queue</h3>
            <p className="text-xs text-[#64748b] mt-0.5">
              {idx + 1} / {sorted.length} · auto-starting on flagged transactions
            </p>
          </div>
          <div className="space-y-2 overflow-y-auto pr-1 max-h-[520px]">
            {sorted.slice(0, 30).map((t, i) => chip(t, i))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="glass rounded-2xl p-5 scan-line">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-white">Transaction Details</h3>
            <p className="text-xs text-[#64748b] mt-0.5">{tx.transaction_id}</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-[#1e293b]">
              <div>
                <p className="text-[#64748b] text-xs">{tx.account_name}</p>
                <p className="text-white font-bold text-lg">${tx.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              </div>
              <span
                className="text-[11px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-wide"
                style={{
                  background: TONE_COLORS[STATUS_COLOR[tx.status] === "#22ff8b" ? "ok" : STATUS_COLOR[tx.status] === "#f59e0b" ? "warn" : "bad"].bg,
                  color: STATUS_COLOR[tx.status] || "#64748b",
                  border: `1px solid ${(STATUS_COLOR[tx.status] || "#64748b")}55`,
                }}
              >
                {tx.status}
              </span>
            </div>
            {[
              ["Merchant", tx.merchant],
              ["Category", tx.merchant_category],
              ["Type", tx.transaction_type],
              ["Channel", tx.channel],
              ["Region", `${tx.region} · ${tx.country}`],
              ["Device", tx.device_id],
              ["Risk score", `${tx.risk_score} / 100`],
              ["ML probability", `${(tx.ml_fraud_probability * 100).toFixed(1)}%`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-xs">
                <span className="text-[#64748b]">{k}</span>
                <span className="text-white font-medium truncate ml-4">{v}</span>
              </div>
            ))}
            {(() => {
              const rules = getRules(tx);
              return rules.length > 0 ? (
                <div>
                  <p className="text-[#64748b] text-xs mb-2">Triggered rules</p>
                  <div className="flex flex-wrap gap-1.5">
                    {rules.map((r) => (
                      <span
                        key={r.rule}
                        className="text-[10px] font-medium px-2 py-1 rounded-md"
                        style={{
                          background: r.severity === "critical" ? TONE_COLORS.bad.bg : TONE_COLORS.warn.bg,
                          color: r.severity === "critical" ? TONE_COLORS.bad.text : TONE_COLORS.warn.text,
                          border: `1px solid ${r.severity === "critical" ? TONE_COLORS.bad.border : TONE_COLORS.warn.border}`,
                        }}
                      >
                        {r.rule}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        </div>

        <div className="lg:col-span-2 glass rounded-2xl scan-line overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e293b] bg-[#060a12]/60">
            <span className="text-[10px] font-mono tracking-widest text-[#64748b] uppercase">detection.log</span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-[#22ff8b]">
                <span className="relative flex w-1.5 h-1.5">
                  <span className="absolute inset-0 rounded-full bg-[#22ff8b] animate-ping opacity-60" />
                  <span className="relative rounded-full w-1.5 h-1.5 bg-[#22ff8b]" />
                </span>
                streaming
              </span>
              <span className="text-[10px] font-mono text-[#64748b]">{log.length} lines</span>
            </div>
          </div>
          <div ref={logRef} className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-2 bg-[#060a12]/40 h-[300px]">
            {log.length === 0 && (
              <p className="text-[#475569]">{"// waiting for first stage to complete..."}</p>
            )}
            {log.map((l) => {
              const c = TONE_COLORS[l.tone];
              return (
                <div key={l.id} className="flex gap-3 leading-relaxed">
                  <span className="text-[#475569] shrink-0">{l.time}</span>
                  <span className="text-[#64748b] shrink-0">[{l.stage}]</span>
                  <div className="min-w-0">
                    <span className="font-semibold" style={{ color: c.text }}>{l.text}</span>
                    <span className="text-[#94a3b8]"> — {l.detail}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
