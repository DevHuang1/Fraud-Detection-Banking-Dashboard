"use client";

import { useState, useEffect, useRef } from "react";
import { Icons } from "@/components/ui/Icons";
import { useAgent } from "@/context/AgentContext";
import { describeStep } from "@/lib/agent";

const statusBadge: Record<string, { text: string; cls: string }> = {
  idle: { text: "Idle", cls: "bg-[#1e293b] text-[#64748b] border-[#334155]" },
  planning: { text: "Planning…", cls: "bg-[#3b82f6]/15 text-[#00f0ff] border-[#3b82f6]/30" },
  running: { text: "Working…", cls: "bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30" },
  done: { text: "Done", cls: "bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30" },
  error: { text: "Error", cls: "bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30" },
};

const SUGGESTED = [
  "Investigate the highest-risk flagged transactions and block the ones that look fraudulent",
  "Review suspicious transactions, open a case on the worst one",
  "Summarize today's fraud stats and recent alerts",
  "Flag any critical-risk transactions for analyst review",
];

const levelColor: Record<string, string> = {
  info: "text-[#64748b]",
  action: "text-[#00f0ff]",
  success: "text-[#22c55e]",
  error: "text-[#ef4444]",
};

function StepIcon({ step, active }: { step: { type: string }; active: boolean }) {
  const cls = active ? "text-[#00f0ff]" : "text-[#475569]";
  switch (step.type) {
    case "navigate":
      return <Icons.dashboard size={14} className={cls} />;
    case "openTransaction":
      return <Icons.search size={14} className={cls} />;
    case "actTransaction":
      return <Icons.shield size={14} className={cls} />;
    case "createCase":
      return <Icons.fileText size={14} className={cls} />;
    case "read":
      return <Icons.eye size={14} className={cls} />;
    case "wait":
      return <Icons.clock size={14} className={cls} />;
    default:
      return <Icons.bot size={14} className={cls} />;
  }
}

export default function AiAgent() {
  const { status, logs, steps, currentStep, error, summary, keyConfigured, runTask, stop, clear, setKey } = useAgent();
  const [task, setTask] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const busy = status === "planning" || status === "running";
  const badge = statusBadge[status] || statusBadge.idle;

  return (
    <div className="glass-neon rounded-2xl overflow-hidden">
      <div className="p-5 pb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#1e293b]">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Icons.bot size={16} className="text-[#00f0ff]" /> AI Agent
            </h4>
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border flex items-center gap-1.5 ${badge.cls}`}>
              {busy && <span className="relative flex w-1.5 h-1.5"><span className="absolute inset-0 rounded-full bg-current" /><span className="absolute inset-0 rounded-full bg-current animate-ping opacity-60" /></span>}
              {badge.text}
            </span>
            {!keyConfigured && (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30">NO KEY</span>
            )}
          </div>
          <p className="text-xs text-[#64748b] mt-0.5 font-mono">Groq-powered agent that drives the workspace and does the work for you</p>
        </div>
        <div className="flex items-center gap-2">
          {busy ? (
            <button
              onClick={stop}
              className="h-9 px-4 rounded-xl bg-[#ef4444]/15 text-[#ef4444] text-xs font-semibold border border-[#ef4444]/30 hover:bg-[#ef4444]/25 transition-all flex items-center gap-1.5"
            >
              <Icons.x size={14} /> Stop
            </button>
          ) : (
            <button
              onClick={clear}
              disabled={logs.length === 0}
              className="h-9 px-4 rounded-xl bg-[#1e293b] border border-[#334155] text-[#64748b] text-xs font-semibold hover:text-white transition-all disabled:opacity-40"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
        <div className="p-5 space-y-4 border-b lg:border-b-0 lg:border-r border-[#1e293b]">
          {!keyConfigured && (
            <div className="p-4 rounded-xl bg-[#f59e0b]/5 border border-[#f59e0b]/25 space-y-3">
              <p className="text-xs text-[#cbd5e1]">
                <span className="text-[#f59e0b] font-semibold">Connect Groq.</span> Paste your Groq API key to let the agent work, or set <code className="text-[#00f0ff] font-mono">GROQ_API_KEY</code> in <code className="text-[#00f0ff] font-mono">.env.local</code> as a server default. A browser key is stored only in localStorage and sent straight to the dashboard&apos;s Groq proxy.
              </p>
              <div className="flex gap-2">
                <input
                  type={showKey ? "text" : "password"}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="gsk_..."
                  className="flex-1 h-9 px-3 rounded-lg text-xs bg-[#111827] border border-[#334155] text-white placeholder-[#4a5568] outline-none focus:border-[#00f0ff]/30"
                />
                <button
                  onClick={() => { setKey(keyInput); setKeyInput(""); }}
                  disabled={!keyInput.trim()}
                  className="h-9 px-4 rounded-lg bg-gradient-to-r from-[#f59e0b] to-[#00f0ff] text-white text-xs font-semibold disabled:opacity-40 transition-all"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowKey((s) => !s)}
                  className="w-9 h-9 rounded-lg bg-[#1e293b] border border-[#334155] flex items-center justify-center text-[#64748b] hover:text-white transition-all"
                >
                  <Icons.eye size={14} />
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#64748b] mb-1.5">What should the agent do?</label>
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              rows={3}
              placeholder='e.g. "Review the flagged high-risk transactions and block the fraudulent ones"'
              className="w-full px-3 py-2 rounded-lg text-xs bg-[#1e293b] border border-[#334155] text-white placeholder-[#4a5568] outline-none focus:border-[#00f0ff]/30 resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) runTask(task);
              }}
            />
            <button
              onClick={() => runTask(task)}
              disabled={busy || !task.trim() || !keyConfigured}
              className="mt-3 w-full h-10 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#00f0ff] text-white text-xs font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Working…
                </>
              ) : (
                <>
                  <Icons.play size={14} /> Run Agent
                </>
              )}
            </button>
            <p className="text-[10px] text-[#64748b] mt-1.5">Cmd/Ctrl + Enter to run</p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#64748b] mb-2">Try an example</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => setTask(s)}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-lg bg-[#1e293b] border border-[#334155] text-[#94a3b8] text-[11px] text-left hover:text-white hover:border-[#00f0ff]/30 transition-all disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {(steps.length > 0 || summary || error) && (
            <div className="p-4 rounded-xl bg-[#111827] border border-[#1e293b] space-y-3">
              {error && (
                <div className="text-xs text-[#ef4444] flex items-start gap-2">
                  <Icons.alertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
                </div>
              )}
              {steps.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-[#64748b]">Plan · {steps.length} steps</p>
                  {steps.map((step, i) => {
                    const isCurrent = i === currentStep;
                    const isDone = i < currentStep;
                    return (
                      <div key={i} className={`flex items-center gap-2 text-[11px] ${isDone ? "text-[#475569]" : isCurrent ? "text-[#e2e8f0]" : "text-[#94a3b8]"}`}>
                        <span className="w-4 shrink-0">
                          {isDone ? (
                            <Icons.checkCircle size={13} className="text-[#22c55e]" />
                          ) : (
                            <StepIcon step={step} active={isCurrent} />
                          )}
                        </span>
                        <span className="truncate">{describeStep(step)}</span>
                        {isCurrent && <span className="ml-auto w-3 h-3 border-2 border-[#00f0ff]/40 border-t-[#00f0ff] rounded-full animate-spin shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}
              {summary && (
                <div className="text-xs text-[#cbd5e1] border-t border-[#1e293b] pt-3">
                  <p className="text-[10px] uppercase tracking-wider text-[#64748b] mb-1.5">Summary</p>
                  {summary}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <div className="px-5 py-3 border-b border-[#1e293b] flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-[#64748b]">Live transcript</span>
            <span className="text-[10px] font-mono text-[#64748b]">{logs.length} events</span>
          </div>
          <div ref={logRef} className="p-5 space-y-2 overflow-y-auto max-h-[420px] min-h-[240px]">
            {logs.length === 0 && (
              <p className="text-xs text-[#64748b] text-center py-10">The agent&apos;s live transcript will appear here.</p>
            )}
            {logs.map((l) => (
              <div key={l.id} className="flex items-start gap-2.5 text-[11px] font-mono">
                <span className="text-[#475569] shrink-0 tabular-nums">{l.ts}</span>
                <span className={`${levelColor[l.level] || "text-[#64748b]"} leading-relaxed break-words`}>
                  {l.level === "action" ? "▸ " : l.level === "success" ? "✓ " : l.level === "error" ? "✕ " : ""}
                  {l.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
