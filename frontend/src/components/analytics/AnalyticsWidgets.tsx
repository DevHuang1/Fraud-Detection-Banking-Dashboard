"use client";

import { useState, useEffect } from "react";
import { Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { supabase, type Transaction } from "@/lib/supabase";

const COLORS = ["#00f0ff", "#8b5cf6", "#ec4899", "#f59e0b", "#22ff8b", "#3b82f6", "#f472b6", "#a3e635"];

const SCORE_COLORS = ["#22ff8b", "#00f0ff", "#f59e0b", "#ef4444", "#ef4444"];

interface TooltipEntry {
  color: string;
  name: string;
  value: number;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="glass !bg-[#111827] px-3 py-2 rounded-xl text-xs border border-[#334155] shadow-xl">
      <p className="text-[#94a3b8] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

interface TrendPoint {
  day: string;
  fraud: number;
  normal: number;
  score: number;
}

interface GeoPoint {
  region: string;
  name?: string;
  value: number;
  pct: number;
}

interface ChannelPoint {
  channel: string;
  approved: number;
  blocked: number;
}

interface DevicePoint {
  name: string;
  value: number;
}

interface MerchantPoint {
  merchant: string;
  count: number;
  blocked: number;
  score: number;
}

interface MlPoint {
  range: string;
  count: number;
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
  const keys: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    keys.push(key);
    buckets[key] = { fraud: 0, normal: 0, scoreSum: 0, count: 0 };
  }
  for (const t of txns) {
    const d = new Date(t.timestamp);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    if (!buckets[key]) continue;
    if (t.is_fraud) buckets[key].fraud++;
    else buckets[key].normal++;
    buckets[key].scoreSum += t.risk_score || 0;
    buckets[key].count++;
  }
  return keys.map((key) => {
    const b = buckets[key];
    const [, m, day] = key.split("-");
    return {
      day: `${m}/${day}`,
      fraud: b.fraud,
      normal: b.normal,
      score: b.count > 0 ? Math.round(b.scoreSum / b.count) : 0,
    };
  });
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
    .map(([region, value]) => ({ region, name: region, value, pct: Math.round((value / total) * 100) }))
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

function aggregateMerchants(txns: Transaction[]) {
  const map: Record<string, { count: number; scoreSum: number; blocked: number }> = {};
  for (const t of txns) {
    const m = t.merchant || "Unknown";
    if (!map[m]) map[m] = { count: 0, scoreSum: 0, blocked: 0 };
    map[m].count++;
    map[m].scoreSum += t.risk_score || 0;
    if (t.status === "blocked" || t.is_fraud) map[m].blocked++;
  }
  return Object.entries(map)
    .map(([merchant, v]) => ({
      merchant,
      count: v.count,
      blocked: v.blocked,
      score: v.count > 0 ? Math.round(v.scoreSum / v.count) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

function aggregateMlScores(txns: Transaction[]) {
  const buckets = [0, 0, 0, 0, 0];
  const labels = ["0-20", "20-40", "40-60", "60-80", "80-100"];
  for (const t of txns) {
    const p = (t.ml_fraud_probability || 0) * 100;
    const idx = Math.min(4, Math.floor(p / 20));
    buckets[idx]++;
  }
  return labels.map((range, i) => ({ range, count: buckets[i] }));
}

function aggregateDevices(txns: Transaction[]) {
  const freq: Record<string, number> = {};
  const suspicious = new Set<string>();
  for (const t of txns) {
    if (!t.device_id) continue;
    freq[t.device_id] = (freq[t.device_id] || 0) + 1;
    if (t.is_fraud) suspicious.add(t.device_id);
  }
  const all = Object.keys(freq);
  if (all.length === 0) return [];
  const total = all.length;
  const pct = (n: number) => Math.round((n / total) * 100);
  const known = all.filter((id) => !suspicious.has(id) && freq[id] > 1).length;
  const fresh = all.filter((id) => !suspicious.has(id) && freq[id] === 1).length;
  return [
    { name: "Known Devices", value: pct(known) },
    { name: "New Devices", value: pct(fresh) },
    { name: "Suspicious", value: pct(suspicious.size) },
  ];
}

export default function AnalyticsWidgets({ variant = "full" }: { variant?: "full" | "summary" }) {
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [geoData, setGeoData] = useState<GeoPoint[]>([]);
  const [channelData, setChannelData] = useState<ChannelPoint[]>([]);
  const [deviceData, setDeviceData] = useState<DevicePoint[]>([]);
  const [merchantData, setMerchantData] = useState<MerchantPoint[]>([]);
  const [mlData, setMlData] = useState<MlPoint[]>([]);

  useEffect(() => {
    let active = true;
    supabase.getTransactions(5000).then((txns) => {
      if (!active) return;
      setTrendData(aggregateTrend(txns));
      setGeoData(aggregateGeo(txns));
      setChannelData(aggregateChannel(txns));
      setDeviceData(aggregateDevices(txns));
      setMerchantData(aggregateMerchants(txns));
      setMlData(aggregateMlScores(txns));
    });
    return () => {
      active = false;
    };
  }, []);

  const isFull = variant === "full";

  return (
    <>
      <Widget title="Fraud Trend Analysis" subtitle="Daily fraud incidents & risk score" className="lg:col-span-2 delay-4 scan-line">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="fraudGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="normGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#00f0ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="count" stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis yAxisId="score" orientation="right" stroke="#f59e0b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Area yAxisId="count" type="monotone" dataKey="normal" name="Normal" stroke="#00f0ff" fill="url(#normGrad)" strokeWidth={2} dot={false} />
              <Area yAxisId="count" type="monotone" dataKey="fraud" name="Fraud" stroke="#ef4444" fill="url(#fraudGrad)" strokeWidth={2} dot={{ r: 3, fill: "#ef4444", strokeWidth: 0 }} />
              <Line yAxisId="score" type="monotone" dataKey="score" stroke="#f59e0b" strokeWidth={2} dot={false} name="Avg Risk Score" strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Widget>

      {isFull && (
        <Widget title="Anomaly Detection" subtitle="ML fraud probability distribution" className="delay-5 scan-line">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mlData.length > 0 ? mlData : []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="range" stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Txns" radius={[4, 4, 0, 0]}>
                  {mlData.map((_: MlPoint, i: number) => (
                    <Cell key={i} fill={SCORE_COLORS[i % SCORE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Widget>
      )}

      <Widget title="Suspicious Geography" subtitle="High-risk regions" className="delay-5 scan-line">
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={geoData.length > 0 ? geoData : [{ region: "No Data", name: "No Data", value: 1, pct: 100 }]} cx="50%" cy="50%" innerRadius={55} outerRadius={100} paddingAngle={3} dataKey="value">
                {(geoData.length > 0 ? geoData : [{ region: "No Data", name: "No Data", value: 1, pct: 100 }]).map((_: GeoPoint, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 space-y-1.5">
          {(geoData.length > 0 ? geoData : []).map((d: GeoPoint, i: number) => (
            <div key={d.region} className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i] }} />
              <span className="text-[#94a3b8] truncate">{d.region}</span>
              <span className="text-white ml-auto font-medium tabular-nums">{d.value.toLocaleString()} · {d.pct}%</span>
            </div>
          ))}
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
              <Bar dataKey="approved" stackId="a" fill="#22ff8b" name="Approved" />
              <Bar dataKey="blocked" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} name="Blocked" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Widget>

      <Widget title="Device Fingerprints" subtitle="Known vs suspicious devices" className="delay-6 scan-line">
        <div className="h-60 flex flex-col items-center justify-center">
          <div className="relative w-44 h-44">
            <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
              {(deviceData.length > 0 ? deviceData : []).map((d: DevicePoint, i: number, arr: DevicePoint[]) => {
                const offset = arr.slice(0, i).reduce((s: number, x: DevicePoint) => s + x.value, 0);
                const circumference = 2 * Math.PI * 17;
                const dash = (d.value / 100) * circumference;
                return (
                  <circle key={i} cx="20" cy="20" r="17" fill="none" stroke={COLORS[i]} strokeWidth="5"
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
            {(deviceData.length > 0 ? deviceData : []).map((d: DevicePoint, i: number) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                <span className="text-[#94a3b8]">{d.name}</span>
                <span className="text-white font-medium">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </Widget>

      {isFull && (
        <Widget title="Top Merchants" subtitle="Highest-traffic merchants by avg risk" className="lg:col-span-2 delay-6 scan-line">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={merchantData} layout="vertical" margin={{ left: 0, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis dataKey="merchant" type="category" width={120} stroke="#64748b" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Txns" radius={[0, 4, 4, 0]}>
                  {merchantData.map((d: MerchantPoint, i: number) => (
                    <Cell key={i} fill={SCORE_COLORS[Math.min(4, Math.max(0, Math.floor(d.score / 20)))]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Widget>
      )}
    </>
  );
}
