"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { AgentRunner, describeStep, planTask, summarizeRun, type AgentLogEntry, type AgentPlan, type AgentStatus, type AgentStep } from "@/lib/agent";
import { checkServerGroqKey, getGroqKey, setGroqKey } from "@/lib/groq";
import { useAuth } from "@/context/AuthContext";

interface AgentContextType {
  status: AgentStatus;
  logs: AgentLogEntry[];
  steps: AgentStep[];
  currentStep: number;
  error: string | null;
  summary: string | null;
  keyConfigured: boolean;
  runTask: (task: string) => Promise<void>;
  stop: () => void;
  clear: () => void;
  setKey: (key: string) => void;
}

const AgentContext = createContext<AgentContextType>({
  status: "idle",
  logs: [],
  steps: [],
  currentStep: -1,
  error: null,
  summary: null,
  keyConfigured: false,
  runTask: async () => {},
  stop: () => {},
  clear: () => {},
  setKey: () => {},
});

let logCounter = 0;

export function AgentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [logs, setLogs] = useState<AgentLogEntry[]>([]);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [keyConfigured, setKeyConfigured] = useState(() => !!getGroqKey());
  const stopRef = useRef(false);

  useEffect(() => {
    if (getGroqKey()) return;
    checkServerGroqKey().then((ok) => {
      if (ok) setKeyConfigured(true);
    });
  }, []);

  const log = useCallback((level: AgentLogEntry["level"], text: string) => {
    const entry: AgentLogEntry = { id: ++logCounter, ts: new Date().toLocaleTimeString(), level, text };
    setLogs((prev) => [...prev, entry]);
    return entry;
  }, []);

  const stop = useCallback(() => {
    stopRef.current = true;
  }, []);

  const clear = useCallback(() => {
    setLogs([]);
    setSteps([]);
    setCurrentStep(-1);
    setError(null);
    setSummary(null);
    setStatus("idle");
  }, []);

  const runTask = useCallback(
    async (task: string) => {
      if (!task.trim() || status === "running" || status === "planning") return;
      const role = user?.role || "analyst";
      const localLogs: AgentLogEntry[] = [];
      const record = (level: AgentLogEntry["level"], text: string) => {
        const entry = log(level, text);
        localLogs.push(entry);
      };

      stopRef.current = false;
      setError(null);
      setSummary(null);
      setLogs([]);
      setSteps([]);
      setCurrentStep(-1);
      record("info", `Task accepted: "${task.trim()}"`);
      record("info", `Running as ${role}.`);

      if (!keyConfigured) {
        setError("No Groq API key configured. Paste your key above to run the agent.");
        setStatus("error");
        return;
      }

      let plan: AgentPlan;
      try {
        setStatus("planning");
        record("info", "Planning steps with Groq…");
        plan = await planTask(task, role);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Planning failed";
        setError(msg);
        setStatus("error");
        record("error", msg);
        return;
      }

      setSteps(plan.plan);
      if (plan.rationale) record("info", `Rationale: ${plan.rationale}`);
      record("info", `Plan ready — ${plan.plan.length} steps.`);
      setStatus("running");

      const runner = new AgentRunner({
        role,
        log: record,
        shouldStop: () => stopRef.current,
        onStepStart: () => {},
        onStepDone: () => {},
      });

      for (let i = 0; i < plan.plan.length; i++) {
        if (stopRef.current) break;
        const step = plan.plan[i];
        setCurrentStep(i);
        record("action", `Step ${i + 1}/${plan.plan.length} — ${describeStep(step)}`);
        try {
          await runner.runStep(step);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Step failed";
          record("error", msg);
        }
      }

      if (!stopRef.current) {
        record("info", "All steps finished. Writing summary…");
        const text = await summarizeRun(task, localLogs);
        setSummary(text);
        record("success", "Run complete.");
      } else {
        record("info", "Run stopped by user.");
      }
      setStatus("done");
    },
    [log, status, user?.role, keyConfigured],
  );

  const setKey = useCallback((key: string) => {
    setGroqKey(key);
    setKeyConfigured(!!key.trim());
  }, []);

  return (
    <AgentContext.Provider value={{ status, logs, steps, currentStep, error, summary, keyConfigured, runTask, stop, clear, setKey }}>
      {children}
    </AgentContext.Provider>
  );
}

export const useAgent = () => useContext(AgentContext);
