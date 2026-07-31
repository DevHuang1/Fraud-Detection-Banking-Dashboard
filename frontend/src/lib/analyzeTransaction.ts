import type { Transaction } from "./supabase";

export type SignalStatus = "clean" | "warn" | "critical";

export interface Signal {
  key: string;
  label: string;
  status: SignalStatus;
  detail: string;
}

export interface AccountStats {
  total: number;
  avgAmount: number;
  maxAmount: number;
  last24hCount: number;
  last7dCount: number;
}

export interface RelatedGroup {
  key: string;
  label: string;
  count: number;
  recent: Transaction[];
}

export interface BreakdownItem {
  label: string;
  value: number;
}

export interface TransactionAnalysis {
  signals: Signal[];
  breakdown: BreakdownItem[];
  accountStats: AccountStats;
  related: RelatedGroup[];
  deviceType: string;
  isNewDevice: boolean;
  ipSeenBefore: boolean;
  distanceFromHomeKm: number | null;
  merchantRisk: "low" | "medium" | "high";
  recommendations: string[];
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function detectDevice(ua?: string): string {
  if (!ua) return "Unknown Device";
  if (/iPhone/i.test(ua)) return "iPhone (Mobile)";
  if (/Android/i.test(ua)) return "Android (Mobile)";
  if (/Macintosh/i.test(ua)) return "macOS (Desktop)";
  if (/Windows/i.test(ua)) return "Windows (Desktop)";
  if (/Linux/i.test(ua)) return "Linux (Desktop)";
  return "Unknown Device";
}

function merchantRiskLevel(category?: string): "low" | "medium" | "high" {
  const c = (category || "").toLowerCase();
  if (["cryptocurrency", "money transfer", "wire transfer", "gambling"].some((k) => c.includes(k))) return "high";
  if (["travel", "gas & fuel", "gas", "electronics", "entertainment", "commerce", "digital wallet", "telecom", "utilities", "home improvement"].some((k) => c.includes(k))) return "medium";
  return "low";
}

function dominantRegion(txns: Transaction[]): string | null {
  const counts = new Map<string, number>();
  for (const t of txns) {
    if (!t.region) continue;
    counts.set(t.region, (counts.get(t.region) || 0) + 1);
  }
  let best: string | null = null;
  let max = 0;
  counts.forEach((c, r) => {
    if (c > max) {
      max = c;
      best = r;
    }
  });
  return best;
}

function weight(s: SignalStatus): number {
  return s === "critical" ? 1 : s === "warn" ? 0.5 : 0;
}

export function computeAnalysis(tx: Transaction, related: Transaction[]): TransactionAnalysis {
  const accountTxns = related.filter((t) => t.account_id === tx.account_id);
  const amounts = accountTxns.map((t) => t.amount || 0);
  const avgAmount = amounts.length ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0;
  const maxAmount = amounts.length ? Math.max(...amounts) : 0;

  const now = Date.now();
  const inLast24h = (t: Transaction) => now - new Date(t.timestamp).getTime() < 86400000;
  const inLast7d = (t: Transaction) => now - new Date(t.timestamp).getTime() < 7 * 86400000;
  const last24hCount = accountTxns.filter(inLast24h).length;
  const last7dCount = accountTxns.filter(inLast7d).length;

  const withCoords = accountTxns.filter(
    (t) => typeof t.latitude === "number" && typeof t.longitude === "number",
  );
  let homeLat: number | null = null;
  let homeLon: number | null = null;
  if (withCoords.length >= 2) {
    const lats = withCoords.map((t) => t.latitude as number).sort((a, b) => a - b);
    const lons = withCoords.map((t) => t.longitude as number).sort((a, b) => a - b);
    homeLat = lats[Math.floor(lats.length / 2)];
    homeLon = lons[Math.floor(lons.length / 2)];
  }

  let distanceFromHomeKm: number | null = null;
  if (
    homeLat !== null &&
    homeLon !== null &&
    typeof tx.latitude === "number" &&
    typeof tx.longitude === "number"
  ) {
    distanceFromHomeKm = Math.round(haversineKm(homeLat, homeLon, tx.latitude, tx.longitude));
  }

  const deviceType = detectDevice(tx.user_agent);
  const isNewDevice = !related.some(
    (t) => t.device_id && t.device_id === tx.device_id && t.id !== tx.id,
  );
  const ipSeenBefore = related.some(
    (t) => t.ip_address && t.ip_address === tx.ip_address && t.id !== tx.id,
  );
  const merchantRisk = merchantRiskLevel(tx.merchant_category);
  const hour = new Date(tx.timestamp).getHours();

  const fmtAmount = (v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const signals: Signal[] = [];

  if (avgAmount > 0 && tx.amount > avgAmount) {
    const ratio = tx.amount / avgAmount;
    const status: SignalStatus =
      ratio >= 5 || (maxAmount > 0 && tx.amount >= maxAmount * 1.5) ? "critical" : ratio >= 2 ? "warn" : "clean";
    signals.push({
      key: "amount",
      label: "Amount Anomaly",
      status,
      detail: `${fmtAmount(tx.amount)} vs typical ${fmtAmount(avgAmount)} (${ratio.toFixed(1)}x)`,
    });
  } else {
    signals.push({
      key: "amount",
      label: "Amount Anomaly",
      status: "clean",
      detail: `Within typical range (avg ${fmtAmount(avgAmount)})`,
    });
  }

  signals.push({
    key: "velocity",
    label: "Transaction Velocity",
    status: last24hCount >= 10 ? "critical" : last24hCount >= 5 ? "warn" : "clean",
    detail: `${last24hCount} other txns on this account in the last 24h`,
  });

  let geoStatus: SignalStatus = "clean";
  let geoDetail = "Location matches account history";
  if (distanceFromHomeKm !== null) {
    geoStatus = distanceFromHomeKm >= 5000 ? "critical" : distanceFromHomeKm >= 1000 ? "warn" : "clean";
    geoDetail = `${distanceFromHomeKm.toLocaleString()} km from account's typical location`;
  } else {
    const dominant = dominantRegion(accountTxns);
    if (dominant && tx.region && dominant !== tx.region) {
      geoStatus = "warn";
      geoDetail = `Region ${tx.region} differs from usual ${dominant}`;
    } else if (!dominant) {
      geoDetail = "Insufficient location history";
    }
  }
  signals.push({ key: "geo", label: "Geo Anomaly", status: geoStatus, detail: geoDetail });

  signals.push({
    key: "device",
    label: "Device Fingerprint",
    status: isNewDevice ? "warn" : "clean",
    detail: isNewDevice ? `${deviceType} not seen before on this account` : `Known ${deviceType} device`,
  });

  signals.push({
    key: "ip",
    label: "IP Address",
    status: ipSeenBefore ? "clean" : "warn",
    detail: ipSeenBefore ? "IP address seen previously" : "IP address not seen before on this account",
  });

  signals.push({
    key: "merchant",
    label: "Merchant Risk",
    status: merchantRisk === "high" ? "critical" : merchantRisk === "medium" ? "warn" : "clean",
    detail: `${tx.merchant} · ${tx.merchant_category || "Unknown"} category risk`,
  });

  const offHours = hour >= 1 && hour < 5;
  signals.push({
    key: "time",
    label: "Time of Day",
    status: offHours ? "warn" : "clean",
    detail: `${new Date(tx.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}${offHours ? " — unusual off-hours activity" : ""}`,
  });

  const mlProb = tx.ml_fraud_probability || 0;
  signals.push({
    key: "ml",
    label: "ML Model Score",
    status: mlProb >= 0.7 ? "critical" : mlProb >= 0.4 ? "warn" : "clean",
    detail: `Model predicts ${(mlProb * 100).toFixed(1)}% fraud probability`,
  });

  const sig = (k: string): SignalStatus => signals.find((s) => s.key === k)?.status || "clean";
  const breakdown: BreakdownItem[] = [
    { label: "ML Model Score", value: Math.min(1, mlProb) },
    { label: "Amount Anomaly", value: weight(sig("amount")) },
    { label: "Transaction Velocity", value: weight(sig("velocity")) },
    { label: "Geo Anomaly", value: weight(sig("geo")) },
    { label: "Device Fingerprint", value: weight(sig("device")) },
    { label: "IP Novelty", value: weight(sig("ip")) },
    { label: "Merchant Risk", value: weight(sig("merchant")) },
  ];

  const group = (key: string, label: string, list: Transaction[]) => ({
    key,
    label,
    count: list.length,
    recent: list.slice(0, 3),
  });
  const relatedGroups: RelatedGroup[] = [
    group("account", "Same Account", accountTxns),
    group("device", "Same Device", related.filter((t) => t.device_id && t.device_id === tx.device_id)),
    group("ip", "Same IP", related.filter((t) => t.ip_address && t.ip_address === tx.ip_address)),
    group("card", "Same Card", related.filter((t) => t.card_last_four === tx.card_last_four)),
  ].filter((g) => g.count > 0);

  const recommendations: string[] = [];
  const push = (status: SignalStatus, msg: string) => {
    if (status !== "clean") recommendations.push(msg);
  };
  push(sig("velocity"), "Rapid-fire activity detected — review recent transactions on this account.");
  push(sig("device"), "New device fingerprint — confirm ownership with the cardholder.");
  push(sig("geo"), "Geo anomaly — verify identity before releasing funds.");
  push(sig("amount"), "Amount deviates from account baseline — cross-check with the customer.");
  push(sig("merchant"), "High-risk merchant category — escalate to a fraud investigator.");
  if (mlProb >= 0.4) recommendations.push("Elevated ML score — prioritize for manual review.");
  if (recommendations.length === 0) recommendations.push("No immediate action required — continue monitoring.");

  return {
    signals,
    breakdown,
    accountStats: { total: accountTxns.length, avgAmount, maxAmount, last24hCount, last7dCount },
    related: relatedGroups,
    deviceType,
    isNewDevice,
    ipSeenBefore,
    distanceFromHomeKm,
    merchantRisk,
    recommendations,
  };
}
