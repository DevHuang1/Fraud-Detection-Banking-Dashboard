import type { Transaction } from "@/lib/supabase";

export const COLORS = ["#00f0ff", "#8b5cf6", "#ec4899", "#f59e0b", "#22ff8b", "#3b82f6", "#f472b6", "#a3e635"];

export const SCORE_COLORS = ["#22ff8b", "#00f0ff", "#f59e0b", "#ef4444", "#ef4444"];

export const RULE_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f59e0b",
  medium: "#00f0ff",
  low: "#22ff8b",
};

export interface TrendPoint {
  day: string;
  fraud: number;
  normal: number;
  score: number;
}

export interface GeoPoint {
  region: string;
  name?: string;
  value: number;
  pct: number;
}

export interface ChannelPoint {
  channel: string;
  approved: number;
  blocked: number;
}

export interface DevicePoint {
  name: string;
  value: number;
}

export interface MerchantPoint {
  merchant: string;
  count: number;
  blocked: number;
  score: number;
}

export interface MlPoint {
  range: string;
  count: number;
}

export interface RiskBucketPoint {
  range: string;
  normal: number;
  fraud: number;
}

export interface RulePoint {
  rule: string;
  count: number;
  severity: string;
}

export interface AmountBucketPoint {
  range: string;
  normal: number;
  fraud: number;
}

export interface HourPoint {
  hour: string;
  normal: number;
  fraud: number;
}

export interface AccountPoint {
  account: string;
  count: number;
}

export interface CategoryPoint {
  category: string;
  normal: number;
  fraud: number;
}

export function aggregateTrend(txns: Transaction[]) {
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

export function aggregateGeo(txns: Transaction[]) {
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

export function aggregateChannel(txns: Transaction[]) {
  const buckets: Record<string, { approved: number; blocked: number }> = {};
  for (const t of txns) {
    const ch = t.channel || "Other";
    if (!buckets[ch]) buckets[ch] = { approved: 0, blocked: 0 };
    if (t.status === "blocked" || t.is_fraud) buckets[ch].blocked++;
    else buckets[ch].approved++;
  }
  return Object.entries(buckets).map(([channel, v]) => ({ channel, ...v }));
}

export function aggregateMerchants(txns: Transaction[]) {
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

export function aggregateMlScores(txns: Transaction[]) {
  const buckets = [0, 0, 0, 0, 0];
  const labels = ["0-20", "20-40", "40-60", "60-80", "80-100"];
  for (const t of txns) {
    const p = (t.ml_fraud_probability || 0) * 100;
    const idx = Math.min(4, Math.floor(p / 20));
    buckets[idx]++;
  }
  return labels.map((range, i) => ({ range, count: buckets[i] }));
}

export function aggregateDevices(txns: Transaction[]) {
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

export function aggregateRiskBuckets(txns: Transaction[]) {
  const labels = ["0-20", "20-40", "40-60", "60-80", "80-100"];
  const buckets = Array.from({ length: 5 }, () => ({ normal: 0, fraud: 0 }));
  for (const t of txns) {
    const idx = Math.min(4, Math.floor((t.risk_score || 0) / 20));
    if (t.is_fraud) buckets[idx].fraud++;
    else buckets[idx].normal++;
  }
  return labels.map((range, i) => ({ range, ...buckets[i] }));
}

export function aggregateRules(txns: Transaction[]) {
  const sevRank: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
  const map: Record<string, { count: number; severity: string }> = {};
  for (const t of txns) {
    for (const tr of t.rule_triggers || []) {
      if (!map[tr.rule]) map[tr.rule] = { count: 0, severity: "low" };
      map[tr.rule].count++;
      const rank = sevRank[tr.severity] ?? 0;
      if (rank > (sevRank[map[tr.rule].severity] ?? 0)) map[tr.rule].severity = tr.severity;
    }
  }
  return Object.entries(map)
    .map(([rule, v]) => ({ rule, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

export function aggregateAmounts(txns: Transaction[]) {
  const ranges = [
    { label: "<$100", min: 0, max: 100 },
    { label: "$100-500", min: 100, max: 500 },
    { label: "$500-1k", min: 500, max: 1000 },
    { label: "$1k-5k", min: 1000, max: 5000 },
    { label: "$5k-10k", min: 5000, max: 10000 },
    { label: "$10k+", min: 10000, max: Infinity },
  ];
  const buckets = ranges.map((r) => ({ range: r.label, normal: 0, fraud: 0 }));
  for (const t of txns) {
    const idx = ranges.findIndex((r) => (t.amount || 0) >= r.min && (t.amount || 0) < r.max);
    if (idx === -1) continue;
    if (t.is_fraud) buckets[idx].fraud++;
    else buckets[idx].normal++;
  }
  return buckets;
}

export function aggregateHours(txns: Transaction[]) {
  const buckets = Array.from({ length: 24 }, () => ({ normal: 0, fraud: 0 }));
  for (const t of txns) {
    const h = new Date(t.timestamp).getHours();
    if (t.is_fraud) buckets[h].fraud++;
    else buckets[h].normal++;
  }
  return buckets.map((b, i) => ({ hour: `${String(i).padStart(2, "0")}:00`, ...b }));
}

export function aggregateAccounts(txns: Transaction[]) {
  const map: Record<string, number> = {};
  for (const t of txns) {
    if (!t.is_suspicious && !t.is_fraud) continue;
    if (!t.account_id) continue;
    map[t.account_id] = (map[t.account_id] || 0) + 1;
  }
  return Object.entries(map)
    .map(([account, count]) => ({
      account: account.length > 10 ? `${account.slice(0, 8)}…` : account,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export function aggregateCategories(txns: Transaction[]) {
  const map: Record<string, { normal: number; fraud: number }> = {};
  for (const t of txns) {
    const c = t.merchant_category || "Other";
    if (!map[c]) map[c] = { normal: 0, fraud: 0 };
    if (t.is_fraud) map[c].fraud++;
    else map[c].normal++;
  }
  return Object.entries(map)
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.normal + b.fraud - (a.normal + a.fraud))
    .slice(0, 6);
}
