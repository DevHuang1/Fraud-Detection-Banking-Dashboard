"use client";

import { Icons } from "@/components/ui/Icons";

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
}

const cards = [
  {
    label: "Total Transactions",
    valueKey: "totalTransactions" as const,
    format: (v: number) => v.toLocaleString(),
    icon: "activity",
    gradient: "from-[#3b82f6] to-[#00f0ff]",
    glow: "neon-glow-blue",
    change: "+12.5%",
    up: true,
  },
  {
    label: "Suspicious",
    valueKey: "suspiciousTransactions" as const,
    format: (v: number) => v.toLocaleString(),
    icon: "alertTriangle",
    gradient: "from-[#f59e0b] to-[#ef4444]",
    glow: "",
    change: "+23.1%",
    up: true,
  },
  {
    label: "Confirmed Fraud",
    valueKey: "confirmedFraud" as const,
    format: (v: number) => v.toLocaleString(),
    icon: "shield",
    gradient: "from-[#ef4444] to-[#ec4899]",
    glow: "",
    change: "+8.3%",
    up: true,
  },
  {
    label: "Blocked Attempts",
    valueKey: "blockedAttempts" as const,
    format: (v: number) => v.toLocaleString(),
    icon: "checkCircle",
    gradient: "from-[#22ff8b] to-[#00f0ff]",
    glow: "",
    change: "-4.1%",
    up: false,
  },
];

export default function KpiCards({ stats }: KpiCardsProps) {
  const iconMap: Record<string, React.ReactNode> = {
    activity: <Icons.activity size={18} />,
    alertTriangle: <Icons.alertTriangle size={18} />,
    shield: <Icons.shield size={18} />,
    checkCircle: <Icons.checkCircle size={18} />,
  };

  return (
    <>
      {cards.map((card, i) => (
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
            <span className={`flex items-center gap-1 text-xs font-semibold ${card.up ? "text-[#22ff8b]" : "text-[#ef4444]"}`}>
              {card.up ? <Icons.arrowUp size={12} /> : <Icons.arrowDown size={12} />}
              {card.change}
            </span>
          </div>
        </div>
      ))}
    </>
  );
}
