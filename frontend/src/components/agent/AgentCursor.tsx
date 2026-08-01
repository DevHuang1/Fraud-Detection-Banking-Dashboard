"use client";

import { useState, useEffect, useRef } from "react";
import { useAgent } from "@/context/AgentContext";

export default function AgentCursor() {
  const { status } = useAgent();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [pressed, setPressed] = useState(false);
  const [bubble, setBubble] = useState<{ text: string; id: number } | null>(null);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onMove = (e: Event) => {
      const detail = (e as CustomEvent<{ x: number; y: number }>).detail;
      if (detail && typeof detail.x === "number") {
        setPos({ x: detail.x, y: detail.y });
        setPressed(false);
      }
    };
    const onClick = () => {
      setPressed(true);
      setTimeout(() => setPressed(false), 220);
    };
    const onBubble = (e: Event) => {
      const detail = (e as CustomEvent<{ text: string }>).detail;
      if (!detail) return;
      setBubble({ text: detail.text, id: Date.now() });
      if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
      bubbleTimer.current = setTimeout(() => setBubble(null), 2600);
    };
    window.addEventListener("agent:cursor", onMove);
    window.addEventListener("agent:click", onClick);
    window.addEventListener("agent:bubble", onBubble);
    return () => {
      window.removeEventListener("agent:cursor", onMove);
      window.removeEventListener("agent:click", onClick);
      window.removeEventListener("agent:bubble", onBubble);
    };
  }, []);

  const active = status === "running" || status === "planning";

  return (
    <>
      {pos && active && (
        <>
          <div
            className="fixed z-[9999] pointer-events-none"
            style={{
              left: 0,
              top: 0,
              transform: `translate(${pos.x}px, ${pos.y}px)`,
              transition: "transform 0.45s cubic-bezier(0.25, 1, 0.5, 1)",
            }}
          >
            <div
              className="relative"
              style={{ transform: pressed ? "scale(0.82)" : "scale(1)", transition: "transform 0.1s ease" }}
            >
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" style={{ filter: "drop-shadow(0 0 10px rgba(0,240,255,0.9))" }}>
                <path
                  d="M4 2l7 18 2.2-6.3L19.5 11 4 2z"
                  fill="rgba(0,240,255,0.9)"
                  stroke="rgba(10,14,26,0.9)"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider text-[#0a0e1a] bg-[#00f0ff] whitespace-nowrap">
                agent
              </span>
            </div>
          </div>
          {bubble && (
            <div
              key={bubble.id}
              className="fixed z-[9998] pointer-events-none animate-fade-in"
              style={{ left: pos.x + 18, top: pos.y + 6, maxWidth: 220 }}
            >
              <div className="px-3 py-1.5 rounded-lg text-[11px] text-white bg-[#111827]/95 border border-[#00f0ff]/30 shadow-lg shadow-cyan-500/10 backdrop-blur">
                {bubble.text}
              </div>
            </div>
          )}
        </>
      )}
      {active && (
        <div className="fixed bottom-5 right-5 z-[9997] pointer-events-none animate-fade-in">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#111827]/95 border border-[#00f0ff]/30 shadow-2xl shadow-cyan-500/10 backdrop-blur">
            <span className="relative flex w-2.5 h-2.5">
              <span className="absolute inset-0 rounded-full bg-[#00f0ff]" />
              <span className="absolute inset-0 rounded-full bg-[#00f0ff] animate-ping opacity-60" />
            </span>
            <span className="text-xs font-mono text-white">
              AI agent is {status === "planning" ? "planning" : "working"}…
            </span>
          </div>
        </div>
      )}
    </>
  );
}
