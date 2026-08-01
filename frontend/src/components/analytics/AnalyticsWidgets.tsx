"use client";

import { useState, useEffect } from "react";
import { Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { supabase } from "@/lib/supabase";
import type { Role } from "@/lib/roles";
import {
  COLORS,
  SCORE_COLORS,
  RULE_COLORS,
  type TrendPoint,
  type GeoPoint,
  type ChannelPoint,
  type DevicePoint,
  type MerchantPoint,
  type MlPoint,
  type RiskBucketPoint,
  type RulePoint,
  type AmountBucketPoint,
  type HourPoint,
  type AccountPoint,
  type CategoryPoint,
  aggregateTrend,
  aggregateGeo,
  aggregateChannel,
  aggregateMerchants,
  aggregateMlScores,
  aggregateDevices,
  aggregateRiskBuckets,
  aggregateRules,
  aggregateAmounts,
  aggregateHours,
  aggregateAccounts,
  aggregateCategories,
} from "@/lib/analytics";

export type WidgetKey =
  | "trend" | "anomaly" | "riskDist" | "geo" | "velocity" | "devices"
  | "amount" | "categories" | "hour" | "rules" | "accounts" | "merchants";

const ROLE_WIDGETS: Record<Role, WidgetKey[]> = {
  user: ["trend"],
  analyst: ["trend", "anomaly", "riskDist", "geo", "rules", "accounts", "devices"],
  investigator: ["trend", "riskDist", "geo", "velocity", "amount", "categories", "hour", "merchants"],
  admin: ["trend", "anomaly", "riskDist", "geo", "velocity", "devices", "amount", "categories", "hour", "rules", "accounts", "merchants"],
};

const SUMMARY_WIDGETS: Record<Role, WidgetKey[]> = {
  user: ["trend"],
  analyst: ["trend", "geo", "riskDist", "anomaly", "rules"],
  investigator: ["trend", "geo", "riskDist", "categories"],
  admin: ["trend", "geo", "riskDist", "velocity", "rules"],
};

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

export default function AnalyticsWidgets({
  variant = "full",
  role = "investigator",
  widgets,
}: {
  variant?: "full" | "summary";
  role?: Role;
  widgets?: WidgetKey[];
}) {
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [geoData, setGeoData] = useState<GeoPoint[]>([]);
  const [channelData, setChannelData] = useState<ChannelPoint[]>([]);
  const [deviceData, setDeviceData] = useState<DevicePoint[]>([]);
  const [merchantData, setMerchantData] = useState<MerchantPoint[]>([]);
  const [mlData, setMlData] = useState<MlPoint[]>([]);
  const [riskData, setRiskData] = useState<RiskBucketPoint[]>([]);
  const [ruleData, setRuleData] = useState<RulePoint[]>([]);
  const [amountData, setAmountData] = useState<AmountBucketPoint[]>([]);
  const [hourData, setHourData] = useState<HourPoint[]>([]);
  const [accountData, setAccountData] = useState<AccountPoint[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryPoint[]>([]);

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
      setRiskData(aggregateRiskBuckets(txns));
      setRuleData(aggregateRules(txns));
      setAmountData(aggregateAmounts(txns));
      setHourData(aggregateHours(txns));
      setAccountData(aggregateAccounts(txns));
      setCategoryData(aggregateCategories(txns));
    });
    return () => {
      active = false;
    };
  }, []);

  const isFull = variant === "full";
  const roleWidgets = widgets && widgets.length > 0 ? widgets : ROLE_WIDGETS[role] || [];
  const summaryWidgets = SUMMARY_WIDGETS[role] || [];
  const visible = (key: WidgetKey) => roleWidgets.includes(key) && (isFull || summaryWidgets.includes(key));

  return (
    <>
      {visible("trend") && (
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
      )}

      {visible("anomaly") && (
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

      {visible("riskDist") && (
        <Widget title="Risk Score Distribution" subtitle="Transaction volume by risk bucket" className="lg:col-span-2 delay-5 scan-line">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskData.length > 0 ? riskData : []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="range" stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="normal" stackId="r" name="Normal" fill="#00f0ff" />
                <Bar dataKey="fraud" stackId="r" name="Fraud" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Widget>
      )}

      {visible("geo") && (
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
      )}

      {visible("velocity") && (
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
      )}

      {visible("devices") && (
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
      )}

      {visible("amount") && (
        <Widget title="Fraud by Amount" subtitle="Transaction count & fraud per amount range" className="lg:col-span-2 delay-6 scan-line">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={amountData.length > 0 ? amountData : []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="range" stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="normal" stackId="a" name="Normal" fill="#00f0ff" />
                <Bar dataKey="fraud" stackId="a" name="Fraud" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Widget>
      )}

      {visible("categories") && (
        <Widget title="Merchant Categories" subtitle="Fraud vs normal by category" className="delay-6 scan-line">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData.length > 0 ? categoryData : []} layout="vertical" margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis dataKey="category" type="category" width={90} stroke="#64748b" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="normal" stackId="c" name="Normal" fill="#00f0ff" />
                <Bar dataKey="fraud" stackId="c" name="Fraud" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Widget>
      )}

      {visible("hour") && (
        <Widget title="Fraud by Hour of Day" subtitle="Activity pattern & fraud hotspots" className="lg:col-span-2 delay-6 scan-line">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourData.length > 0 ? hourData : []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="hour" stroke="#64748b" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="normal" stackId="h" name="Normal" fill="#00f0ff" />
                <Bar dataKey="fraud" stackId="h" name="Fraud" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Widget>
      )}

      {visible("rules") && (
        <Widget title="Rule Trigger Frequency" subtitle="Most-firing fraud rules by severity" className="delay-6 scan-line">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ruleData.length > 0 ? ruleData : []} layout="vertical" margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis dataKey="rule" type="category" width={110} stroke="#64748b" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Triggers" radius={[0, 4, 4, 0]}>
                  {ruleData.map((d: RulePoint, i: number) => (
                    <Cell key={i} fill={RULE_COLORS[d.severity] || "#00f0ff"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Widget>
      )}

      {visible("accounts") && (
        <Widget title="Top High-Risk Accounts" subtitle="Accounts with most suspicious activity" className="delay-6 scan-line">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={accountData.length > 0 ? accountData : []} margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="account" stroke="#64748b" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Suspicious" radius={[4, 4, 0, 0]}>
                  {accountData.map((_: AccountPoint, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Widget>
      )}

      {visible("merchants") && (
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
