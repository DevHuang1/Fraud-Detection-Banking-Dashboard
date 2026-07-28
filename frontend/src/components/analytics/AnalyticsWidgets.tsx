"use client";

import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const trendData = [
  { day: "Mon", fraud: 12, normal: 4200, score: 65 },
  { day: "Tue", fraud: 18, normal: 3800, score: 72 },
  { day: "Wed", fraud: 8, normal: 5100, score: 58 },
  { day: "Thu", fraud: 24, normal: 4600, score: 81 },
  { day: "Fri", fraud: 31, normal: 5400, score: 88 },
  { day: "Sat", fraud: 15, normal: 2900, score: 62 },
  { day: "Sun", fraud: 9, normal: 2100, score: 55 },
];

const geoData = [
  { region: "North America", value: 42 },
  { region: "Europe", value: 28 },
  { region: "Asia Pacific", value: 18 },
  { region: "LATAM", value: 8 },
  { region: "Africa", value: 4 },
];

const deviceData = [
  { name: "Known Devices", value: 76 },
  { name: "New Devices", value: 15 },
  { name: "Suspicious", value: 9 },
];

const channelData = [
  { channel: "Online", approved: 8200, blocked: 89 },
  { channel: "POS", approved: 5400, blocked: 34 },
  { channel: "ATM", approved: 2100, blocked: 56 },
  { channel: "Wire", approved: 980, blocked: 78 },
  { channel: "Mobile", approved: 4300, blocked: 45 },
];

const COLORS = ["#3b82f6", "#06b6d4", "#8b5cf6", "#f59e0b", "#ef4444"];

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

export default function AnalyticsWidgets() {
  return (
    <>
      <Widget title="Fraud Trend Analysis" subtitle="Daily fraud incidents & risk score" className="lg:col-span-2 delay-4">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="fraudGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="fraud" stroke="#ef4444" fill="url(#fraudGrad)" strokeWidth={2} />
              <Line type="monotone" dataKey="score" stroke="#f59e0b" strokeWidth={2} dot={false} name="Risk Score" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Widget>

      <Widget title="Anomaly Detection" subtitle="ML-based outlier analysis" className="delay-5">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="fraud" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Widget>

      <Widget title="Suspicious Geography" subtitle="High-risk regions" className="delay-5">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={geoData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                {geoData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            {geoData.map((d, i) => (
              <div key={d.region} className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                <span className="text-[#94a3b8]">{d.region}</span>
                <span className="text-white ml-auto font-medium">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </Widget>

      <Widget title="Transaction Velocity" subtitle="Channel breakdown" className="lg:col-span-2 delay-5">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={channelData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="channel" type="category" stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="approved" fill="#22c55e" radius={[0, 4, 4, 0]} name="Approved" />
              <Bar dataKey="blocked" fill="#ef4444" radius={[0, 4, 4, 0]} name="Blocked" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Widget>

      <Widget title="Device Fingerprints" subtitle="Known vs suspicious devices" className="delay-6">
        <div className="h-56 flex flex-col items-center justify-center">
          <div className="relative w-32 h-32">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              {deviceData.map((d, i) => {
                const offset = deviceData.slice(0, i).reduce((s, x) => s + x.value, 0);
                const circumference = 2 * Math.PI * 14;
                const dash = (d.value / 100) * circumference;
                return (
                  <circle key={i} cx="18" cy="18" r="14" fill="none" stroke={COLORS[i]} strokeWidth="4"
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeDashoffset={-((deviceData.slice(0, i).reduce((s, x) => s + x.value, 0) / 100) * circumference)}
                    style={{ transition: "stroke-dasharray 1s ease" }}
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-2xl font-bold text-white">76%</span>
              <span className="text-[10px] text-[#64748b]">Known</span>
            </div>
          </div>
          <div className="flex gap-4 mt-3">
            {deviceData.map((d, i) => (
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
