import { createClient as createBrowserClient } from "@/utils/supabase/client";
import type { RealtimePostgresChangesPayload, Session, SupabaseClient, User } from "@supabase/supabase-js";

type RealtimeRow = { [key: string]: string | number | boolean | null };

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

  async login(email: string, password: string): Promise<{ user?: User; session?: Session; error?: string }> {
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
    type TxRow = Pick<Transaction, "status" | "risk_level" | "is_fraud" | "is_suspicious" | "risk_score">;
    const { data: txs } = (await client.from("transactions").select("status,risk_level,is_fraud,is_suspicious,risk_score,amount")) as unknown as { data: TxRow[] | null };
    const { data: alerts } = await client.from("alerts").select("id").eq("is_read", false);
    const total = txs?.length || 0;
    const suspicious = txs?.filter((t) => t.is_suspicious).length || 0;
    const confirmedFraud = txs?.filter((t) => t.is_fraud).length || 0;
    const blocked = txs?.filter((t) => t.status === "blocked").length || 0;
    const avgRisk = (txs || []).reduce((s: number, t) => s + (t.risk_score || 0), 0) / (total || 1);
    const highRisk = txs?.filter((t) => t.risk_level === "high" || t.risk_level === "critical").length || 0;
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

  async updateTransactionStatus(
    id: number,
    updates: Partial<Pick<Transaction, "status" | "is_fraud" | "is_suspicious" | "risk_level">>,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/proxy?path=/api/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) return { success: true };
        return { success: false, error: json.error || "Update failed" };
      }
    } catch {
      /* fall back to direct client update below */
    }

    try {
      const { data, error } = await this.getClient()
        .from("transactions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) return { success: false, error: error.message };
      if (!data) return { success: false, error: "Transaction not found" };
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Update failed" };
    }
  }

  async getRelatedTransactions(tx: Transaction, limit = 50): Promise<Transaction[]> {
    const q = (v: string) => `"${v.replace(/"/g, "")}"`;
    const filters: string[] = [];
    if (tx.account_id) filters.push(`account_id.eq.${q(tx.account_id)}`);
    if (tx.device_id) filters.push(`device_id.eq.${q(tx.device_id)}`);
    if (tx.ip_address) filters.push(`ip_address.eq.${q(tx.ip_address)}`);
    if (tx.card_last_four) filters.push(`card_last_four.eq.${q(tx.card_last_four)}`);
    if (filters.length === 0) return [];

    try {
      const { data } = await this.getClient()
        .from("transactions")
        .select("*")
        .or(filters.join(","))
        .order("timestamp", { ascending: false })
        .limit(limit);
      return ((data || []) as Transaction[]).filter((t) => t.id !== tx.id);
    } catch {
      return [];
    }
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

  async createCase(data: {
    title: string;
    description?: string;
    severity?: FraudCase["severity"];
    fraud_type?: string;
    amount_at_risk?: number;
    assigned_to?: string;
    assigned_by?: string;
    transaction_id?: number;
  }): Promise<{ success: boolean; error?: string; id?: number }> {
    const case_number = `FC-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 900 + 100)}`;
    const { data: row, error } = await this.getClient()
      .from("fraud_cases")
      .insert({ ...data, case_number, status: "open", is_confirmed_fraud: false })
      .select("id")
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, id: row.id };
  }

  async getAlerts(): Promise<Alert[]> {
    const { data } = await this.getClient()
      .from("alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    return (data || []) as Alert[];
  }

  async getUserProfile(userId: string): Promise<{ role: string | null; full_name: string | null; email: string | null } | null> {
    try {
      const { data } = await this.getClient()
        .from("user_profiles")
        .select("role,full_name,email")
        .eq("id", userId)
        .single();
      return data as { role: string | null; full_name: string | null; email: string | null } | null;
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

  async getUsernamesByAccountNumbers(accountNumbers: string[]): Promise<Record<string, string>> {
    if (accountNumbers.length === 0) return {};
    const { data, error } = await this.getClient().rpc("resolve_account_usernames", {
      account_numbers: accountNumbers,
    });
    if (error || !data) return {};
    return (data as Record<string, string>) || {};
  }

  async getUsernamesByAccountIds(accountIds: number[]): Promise<Record<number, string>> {
    if (accountIds.length === 0) return {};
    const { data, error } = await this.getClient().rpc("resolve_account_id_usernames", {
      account_ids: accountIds,
    });
    if (error || !data) return {};
    const out: Record<number, string> = {};
    for (const [k, v] of Object.entries(data as Record<string, string>)) {
      const id = Number(k);
      if (!Number.isNaN(id)) out[id] = v;
    }
    return out;
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

  async updateRule(id: number, updates: Partial<{ name: string; description: string; severity: string; is_active: boolean; action: string }>) {
    const { data, error } = await this.getClient()
      .from("fraud_rules")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  async getTransactionsByAccounts(accountNumbers: string[], limit = 50): Promise<Transaction[]> {
    if (accountNumbers.length === 0) return [];
    try {
      const { data } = await this.getClient()
        .from("transactions")
        .select("*")
        .in("account_id", accountNumbers)
        .order("timestamp", { ascending: false })
        .limit(limit);
      return (data || []) as Transaction[];
    } catch {
      return [];
    }
  }

  async listUsers(): Promise<{ id: string; email: string; full_name: string; role: string; created_at: string }[]> {
    const { data } = await this.getClient()
      .from("user_profiles")
      .select("*")
      .order("created_at", { ascending: false });
    return (data || []) as { id: string; email: string; full_name: string; role: string; created_at: string }[];
  }

  async updateUserRole(userId: string, role: string) {
    const { data, error } = await this.getClient()
      .from("user_profiles")
      .update({ role })
      .eq("id", userId)
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  async createUserProfile(email: string, fullName: string, role: string): Promise<{ success: boolean; error?: string; id?: string }> {
    const { data, error } = await this.getClient()
      .from("user_profiles")
      .insert({ email, full_name: fullName, role })
      .select("id")
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, id: data.id };
  }

  async deleteUserProfile(userId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await this.getClient()
      .from("user_profiles")
      .delete()
      .eq("id", userId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  subscribeToChannel(channel: string, event: "INSERT" | "UPDATE" | "DELETE", callback: (payload: RealtimePostgresChangesPayload<RealtimeRow>) => void) {
    const subscription = this.getClient()
      .channel(channel)
      .on("postgres_changes", {
        event,
        schema: "public",
        table: channel,
      }, callback)
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }
}

export const supabase = new SupabaseService();
