import { createClient as createBrowserClient } from "@/utils/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

const ML_API = process.env.NEXT_PUBLIC_ML_API_URL || "http://localhost:5001";

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

export interface Account {
  id: number;
  user_id: string;
  account_name: string;
  account_number: string;
  balance: number;
  currency: string;
  created_at: string;
}

export interface Transfer {
  id: number;
  sender_account_id: number;
  receiver_account_id: number;
  sender_name: string;
  receiver_name: string;
  amount: number;
  note: string;
  status: "completed" | "pending" | "failed";
  created_at: string;
}

export interface DashboardStats {
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
    try {
      const res = await fetch(`/api/proxy?path=stats`);
      if (res.ok) return await res.json();
    } catch { /* fallback to direct query */ }

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
    const pageSize = 1000;
    const all: Transaction[] = [];
    try {
      for (let offset = 0; offset < limit; offset += pageSize) {
        const size = Math.min(pageSize, limit - offset);
        const res = await fetch(`/api/proxy?path=transactions&limit=${size}&offset=${offset}`);
        if (!res.ok) throw new Error("ML proxy error");
        const json = await res.json();
        const page = (json.data || []) as Transaction[];
        all.push(...page);
        if (page.length < size) break;
      }
    } catch {
      const { data } = await this.getClient()
        .from("transactions")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(Math.min(limit, 1000));
      return (data || []) as Transaction[];
    }
    return all;
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

  async getUserProfile(userId: string): Promise<{ role: string | null } | null> {
    try {
      const { data } = await this.getClient()
        .from("user_profiles")
        .select("role")
        .eq("id", userId)
        .single();
      return data as { role: string | null } | null;
    } catch {
      return null;
    }
  }

  async getAccounts(userId: string): Promise<Account[]> {
    const { data } = await this.getClient()
      .from("accounts")
      .select("*")
      .eq("user_id", userId)
      .order("id");
    return (data || []) as Account[];
  }

  async getTransfers(accountIds: number[]): Promise<Transfer[]> {
    if (accountIds.length === 0) return [];
    const { data } = await this.getClient()
      .from("transfers")
      .select("*")
      .or(accountIds.map((id) => `sender_account_id.eq.${id},receiver_account_id.eq.${id}`).join(","))
      .order("created_at", { ascending: false })
      .limit(20);
    return (data || []) as Transfer[];
  }

  async lookupRecipient(query: string): Promise<{ id: number; account_name: string; account_number: string; email: string } | null> {
    const { data, error } = await this.getClient().rpc("lookup_recipient", { search_query: query.trim() });
    if (error || !data) return null;
    const result = data as { success: boolean; data?: { id: number; account_name: string; account_number: string; email: string }; error?: string };
    if (!result.success || !result.data) return null;
    return result.data;
  }

  async transferMoney(senderAccountId: number, receiverAccountId: number, amount: number, note?: string): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await this.getClient().rpc("transfer_money", {
      sender_acc_id: senderAccountId,
      receiver_acc_id: receiverAccountId,
      transfer_amount: amount,
      transfer_note: note || "",
    });
    if (error) return { success: false, error: error.message };
    const result = data as { success: boolean; error: string | null };
    return { success: result.success, error: result.error || undefined };
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
