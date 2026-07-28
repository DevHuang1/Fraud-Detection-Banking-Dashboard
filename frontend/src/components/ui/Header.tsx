"use client";

import { Icons } from "./Icons";

export default function Header() {
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
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748b] group-focus-within:text-blue-400 transition-colors">
            <Icons.search size={16} />
          </span>
          <input
            type="text"
            placeholder="Search transactions, cases, accounts..."
            className="w-[420px] h-10 pl-10 pr-4 rounded-xl text-sm bg-[#1e293b] border border-[#334155] text-white placeholder-[#4a5568] outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/10 transition-all"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#4a5568] bg-[#0a0e1a] px-1.5 py-0.5 rounded border border-[#1e293b]">⌘K</span>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <button className="relative w-10 h-10 rounded-xl bg-[#1e293b] border border-[#334155] flex items-center justify-center hover:border-blue-500/30 transition-all group">
          <span className="text-[#64748b] group-hover:text-blue-400 transition-colors"><Icons.bell size={18} /></span>
          <span className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-gradient-to-br from-red-500 to-orange-500 text-[10px] font-bold text-white flex items-center justify-center shadow-lg">3</span>
        </button>

        <div className="h-8 w-px bg-[#1e293b] mx-1" />

        <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-[#1e293b]/50 border border-[#334155]/50">
          <div className="flex items-center gap-2">
            <span className="relative flex w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-emerald-500" />
              <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-50" />
            </span>
            <span className="text-xs text-emerald-400 font-medium">Live</span>
          </div>
          <span className="text-[10px] text-[#64748b] font-mono">12,847 txn/h</span>
        </div>
      </div>
    </header>
  );
}
