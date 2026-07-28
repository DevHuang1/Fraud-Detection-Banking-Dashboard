import { createClient as createBrowserClient } from "@/utils/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface Transaction {
  id: number;
  transaction_id: string;
  account_id: string;
  account_name: string;
  card_last_four: string;
  amount: number;
  currency: string;
  merchant: string;
  merchant_category: string;
  region: string;
  city: string;
  country: string;
  transaction_type: string;
  channel: string;
  timestamp: string;
  status: string;
  risk_score: number;
  risk_level: "low" | "medium" | "high" | "critical";
  is_fraud: boolean;
  is_suspicious: boolean;
  ml_fraud_probability: number;
  rule_triggers: { rule: string; severity: string }[];
  device_id: string;
  ip_address: string;
  user_agent: string;
  latitude: number;
  longitude: number;
}

export interface FraudCase {
  id: number;
  transaction_id: number;
  case_number: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "investigating" | "resolved" | "dismissed";
  assigned_to: string;
  fraud_type: string;
  amount_at_risk: number;
  is_confirmed_fraud: boolean;
  created_at: string;
}

export interface Alert {
  id: number;
  transaction_id: number;
  alert_type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface DashboardStats {
  totalTransactions: number;
  suspiciousTransactions: number;
  confirmedFraud: number;
  blockedAttempts: number;
  avgRiskScore: number;
  highRiskAccounts: number;
  fraudRate: number;
  unreadAlerts: number;
}

class SupabaseService {
  private client: SupabaseClient;

  constructor() {
    this.client = createBrowserClient();
  }

  getClient(): SupabaseClient {
    if (!this.client) this.client = createBrowserClient();
    return this.client;
  }

  async login(email: string, password: string): Promise<{ user?: any; session?: any; error?: string }> {
    const { data, error } = await this.getClient().auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { error: error.message };
    return data;
  }

  async getUser() {
    const { data } = await this.getClient().auth.getUser();
    return data?.user || null;
  }

  logout() {
    this.getClient().auth.signOut();
  }

  async getSession() {
    const { data } = await this.getClient().auth.getSession();
    return data?.session || null;
  }

  async getStats(): Promise<DashboardStats> {
    const client = this.getClient();
    const { data: txs } = await client.from("transactions").select("status,risk_level,is_fraud,is_suspicious,risk_score,amount");
    const { data: alerts } = await client.from("alerts").select("id").eq("is_read", false);
    const total = txs?.length || 0;
    const suspicious = txs?.filter((t: any) => t.is_suspicious).length || 0;
    const confirmedFraud = txs?.filter((t: any) => t.is_fraud).length || 0;
    const blocked = txs?.filter((t: any) => t.status === "blocked").length || 0;
    const avgRisk = (txs || []).reduce((s: number, t: any) => s + (t.risk_score || 0), 0) / (total || 1);
    const highRisk = txs?.filter((t: any) => t.risk_level === "high" || t.risk_level === "critical").length || 0;
    const fraudRate = total > 0 ? (confirmedFraud / total) * 100 : 0;
    return {
      totalTransactions: total,
      suspiciousTransactions: suspicious,
      confirmedFraud,
      blockedAttempts: blocked,
      avgRiskScore: Math.round(avgRisk * 100) / 100,
      highRiskAccounts: highRisk,
      fraudRate: Math.round(fraudRate * 100) / 100,
      unreadAlerts: alerts?.length || 0,
    };
  }

  async getTransactions(limit = 100): Promise<Transaction[]> {
    const { data } = await this.getClient()
      .from("transactions")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(limit);
    return (data || []) as Transaction[];
  }

  async getTransaction(id: number): Promise<Transaction | null> {
    const { data } = await this.getClient()
      .from("transactions")
      .select("*")
      .eq("id", id)
      .single();
    return data as Transaction | null;
  }

  async getCases(): Promise<FraudCase[]> {
    const { data } = await this.getClient()
      .from("fraud_cases")
      .select("*")
      .order("created_at", { ascending: false });
    return (data || []) as FraudCase[];
  }

  async updateCase(id: number, updates: Partial<FraudCase>) {
    const { data } = await this.getClient()
      .from("fraud_cases")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    return data;
  }

  async getAlerts(): Promise<Alert[]> {
    const { data } = await this.getClient()
      .from("alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    return (data || []) as Alert[];
  }

  async getRules() {
    const { data } = await this.getClient()
      .from("fraud_rules")
      .select("*")
      .order("hit_count", { ascending: false });
    return data || [];
  }

  subscribeToChannel(channel: string, event: string, callback: (payload: any) => void) {
    const subscription = this.getClient()
      .channel(channel)
      .on("postgres_changes" as any, {
        event: event as any,
        schema: "public",
        table: channel,
      }, (payload: any) => callback(payload))
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }
}

export const supabase = new SupabaseService();
