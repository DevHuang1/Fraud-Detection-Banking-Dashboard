"use client";

interface HealthCard {
  title: string;
  value: string;
  subtitle: string;
  gradient: string;
  barValue: number;
  barColor: string;
}

export default function FraudHealthCards() {
  const cards: HealthCard[] = [
    { title: "Fraud Health Score", value: "94.2%", subtitle: "System integrity rating", gradient: "from-emerald-500 to-teal-500", barValue: 94, barColor: "#10b981" },
    { title: "Alert Volume", value: "1,247", subtitle: "+18% vs last week", gradient: "from-amber-500 to-orange-500", barValue: 62, barColor: "#f59e0b" },
    { title: "High-Risk Accounts", value: "89", subtitle: "Under active monitoring", gradient: "from-red-500 to-rose-600", barValue: 89, barColor: "#ef4444" },
    { title: "Fraud Rate", value: "1.8%", subtitle: "↓ 0.3% from last month", gradient: "from-blue-600 to-cyan-500", barValue: 18, barColor: "#3b82f6" },
  ];

  return (
    <>
      {cards.map((card, i) => (
        <div
          key={card.title}
          className="glass rounded-2xl p-5 animate-slide-up cursor-pointer"
          style={{ animationDelay: `${0.15 * (i + 1)}s` }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-semibold text-[#64748b] uppercase tracking-widest">{card.title}</span>
            <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${card.gradient}`} />
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-3xl font-bold text-white tabular-nums">{card.value}</span>
            <span className="text-xs text-[#64748b]">{card.subtitle}</span>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-[#1e293b] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${card.barValue}%`,
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
