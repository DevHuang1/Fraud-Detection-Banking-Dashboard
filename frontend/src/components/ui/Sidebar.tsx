"use client";

import { useState } from "react";
import { Icons } from "./Icons";
import { useAuth, type UserRole } from "@/context/AuthContext";

interface NavItem {
  label: string;
  icon: string;
  key: string;
  badge: string | null;
  roles?: UserRole[];
}

const sections: NavItem[] = [
  { label: "Overview", icon: "dashboard", key: "overview", badge: null },
  { label: "Transactions", icon: "activity", key: "transactions", badge: null },
  { label: "Fraud Cases", icon: "shield", key: "cases", badge: "12" },
  { label: "Analytics", icon: "barChart", key: "analytics", badge: null },
  { label: "Rules Engine", icon: "settings", key: "rules", badge: null, roles: ["investigator", "admin"] },
  { label: "Reports", icon: "fileText", key: "reports", badge: null },
  { label: "Team", icon: "users", key: "team", badge: null, roles: ["admin"] },
];

interface SidebarProps {
  active: string;
  onNavigate: (key: string) => void;
}

export default function Sidebar({ active, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, hasRole } = useAuth();

  const visibleSections = sections.filter((s) => !s.roles || hasRole(...s.roles));

  const IconComponent = (name: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      dashboard: <Icons.dashboard />,
      activity: <Icons.activity />,
      shield: <Icons.shield />,
      barChart: <Icons.barChart />,
      settings: <Icons.settings />,
      fileText: <Icons.fileText />,
      users: <Icons.users />,
    };
    return iconMap[name] || null;
  };

  return (
    <aside
      className="fixed left-0 top-0 h-full z-50 flex flex-col transition-all duration-300"
      style={{
        width: collapsed ? 72 : 256,
        background: "rgba(10,14,26,0.95)",
        borderRight: "1px solid rgba(51,65,85,0.3)",
        backdropFilter: "blur(20px)",
      }}
    >
      <div className="flex items-center gap-3 px-5 h-16 shrink-0 border-b border-[#1e293b]">
        <div className="w-9 h-9 rounded-xl accent-gradient flex items-center justify-center shadow-lg shrink-0">
          <Icons.bank size={18} />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <span className="text-[15px] font-bold text-white tracking-tight block leading-tight">FraudShield</span>
            <span className="text-[10px] text-[#64748b] tracking-widest uppercase block">Banking Intelligence</span>
          </div>
        )}
      </div>

      <nav className="flex-1 px-2.5 py-4 space-y-1 overflow-y-auto">
        {visibleSections.map((s) => {
          const isActive = active === s.key;
          return (
            <button
              key={s.key}
              onClick={() => onNavigate(s.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative group ${
                isActive
                  ? "accent-gradient text-white shadow-lg shadow-blue-500/20"
                  : "text-[#64748b] hover:text-white hover:bg-white/[0.05]"
              }`}
            >
              <span className="shrink-0">{IconComponent(s.icon)}</span>
              {!collapsed && (
                <span className="truncate">{s.label}</span>
              )}
              {!collapsed && s.badge && (
                <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                  {s.badge}
                </span>
              )}
              {collapsed && s.badge && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
                  {s.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-2.5 py-3 border-t border-[#1e293b]">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-lg">
            YK
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <span className="block text-sm font-medium text-white truncate">{user?.email?.split("@")[0] || "User"}</span>
              <span className="flex items-center gap-1.5 text-xs text-[#64748b]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Analyst"}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full mt-1 flex items-center justify-center h-8 rounded-lg text-[#64748b] hover:text-white hover:bg-white/[0.05] transition-all text-xs"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${collapsed ? "rotate-180" : ""}`}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
