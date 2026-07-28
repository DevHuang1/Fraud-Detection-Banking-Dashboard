"use client";

export default function Header() {
  return (
    <header className="sticky top-0 z-30 h-16 flex items-center justify-between px-8" style={{ background: "rgba(10,14,26,0.8)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(51,65,85,0.2)" }}>
      <div className="flex items-center gap-4">
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748b]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search transactions, cases..."
            className="w-80 h-10 pl-10 pr-4 rounded-xl text-sm bg-[#1e293b] border border-[#334155] text-white placeholder-[#64748b] outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative w-10 h-10 rounded-xl bg-[#1e293b] border border-[#334155] flex items-center justify-center hover:border-blue-500/30 transition-all">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ef4444] text-[10px] font-bold text-white flex items-center justify-center">3</span>
        </button>

        <button className="w-10 h-10 rounded-xl bg-[#1e293b] border border-[#334155] flex items-center justify-center hover:border-blue-500/30 transition-all">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
          </svg>
        </button>

        <div className="h-8 w-px bg-[#334155] mx-1" />

        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="block text-xs text-[#64748b]">Live</span>
            <span className="block text-xs text-[#22c55e] font-medium">System OK</span>
          </div>
          <div className="relative w-2 h-2">
            <div className="absolute inset-0 rounded-full bg-[#22c55e]" />
            <div className="absolute inset-0 rounded-full bg-[#22c55e] animate-ping opacity-50" />
          </div>
        </div>
      </div>
    </header>
  );
}
