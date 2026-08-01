export const GROQ_KEY_STORAGE = "groq_api_key";

export function getGroqKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(GROQ_KEY_STORAGE) || "";
}

export function setGroqKey(key: string) {
  if (typeof window === "undefined") return;
  if (key.trim()) localStorage.setItem(GROQ_KEY_STORAGE, key.trim());
  else localStorage.removeItem(GROQ_KEY_STORAGE);
}

interface GroqOptions {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  json?: boolean;
  temperature?: number;
}

export class GroqError extends Error {}

export async function callGroq({ messages, json, temperature }: GroqOptions): Promise<string> {
  const key = getGroqKey();
  const res = await fetch("/api/groq", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "x-groq-key": key } : {}),
    },
    body: JSON.stringify({ messages, json, temperature }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new GroqError(data?.error || `Groq request failed (${res.status})`);
  }
  if (typeof data.content !== "string") {
    throw new GroqError("Groq returned an unexpected response");
  }
  return data.content;
}

export function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fence ? fence[1] : trimmed;
}

export async function checkServerGroqKey(): Promise<boolean> {
  try {
    const res = await fetch("/api/groq");
    if (!res.ok) return false;
    const data = await res.json();
    return data?.configured === true;
  } catch {
    return false;
  }
}
