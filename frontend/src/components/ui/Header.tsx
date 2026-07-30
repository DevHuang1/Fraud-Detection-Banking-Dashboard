"use client";

import { useState, useEffect, useCallback } from "react";
import { Icons } from "./Icons";
import { supabase } from "@/lib/supabase";

export default function Header() {
  const [throughput, setThroughput] = useState("--");

  const loadStats = useCallback(async () => {
    const stats = await supabase.getStats();
    setThroughput(`${(stats.totalTransactions / 24).toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return (
    <header
      className="sticky top-0 z-40 h-16 flex items-center justify-between px-6 lg:px-8"
      style={{
        background: "rgba(10,14,26,0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(51,65,85,0.2)",
      }}
    >
      <div className="flex items-center gap-4">
        <div className="relative group">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748b] group-focus-within:text-[#00f0ff] transition-colors">
            <Icons.search size={16} />
          </span>
          <input
            type="text"
            placeholder="Search transactions, cases, accounts..."
            className="w-[420px] h-10 pl-10 pr-4 rounded-xl text-sm bg-[#1e293b] border border-[#334155] text-white placeholder-[#4a5568] outline-none focus:border-[#00f0ff]/30 focus:ring-1 focus:ring-[#00f0ff]/10 transition-all"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#4a5568] bg-[#0a0e1a] px-1.5 py-0.5 rounded border border-[#1e293b]">⌘K</span>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <button className="relative w-10 h-10 rounded-xl bg-[#1e293b] border border-[#334155] flex items-center justify-center hover:border-[#00f0ff]/30 transition-all group">
          <span className="text-[#64748b] group-hover:text-[#00f0ff] transition-colors"><Icons.bell size={18} /></span>
          <span className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-gradient-to-br from-[#ef4444] to-[#ec4899] text-[10px] font-bold text-white flex items-center justify-center shadow-lg">3</span>
        </button>

        <div className="h-8 w-px bg-[#1e293b] mx-1" />

        <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-[#1e293b]/50 border border-[#00f0ff]/10 neon-border-cyan">
          <div className="flex items-center gap-2">
            <span className="relative flex w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-[#22ff8b]" />
              <span className="absolute inset-0 rounded-full bg-[#22ff8b] animate-ping opacity-50" />
            </span>
            <span className="text-xs text-[#22ff8b] font-medium">Live</span>
          </div>
          <span className="text-[10px] text-[#64748b] font-mono">{throughput} txn/h</span>
        </div>
      </div>
    </header>
  );
}
