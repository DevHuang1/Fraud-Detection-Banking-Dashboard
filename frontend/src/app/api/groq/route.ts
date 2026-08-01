import { NextRequest, NextResponse } from "next/server";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ configured: !!process.env.GROQ_API_KEY });
}

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-groq-key") || process.env.GROQ_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "No GROQ API key. Paste one in the AI Agent panel, or set GROQ_API_KEY in .env.local." }, { status: 400 });
  }

  let body: { messages?: ChatMessage[]; json?: boolean; temperature?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "messages are required" }, { status: 400 });
  }

  const model = process.env.GROQ_MODEL || (body.json ? "llama-3.3-70b-versatile" : "llama-3.1-8b-instant");

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: body.messages,
        temperature: typeof body.temperature === "number" ? body.temperature : 0.4,
        ...(body.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(45000),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data?.error?.message || `Groq API error (${res.status})` }, { status: res.status });
    }
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "Groq returned an empty response" }, { status: 502 });
    }
    return NextResponse.json({ content });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Groq request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
