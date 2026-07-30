"use client";

import { useState, useEffect, useCallback } from "react";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { supabase, type Transaction } from "@/lib/supabase";

const COLORS = ["#00f0ff", "#8b5cf6", "#ec4899", "#f59e0b", "#22ff8b"];
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;
  return (
    <div className="glass !bg-[#111827] px-3 py-2 rounded-xl text-xs border border-[#334155] shadow-xl">
      <p className="text-[#94a3b8] mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

interface WidgetProps {
  title: string;
  subtitle: string;
  className?: string;
  children: React.ReactNode;
}

function Widget({ title, subtitle, className, children }: WidgetProps) {
  return (
    <div className={`glass rounded-2xl p-5 animate-slide-up ${className || ""}`}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="text-xs text-[#64748b] mt-0.5">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function aggregateTrend(txns: Transaction[]) {
  const buckets: Record<string, { fraud: number; normal: number; scoreSum: number; count: number }> = {};
  for (const n of dayNames) buckets[n] = { fraud: 0, normal: 0, scoreSum: 0, count: 0 };
  for (const t of txns) {
    const d = dayNames[new Date(t.timestamp).getDay()];
    if (t.is_fraud) buckets[d].fraud++;
    else buckets[d].normal++;
    buckets[d].scoreSum += t.risk_score || 0;
    buckets[d].count++;
  }
  return dayNames.map((day) => ({
    day,
    fraud: buckets[day].fraud,
    normal: buckets[day].normal,
    score: buckets[day].count > 0 ? Math.round(buckets[day].scoreSum / buckets[day].count) : 0,
  }));
}

function aggregateGeo(txns: Transaction[]) {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const t of txns) {
    if (t.is_suspicious || t.is_fraud) {
      const r = t.region || "Unknown";
      counts[r] = (counts[r] || 0) + 1;
      total++;
    }
  }
  if (total === 0) return [];
  return Object.entries(counts)
    .map(([region, value]) => ({ region, value: Math.round((value / total) * 100) }))
    .sort((a, b) => b.value - a.value);
}

function aggregateChannel(txns: Transaction[]) {
  const buckets: Record<string, { approved: number; blocked: number }> = {};
  for (const t of txns) {
    const ch = t.channel || "Other";
    if (!buckets[ch]) buckets[ch] = { approved: 0, blocked: 0 };
    if (t.status === "blocked" || t.is_fraud) buckets[ch].blocked++;
    else buckets[ch].approved++;
  }
  return Object.entries(buckets).map(([channel, v]) => ({ channel, ...v }));
}

function aggregateDevices(txns: Transaction[]) {
  const known = new Set<string>();
  const suspicious = new Set<string>();
  const all = new Set<string>();
  for (const t of txns) {
    if (!t.device_id) continue;
    all.add(t.device_id);
    if (t.is_suspicious) suspicious.add(t.device_id);
    else known.add(t.device_id);
  }
  if (all.size === 0) return [];
  const total = all.size;
  const k = Math.round((known.size / total) * 100);
  const s = Math.round((suspicious.size / total) * 100);
  const n = Math.max(0, 100 - k - s);
  return [
    { name: "Known Devices", value: k },
    { name: "New Devices", value: n },
    { name: "Suspicious", value: s },
  ];
}

export default function AnalyticsWidgets() {
  const [trendData, setTrendData] = useState<any[]>([]);
  const [geoData, setGeoData] = useState<any[]>([]);
  const [channelData, setChannelData] = useState<any[]>([]);
  const [deviceData, setDeviceData] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    const txns = await supabase.getTransactions(1000);
    setTrendData(aggregateTrend(txns));
    setGeoData(aggregateGeo(txns));
    setChannelData(aggregateChannel(txns));
    setDeviceData(aggregateDevices(txns));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <>
      <Widget title="Fraud Trend Analysis" subtitle="Daily fraud incidents & risk score" className="lg:col-span-2 delay-4 scan-line">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData.length > 0 ? trendData : [{ day: "Mon", fraud: 0, normal: 0, score: 0 }, { day: "Tue", fraud: 0, normal: 0, score: 0 }, { day: "Wed", fraud: 0, normal: 0, score: 0 }, { day: "Thu", fraud: 0, normal: 0, score: 0 }, { day: "Fri", fraud: 0, normal: 0, score: 0 }, { day: "Sat", fraud: 0, normal: 0, score: 0 }, { day: "Sun", fraud: 0, normal: 0, score: 0 }]}>
              <defs>
                <linearGradient id="fraudGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="fraud" stroke="#ef4444" fill="url(#fraudGrad)" strokeWidth={2} dot={{ r: 3, fill: "#ef4444", strokeWidth: 0 }} />
              <Line type="monotone" dataKey="score" stroke="#f59e0b" strokeWidth={2} dot={false} name="Risk Score" strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Widget>

      <Widget title="Anomaly Detection" subtitle="ML-based outlier analysis" className="delay-5 scan-line">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData.length > 0 ? trendData : []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="fraud" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Widget>

      <Widget title="Suspicious Geography" subtitle="High-risk regions" className="delay-5 scan-line">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={geoData.length > 0 ? geoData : [{ region: "No Data", value: 100 }]} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                {(geoData.length > 0 ? geoData : [{ region: "No Data", value: 100 }]).map((_: any, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            {(geoData.length > 0 ? geoData : []).map((d: any, i: number) => (
              <div key={d.region} className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                <span className="text-[#94a3b8]">{d.region}</span>
                <span className="text-white ml-auto font-medium">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </Widget>

      <Widget title="Transaction Velocity" subtitle="Channel breakdown" className="lg:col-span-2 delay-5 scan-line">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={channelData.length > 0 ? channelData : []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="channel" type="category" stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="approved" fill="#22ff8b" radius={[0, 4, 4, 0]} name="Approved" />
              <Bar dataKey="blocked" fill="#ef4444" radius={[0, 4, 4, 0]} name="Blocked" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Widget>

      <Widget title="Device Fingerprints" subtitle="Known vs suspicious devices" className="delay-6 scan-line">
        <div className="h-56 flex flex-col items-center justify-center">
          <div className="relative w-32 h-32">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              {(deviceData.length > 0 ? deviceData : []).map((d: any, i: number, arr: any[]) => {
                const offset = arr.slice(0, i).reduce((s: number, x: any) => s + x.value, 0);
                const circumference = 2 * Math.PI * 14;
                const dash = (d.value / 100) * circumference;
                return (
                  <circle key={i} cx="18" cy="18" r="14" fill="none" stroke={COLORS[i]} strokeWidth="4"
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeDashoffset={-((offset / 100) * circumference)}
                    style={{ transition: "stroke-dasharray 1s ease" }}
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-2xl font-bold text-white">{deviceData.length > 0 ? deviceData[0].value : 0}%</span>
              <span className="text-[10px] text-[#64748b]">Known</span>
            </div>
          </div>
          <div className="flex gap-4 mt-3">
            {(deviceData.length > 0 ? deviceData : []).map((d: any, i: number) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                <span className="text-[#94a3b8]">{d.name}</span>
                <span className="text-white font-medium">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </Widget>
    </>
  );
}
