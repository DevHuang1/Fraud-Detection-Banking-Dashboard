"use client";

const navItems = [
  { label: "Dashboard", icon: "grid", active: true },
  { label: "Transactions", icon: "arrows", active: false },
  { label: "Fraud Cases", icon: "shield", active: false },
  { label: "Rules Engine", icon: "settings", active: false },
  { label: "Analytics", icon: "chart", active: false },
  { label: "Reports", icon: "file", active: false },
  { label: "Settings", icon: "gear", active: false },
];

function Icon({ name, className = "" }: { name: string; className?: string }) {
  const props = { width: 20, height: 20, className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  switch (name) {
    case "grid": return <svg {...props}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>;
    case "arrows": return <svg {...props}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>;
    case "shield": return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
    case "settings": return <svg {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
    case "chart": return <svg {...props}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>;
    case "file": return <svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>;
    case "gear": return <svg {...props}><circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>;
    case "bank": return <svg {...props}><rect x="2" y="6" width="20" height="14" rx="2" /><path d="M12 2L2 6h20z" /><line x1="8" y1="12" x2="8" y2="16" /><line x1="12" y1="12" x2="12" y2="16" /><line x1="16" y1="12" x2="16" y2="16" /></svg>;
    default: return null;
  }
}

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-full w-64 z-40 flex flex-col" style={{ background: "#0a0e1a", borderRight: "1px solid rgba(51,65,85,0.3)" }}>
      <div className="flex items-center gap-3 px-6 h-16 shrink-0 border-b border-[#1e293b]">
        <div className="w-8 h-8 rounded-lg accent-gradient flex items-center justify-center">
          <Icon name="bank" className="w-4 h-4 text-white" />
        </div>
        <div>
          <span className="text-[15px] font-semibold text-white tracking-tight">FraudShield</span>
          <span className="block text-[11px] text-[#64748b] tracking-wide">Banking Intelligence</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.label}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              item.active
                ? "accent-gradient text-white shadow-lg shadow-blue-500/20"
                : "text-[#94a3b8] hover:text-white hover:bg-[#1e293b]"
            }`}
          >
            <Icon name={item.icon} className={item.active ? "text-white" : ""} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-[#1e293b]">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <div className="w-8 h-8 rounded-full accent-gradient flex items-center justify-center text-xs font-bold text-white">
            YK
          </div>
          <div>
            <span className="block text-sm font-medium text-white">Yuza K.</span>
            <span className="block text-xs text-[#64748b]">Admin</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
