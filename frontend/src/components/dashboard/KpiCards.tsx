"use client";

import { Icons } from "@/components/ui/Icons";
import type { Role } from "@/lib/roles";

interface KpiCardsProps {
  stats: {
    totalTransactions: number;
    suspiciousTransactions: number;
    confirmedFraud: number;
    blockedAttempts: number;
    avgRiskScore: number;
    highRiskAccounts: number;
    fraudRate: number;
    unreadAlerts: number;
  };
  role?: Role;
}

interface CardDef {
  label: string;
  valueKey: keyof KpiCardsProps["stats"];
  format: (v: number) => string;
  icon: string;
  gradient: string;
  glow: string;
}

const ALL_CARDS: Record<string, CardDef> = {
  totalTransactions: {
    label: "Total Transactions",
    valueKey: "totalTransactions",
    format: (v) => v.toLocaleString(),
    icon: "activity",
    gradient: "from-[#3b82f6] to-[#00f0ff]",
    glow: "neon-glow-blue",
  },
  suspiciousTransactions: {
    label: "Suspicious · Triage Queue",
    valueKey: "suspiciousTransactions",
    format: (v) => v.toLocaleString(),
    icon: "alertTriangle",
    gradient: "from-[#f59e0b] to-[#ef4444]",
    glow: "",
  },
  unreadAlerts: {
    label: "Unread Alerts",
    valueKey: "unreadAlerts",
    format: (v) => v.toLocaleString(),
    icon: "bell",
    gradient: "from-[#ec4899] to-[#f59e0b]",
    glow: "",
  },
  highRiskAccounts: {
    label: "High-Risk Accounts",
    valueKey: "highRiskAccounts",
    format: (v) => v.toLocaleString(),
    icon: "fingerprint",
    gradient: "from-[#ef4444] to-[#ec4899]",
    glow: "",
  },
  confirmedFraud: {
    label: "Confirmed Fraud",
    valueKey: "confirmedFraud",
    format: (v) => v.toLocaleString(),
    icon: "shield",
    gradient: "from-[#ef4444] to-[#ec4899]",
    glow: "",
  },
  blockedAttempts: {
    label: "Blocked Attempts",
    valueKey: "blockedAttempts",
    format: (v) => v.toLocaleString(),
    icon: "checkCircle",
    gradient: "from-[#22ff8b] to-[#00f0ff]",
    glow: "",
  },
  avgRiskScore: {
    label: "Avg Risk Score",
    valueKey: "avgRiskScore",
    format: (v) => v.toFixed(1),
    icon: "sliders",
    gradient: "from-[#8b5cf6] to-[#00f0ff]",
    glow: "",
  },
  fraudRate: {
    label: "Fraud Rate",
    valueKey: "fraudRate",
    format: (v) => `${v}%`,
    icon: "barChart",
    gradient: "from-[#3b82f6] to-[#00f0ff]",
    glow: "",
  },
};

const ROLE_KPI_KEYS: Record<Role, string[]> = {
  analyst: ["totalTransactions", "suspiciousTransactions", "unreadAlerts", "highRiskAccounts"],
  investigator: ["totalTransactions", "confirmedFraud", "blockedAttempts", "fraudRate"],
  admin: ["totalTransactions", "confirmedFraud", "blockedAttempts", "fraudRate"],
  user: ["totalTransactions"],
};

export default function KpiCards({ stats, role = "investigator" }: KpiCardsProps) {
  const iconMap: Record<string, React.ReactNode> = {
    activity: <Icons.activity size={18} />,
    alertTriangle: <Icons.alertTriangle size={18} />,
    shield: <Icons.shield size={18} />,
    checkCircle: <Icons.checkCircle size={18} />,
    bell: <Icons.bell size={18} />,
    fingerprint: <Icons.fingerprint size={18} />,
    sliders: <Icons.sliders size={18} />,
    barChart: <Icons.barChart size={18} />,
  };

  const keys = ROLE_KPI_KEYS[role] || ROLE_KPI_KEYS.investigator;

  return (
    <>
      {keys.map((key, i) => {
        const card = ALL_CARDS[key];
        if (!card) return null;
        return (
          <div
            key={card.label}
            className="glass-neon rounded-2xl p-5 transition-all duration-300 group animate-slide-up cursor-pointer"
            style={{ animationDelay: `${0.1 * (i + 1)}s` }}
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-[11px] font-semibold text-[#64748b] uppercase tracking-widest">{card.label}</span>
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center shadow-lg shrink-0 ${card.glow}`}>
                {iconMap[card.icon]}
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-white tabular-nums">{card.format(stats[card.valueKey])}</span>
            </div>
          </div>
        );
      })}
    </>
  );
}
