import { supabase } from "./supabase";
import { callGroq, stripJsonFence, GroqError } from "./groq";

export type AgentStatus = "idle" | "planning" | "running" | "done" | "error";

export type AgentAction = "blocked" | "approved" | "flagged" | "confirmed_fraud";

export type AgentStep =
  | { type: "navigate"; tab: string }
  | { type: "openTransaction"; txid: string }
  | { type: "actTransaction"; txid: string; action: AgentAction }
  | { type: "createCase"; txid: string; note?: string; severity?: string; fraud_type?: string }
  | { type: "read"; source: "stats" | "transactions" | "cases" | "alerts" }
  | { type: "wait"; ms?: number }
  | { type: "note"; text: string };

export interface AgentLogEntry {
  id: number;
  ts: string;
  level: "info" | "action" | "success" | "error";
  text: string;
}

export interface AgentPlan {
  rationale: string;
  plan: AgentStep[];
}

const TAB_LABELS = ["overview", "transactions", "cases", "analytics", "flow", "rules", "reports", "team", "tools"];

export function describeStep(step: AgentStep): string {
  switch (step.type) {
    case "navigate":
      return `Open ${step.tab} tab`;
    case "openTransaction":
      return `Open transaction ${step.txid}`;
    case "actTransaction":
      return `${step.action} ${step.txid}`;
    case "createCase":
      return `Open fraud case for ${step.txid}`;
    case "read":
      return `Read ${step.source}`;
    case "wait":
      return `Pause ${step.ms ?? 500}ms`;
    case "note":
      return step.text;
  }
}

// --- visible cursor event bus ------------------------------------------------

export function moveCursor(x: number, y: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("agent:cursor", { detail: { x, y } }));
}

export function cursorClick() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("agent:click"));
}

export function agentBubble(text: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("agent:bubble", { detail: { text } }));
}

// --- DOM helpers ---------------------------------------------------------------

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function q<T extends HTMLElement = HTMLElement>(selector: string): T | null {
  return document.querySelector<T>(selector);
}

function centerOf(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

async function moveTo(el: Element, ms = 260): Promise<void> {
  const { x, y } = centerOf(el);
  moveCursor(x, y);
  await pause(ms);
}

async function clickEl(el: HTMLElement, ms = 420): Promise<void> {
  await moveTo(el);
  cursorClick();
  el.click();
  await pause(ms);
}

function findSidebarButton(tab: string): HTMLButtonElement | null {
  const aside = q("aside");
  if (!aside) return null;
  const byKey = aside.querySelector<HTMLButtonElement>(`[data-nav-key="${tab}"]`);
  if (byKey) return byKey;
  const buttons = Array.from(aside.querySelectorAll<HTMLButtonElement>("button"));
  const needle = tab.toLowerCase();
  return buttons.find((b) => b.textContent?.trim().toLowerCase().startsWith(needle)) || null;
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const proto =
    el instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
}

// --- runner ---------------------------------------------------------------------

export interface RunnerOptions {
  role: string;
  log: (level: AgentLogEntry["level"], text: string) => void;
  onStepStart?: (index: number, step: AgentStep) => void;
  onStepDone?: (index: number, step: AgentStep) => void;
  shouldStop: () => boolean;
}

type ReadSource = "stats" | "transactions" | "cases" | "alerts";

export class AgentRunner {
  constructor(private opts: RunnerOptions) {}

  private log(level: AgentLogEntry["level"], text: string) {
    this.opts.log(level, text);
  }

  private async ensureStopped(): Promise<boolean> {
    if (this.opts.shouldStop()) {
      this.log("info", "Run paused by user.");
      return true;
    }
    return false;
  }

  async navigate(tab: string) {
    if (await this.ensureStopped()) return;
    this.log("action", `Opening ${tab} tab…`);
    const btn = findSidebarButton(tab);
    if (!btn) {
      this.log("error", `Sidebar tab "${tab}" not found.`);
      return;
    }
    await clickEl(btn, 300);
    await pause(600);
  }

  async closeDrawerIfOpen() {
    const close = q<HTMLButtonElement>('[data-action="close-drawer"]');
    if (close) await clickEl(close, 250);
    await pause(300);
  }

  async openTransaction(txid: string) {
    if (await this.ensureStopped()) return;
    await this.closeDrawerIfOpen();
    let row = q<HTMLElement>(`[data-tx-id="${txid}"]`);
    if (!row) {
      this.log("info", `${txid} not on screen — switching to Transactions tab.`);
      await this.navigate("transactions");
      row = q<HTMLElement>(`[data-tx-id="${txid}"]`);
    }
    if (!row) {
      const search = q<HTMLInputElement>('[data-field="tx_search"]');
      if (search) {
        this.log("action", `Searching for ${txid}…`);
        await moveTo(search, 200);
        setNativeValue(search, txid);
        cursorClick();
        await pause(600);
        row = q<HTMLElement>(`[data-tx-id="${txid}"]`);
      }
    }
    if (!row) {
      this.log("error", `Transaction ${txid} not found in the transactions table.`);
      return;
    }
    this.log("action", `Opening transaction ${txid}…`);
    agentBubble(`Reviewing ${txid}…`);
    await clickEl(row, 400);
    await pause(700);
    const search = q<HTMLInputElement>('[data-field="tx_search"]');
    if (search && search.value) {
      setNativeValue(search, "");
      await pause(200);
    }
  }

  async openMoreMenu() {
    const more = q<HTMLButtonElement>('[data-action="more"]');
    if (more) await clickEl(more, 300);
    await pause(300);
  }

  async actTransaction(txid: string, action: AgentAction) {
    if (await this.ensureStopped()) return;
    await this.openTransaction(txid);
    if (action === "approved" || action === "confirmed_fraud") {
      await this.openMoreMenu();
    }
    const btn = q<HTMLButtonElement>(`[data-action="${action}"]`);
    if (!btn || (btn as HTMLButtonElement).disabled) {
      this.log("error", `"${action}" action is not available for ${txid}.`);
      return;
    }
    this.log("action", `${action} ${txid}…`);
    agentBubble(`${action} ${txid}…`);
    await clickEl(btn, 500);
    await pause(600);
    this.log("success", `${txid} marked ${action}.`);
    await this.closeDrawerIfOpen();
  }

  async createCase(txid: string, fields?: { note?: string; severity?: string; fraud_type?: string }) {
    if (await this.ensureStopped()) return;
    await this.openTransaction(txid);
    let btn = q<HTMLButtonElement>('[data-action="open_case"]');
    if (!btn) {
      await this.openMoreMenu();
      btn = q<HTMLButtonElement>('[data-action="open_case"]');
    }
    if (!btn) {
      this.log("error", "Open Case button not found.");
      return;
    }
    this.log("action", `Opening fraud case for ${txid}…`);
    agentBubble(`Opening case for ${txid}…`);
    await clickEl(btn, 350);
    await pause(500);

    const title = q<HTMLInputElement>('[data-field="case_title"]');
    if (title) {
      await moveTo(title, 180);
      setNativeValue(title, fields?.note || `AI investigation: ${txid}`);
      cursorClick();
      await pause(250);
    }
    const desc = q<HTMLTextAreaElement>('[data-field="case_description"]');
    if (desc) {
      setNativeValue(desc, `Opened by the AI agent during automated review of ${txid}.`);
      await pause(200);
    }
    if (fields?.severity) {
      const sel = q<HTMLSelectElement>('[data-field="case_severity"]');
      if (sel) {
        await moveTo(sel, 180);
        setNativeValue(sel, fields.severity);
        await pause(200);
      }
    }
    if (fields?.fraud_type) {
      const sel = q<HTMLSelectElement>('[data-field="case_fraud_type"]');
      if (sel) {
        await moveTo(sel, 180);
        setNativeValue(sel, fields.fraud_type);
        await pause(200);
      }
    }
    const submit = q<HTMLButtonElement>('[data-field="case_submit"]');
    if (!submit) {
      this.log("error", "Case submit button not found.");
      return;
    }
    await clickEl(submit, 400);
    await pause(600);
    this.log("success", `Case opened for ${txid}.`);
    await this.closeDrawerIfOpen();
  }

  async read(source: ReadSource) {
    if (await this.ensureStopped()) return;
    switch (source) {
      case "stats": {
        const s = await supabase.getStats();
        this.log("info", `Stats — ${s.totalTransactions.toLocaleString()} txns, ${s.suspiciousTransactions.toLocaleString()} suspicious, ${s.confirmedFraud.toLocaleString()} confirmed fraud, ${s.blockedAttempts.toLocaleString()} blocked, fraud rate ${s.fraudRate}%.`);
        break;
      }
      case "transactions": {
        const t = await supabase.getTransactions(15);
        this.log("info", `Read ${t.length} recent transactions.`);
        break;
      }
      case "cases": {
        const c = await supabase.getCases();
        const active = c.filter((x) => x.status === "open" || x.status === "investigating").length;
        this.log("info", `${c.length} cases, ${active} active.`);
        break;
      }
      case "alerts": {
        const a = await supabase.getAlerts();
        const unread = a.filter((x) => !x.is_read).length;
        this.log("info", `${a.length} alerts, ${unread} unread.`);
        break;
      }
    }
  }

  async runStep(step: AgentStep): Promise<void> {
    switch (step.type) {
      case "navigate":
        await this.navigate(step.tab);
        break;
      case "openTransaction":
        await this.openTransaction(step.txid);
        break;
      case "actTransaction":
        await this.actTransaction(step.txid, step.action);
        break;
      case "createCase":
        await this.createCase(step.txid, { note: step.note, severity: step.severity, fraud_type: step.fraud_type });
        break;
      case "read":
        await this.read(step.source);
        break;
      case "wait":
        this.log("info", `Pausing ${step.ms ?? 500}ms…`);
        await pause(step.ms ?? 500);
        break;
      case "note":
        this.log("info", step.text);
        break;
    }
  }
}

// --- planning ---------------------------------------------------------------------

export function allowedActionsForRole(role: string): string[] {
  if (role === "admin" || role === "investigator") {
    return ["blocked", "approved", "flagged", "confirmed_fraud", "open cases"];
  }
  if (role === "analyst") {
    return ["flagged", "open cases"];
  }
  return [];
}

async function buildContext(role: string): Promise<string> {
  const [stats, txns, cases, alerts] = await Promise.all([
    supabase.getStats(),
    supabase.getTransactions(200),
    supabase.getCases(),
    supabase.getAlerts(),
  ]);

  const suspicious = txns
    .filter((t) => t.is_suspicious || t.status === "flagged" || t.status === "pending" || t.risk_level === "high" || t.risk_level === "critical")
    .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
    .slice(0, 10);

  const txLines = suspicious.length
    ? suspicious.map((t) => `- ${t.transaction_id} | ${t.merchant} | $${t.amount.toLocaleString()} | ${t.risk_level} risk | ${t.status} | ml ${((t.ml_fraud_probability || 0) * 100).toFixed(0)}% | ${t.account_id}`).join("\n")
    : "- (no flagged/high-risk transactions right now)";

  const openCases = cases.filter((c) => c.status === "open" || c.status === "investigating").length;

  return [
    `ROLE: ${role}`,
    `Stats: ${stats.totalTransactions} total txns, ${stats.suspiciousTransactions} suspicious, ${stats.confirmedFraud} confirmed fraud, ${stats.blockedAttempts} blocked, ${openCases} open cases, ${alerts.filter((a) => !a.is_read).length} unread alerts.`,
    "",
    "SUSPICIOUS / HIGH-RISK TRANSACTIONS:",
    txLines,
    "",
    `The current user has the "${role}" role. Actions allowed: ${allowedActionsForRole(role).join(", ")}.`,
  ].join("\n");
}

export async function planTask(task: string, role: string): Promise<AgentPlan> {
  const context = await buildContext(role);

  const system = `You are the reasoning engine of an AI fraud-analysis agent inside a banking intelligence dashboard.

CURRENT SESSION CONTEXT:
${context}

You control the agent. It can click sidebar tabs, open the transaction detail drawer, and click Block/Approve/Flag buttons, and open fraud cases. Emit ONLY these step types:

{"type":"navigate","tab":"transactions"} — open a sidebar tab. Valid tabs: ${TAB_LABELS.join(", ")}.
{"type":"openTransaction","txid":"TX-..."} — open a transaction's detail drawer (use a real txid from context).
{"type":"actTransaction","txid":"TX-...","action":"blocked"} — act on a transaction in the drawer. action is one of: blocked, approved, flagged, confirmed_fraud.
{"type":"createCase","txid":"TX-...","note":"short title","severity":"high","fraud_type":"wire_fraud"} — open and fill the fraud case form for that transaction (severity: low|medium|high|critical; fraud_type: account_takeover|rapid_cashout|geo_anomaly|wire_fraud|card_not_present|identity_theft|other).
{"type":"read","source":"stats"} — pull live data (stats|transactions|cases|alerts).
{"type":"wait","ms":800}
{"type":"note","text":"brief human-style commentary"}

RULES:
- Only reference transaction IDs that appear in context.
- ${role === "analyst" ? "You are an analyst: you may flag transactions and open cases, but never block/approve/confirm." : "You are an investigator/admin: you may block, approve, flag, confirm fraud and open cases."}
- Prefer reviewing the highest-risk flagged transactions first.
- Do not block or approve without a review step (open the transaction first).
- Keep plans to 4-12 steps. Navigate to the transactions tab before acting on transactions.

Respond with ONLY JSON (no prose): {"rationale":"one sentence","plan":[...]}`;

  const raw = await callGroq({ messages: [{ role: "system", content: system }, { role: "user", content: task }], json: true, temperature: 0.3 });

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(raw));
  } catch {
    throw new GroqError("Agent could not produce a valid plan. Try rephrasing the task.");
  }
  const obj = parsed as { rationale?: string; plan?: unknown };
  if (!obj || !Array.isArray(obj.plan)) {
    throw new GroqError("Agent plan was missing a plan array.");
  }
  return { rationale: typeof obj.rationale === "string" ? obj.rationale : "", plan: obj.plan as AgentStep[] };
}

export async function summarizeRun(task: string, logs: AgentLogEntry[]): Promise<string> {
  const transcript = logs
    .filter((l) => l.level !== "info" || true)
    .map((l) => `[${l.level}] ${l.text}`)
    .join("\n");
  const prompt = `You just completed this task: "${task}".

Here is the execution transcript:
${transcript}

Write a 2-4 sentence summary in past tense describing what was done, including any transaction IDs acted on and their resulting status. Plain text only.`;

  try {
    return await callGroq({ messages: [{ role: "user", content: prompt }], temperature: 0.4 });
  } catch {
    return "Run complete.";
  }
}
