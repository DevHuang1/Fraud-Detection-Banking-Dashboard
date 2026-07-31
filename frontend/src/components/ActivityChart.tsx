"use client";

import { useState, useEffect } from "react";
import { supabase, type Transaction } from "@/lib/supabase";

interface DayData {
  day: string;
  normal: number;
  fraud: number;
}

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function aggregateByDay(txns: Transaction[]): DayData[] {
  const dayTotals: Record<string, { normal: number; fraud: number }> = {};
  for (let i = 0; i < 7; i++) {
    dayTotals[dayNames[i]] = { normal: 0, fraud: 0 };
  }
  for (const t of txns) {
    const d = dayNames[new Date(t.timestamp).getDay()];
    if (t.is_fraud) dayTotals[d].fraud++;
    else dayTotals[d].normal++;
  }
  return dayNames.map((day) => ({ day, ...dayTotals[day] }));
}

export default function ActivityChart() {
  const [data, setData] = useState<DayData[]>([]);

  useEffect(() => {
    let active = true;
    supabase.getTransactions(1000).then((txns) => {
      if (active) setData(aggregateByDay(txns));
    });
    return () => {
      active = false;
    };
  }, []);

  const maxNormal = data.length > 0 ? Math.max(...data.map((d) => d.normal)) : 1;
  const maxFraud = data.length > 0 ? Math.max(...data.map((d) => d.fraud)) : 1;

  return (
    <div className="glass-card rounded-2xl p-6 animate-slide-up delay-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-semibold text-white">Transaction Activity</h3>
          <p className="text-xs text-[#64748b] mt-0.5">Daily volume vs fraud incidents</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500/80" />
            <span className="text-xs text-[#94a3b8]">Legitimate</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#ef4444]/80" />
            <span className="text-xs text-[#94a3b8]">Fraud</span>
          </div>
        </div>
      </div>

      <div className="relative h-52">
        <svg className="w-full h-full" viewBox="0 0 700 200" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="normalGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="fraudGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0, 50, 100].map((y) => (
            <g key={y}>
              <line x1="40" y1={y} x2="690" y2={y} stroke="#1e293b" strokeWidth="1" />
              <text x="35" y={y + 4} textAnchor="end" className="text-[#64748b]" fontSize="10">
                {y === 0 ? "6K" : y === 50 ? "3K" : "0"}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const x = 60 + i * 95;
            const barW = 35;
            const normalH = (d.normal / maxNormal) * 140;
            const fraudH = (d.fraud / maxFraud) * 80;
            return (
              <g key={d.day}>
                <rect x={x} y={170 - normalH} width={barW} height={normalH} rx="4" fill="#3b82f6" fillOpacity="0.6" />
                <rect x={x + barW + 4} y={170 - fraudH} width={barW} height={fraudH} rx="4" fill="#ef4444" fillOpacity="0.7" />
                <text x={x + barW / 2} y="188" textAnchor="middle" className="text-[#64748b]" fontSize="10">{d.day}</text>
              </g>
            );
          })}

          <line x1="40" y1="170" x2="690" y2="170" stroke="#334155" strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
}
