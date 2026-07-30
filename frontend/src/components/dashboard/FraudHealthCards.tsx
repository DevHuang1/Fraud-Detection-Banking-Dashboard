"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, type DashboardStats } from "@/lib/supabase";

interface CardConfig {
  key: keyof DashboardStats & string;
  title: string;
  subtitle: string | ((s: DashboardStats) => string);
  gradient: string;
  barValue: (s: DashboardStats) => number;
  barColor: string;
  format: (s: DashboardStats) => string;
}

const cards: CardConfig[] = [
  {
    key: "fraudRate",
    title: "Fraud Health Score",
    subtitle: "System integrity rating",
    gradient: "from-[#10b981] to-[#22ff8b]",
    barColor: "#22ff8b",
    barValue: (s) => Math.round((1 - s.confirmedFraud / Math.max(s.totalTransactions, 1)) * 100),
    format: (s) => `${Math.round((1 - s.confirmedFraud / Math.max(s.totalTransactions, 1)) * 1000) / 10}%`,
  },
  {
    key: "unreadAlerts",
    title: "Alert Volume",
    subtitle: (s) => `${s.unreadAlerts} unread alerts`,
    gradient: "from-[#f59e0b] to-[#ef4444]",
    barColor: "#f59e0b",
    barValue: (s) => Math.min(s.unreadAlerts, 100),
    format: (s) => s.unreadAlerts.toLocaleString(),
  },
  {
    key: "highRiskAccounts",
    title: "High-Risk Accounts",
    subtitle: "Under active monitoring",
    gradient: "from-[#ef4444] to-[#ec4899]",
    barColor: "#ef4444",
    barValue: (s) => Math.min(s.highRiskAccounts, 100),
    format: (s) => s.highRiskAccounts.toLocaleString(),
  },
  {
    key: "fraudRate",
    title: "Fraud Rate",
    subtitle: (s) => `↑ ${s.fraudRate}% of all transactions`,
    gradient: "from-[#3b82f6] to-[#00f0ff]",
    barColor: "#00f0ff",
    barValue: (s) => Math.round(s.fraudRate * 10),
    format: (s) => `${s.fraudRate}%`,
  },
];

export default function FraudHealthCards() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const loadStats = useCallback(async () => {
    const data = await supabase.getStats();
    setStats(data);
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (!stats) {
    return (
      <>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-neon rounded-2xl p-5 animate-pulse">
            <div className="h-3 w-28 bg-[#1e293b] rounded mb-4" />
            <div className="h-8 w-20 bg-[#1e293b] rounded mb-1" />
            <div className="h-3 w-32 bg-[#1e293b] rounded mb-4" />
            <div className="h-2 rounded-full bg-[#1e293b]" />
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      {cards.map((card, i) => (
        <div
          key={card.title}
          className="glass-neon rounded-2xl p-5 animate-slide-up cursor-pointer"
          style={{ animationDelay: `${0.15 * (i + 1)}s` }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-semibold text-[#64748b] uppercase tracking-widest">{card.title}</span>
            <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${card.gradient} animate-glow-pulse`} />
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-3xl font-bold text-white tabular-nums">{card.format(stats)}</span>
            <span className="text-xs text-[#64748b]">{typeof card.subtitle === "function" ? card.subtitle(stats) : card.subtitle}</span>
          </div>
          <div className="mt-4 h-2 rounded-full bg-[#1e293b] overflow-hidden relative">
            <div
              className="h-full rounded-full transition-all duration-1000 relative"
              style={{
                width: `${card.barValue(stats)}%`,
                background: `linear-gradient(90deg, ${card.barColor}, ${card.barColor}88)`,
                boxShadow: `0 0 12px ${card.barColor}44`,
              }}
            />
          </div>
        </div>
      ))}
    </>
  );
}
