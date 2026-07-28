"use client";

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  changeType: "up" | "down" | "neutral";
  icon: string;
  gradient: string;
  delay: number;
}

export default function StatCard({ title, value, change, changeType, icon, gradient, delay }: StatCardProps) {
  const changeColor = changeType === "up" ? "text-[#22c55e]" : changeType === "down" ? "text-[#ef4444]" : "text-[#94a3b8]";
  const changeIcon = changeType === "up"
    ? "M5 10l7-7m0 0l7 7m-7-7v18"
    : changeType === "down"
    ? "M19 14l-7 7m0 0l-7-7m7 7V3"
    : "M12 5v14m7-7H5";

  return (
    <div
      className="glass-card rounded-2xl p-5 animate-slide-up cursor-pointer"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-start justify-between mb-4">
        <span className="text-xs font-medium text-[#64748b] uppercase tracking-wider">{title}</span>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${gradient}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {icon === "activity" && <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></>}
            {icon === "alert" && <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>}
            {icon === "check" && <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>}
            {icon === "shield" && <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>}
          </svg>
        </div>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-bold text-white">{value}</span>
        <span className={`flex items-center gap-1 text-xs font-medium ${changeColor}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d={changeIcon} />
          </svg>
          {change}
        </span>
      </div>
    </div>
  );
}
