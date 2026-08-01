"use client";

import { useState, useEffect } from "react";
import { Icons } from "@/components/ui/Icons";
import { supabase, type Alert, type DashboardStats } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-[#ef4444]/15 text-[#ef4444]",
  investigator: "bg-[#8b5cf6]/15 text-[#a78bfa]",
  analyst: "bg-[#3b82f6]/15 text-[#00f0ff]",
  user: "bg-[#22c55e]/15 text-[#22c55e]",
};

const alertSeverityColors: Record<string, string> = {
  critical: "bg-[#ef4444]/15 text-[#ef4444]",
  warning: "bg-[#f59e0b]/15 text-[#f59e0b]",
  info: "bg-[#3b82f6]/15 text-[#00f0ff]",
};

const inputCls = "w-full h-9 px-3 rounded-lg text-xs bg-[#1e293b] border border-[#334155] text-white placeholder-[#4a5568] outline-none focus:border-[#00f0ff]/30";

const DEFAULT_ROLE = "user";

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_ceo: boolean;
  created_at: string;
}

export default function AdminTools() {
  const { user: currentUser } = useAuth();
  const isCeo = !!currentUser?.is_ceo;
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [newUser, setNewUser] = useState({ email: "", full_name: "", role: DEFAULT_ROLE });
  const [saving, setSaving] = useState(false);
  const [alertFilter, setAlertFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  useEffect(() => {
    let active = true;
    Promise.all([supabase.getStats(), supabase.listUsers(), supabase.getAlerts()]).then(([s, u, a]) => {
      if (!active) return;
      setStats(s);
      setUsers(u);
      setAlerts(a);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const filteredUsers = users.filter((u) => roleFilter === "all" || u.role === roleFilter);
  const filteredAlerts = alerts.filter((a) => alertFilter === "all" || a.severity === alertFilter);
  const roleCounts = (r: string) => users.filter((u) => u.role === r).length;

  // Only the CEO can manage admin accounts (other admins, the CEO).
  const isStaffManaged = (u: UserRow) => u.role === "admin" || u.is_ceo;
  const canManage = (u: UserRow) => isCeo || !isStaffManaged(u);

  const changeRole = async (user: UserRow, role: string) => {
    if (role === user.role) return;
    if (!canManage(user)) {
      setNotice({ type: "error", text: "Only the CEO can change the role of an admin account" });
      return;
    }
    const prev = user.role;
    setUsers((prevUsers) => prevUsers.map((u) => (u.id === user.id ? { ...u, role } : u)));
    const res = await supabase.updateUserRole(user.id, role);
    if (!res.success) {
      setUsers((prevUsers) => prevUsers.map((u) => (u.id === user.id ? { ...u, role: prev } : u)));
      setNotice({ type: "error", text: res.error || "Failed to update role" });
    } else {
      setNotice({ type: "success", text: `Role updated to ${role}` });
    }
  };

  const toggleCeo = async (user: UserRow) => {
    if (!isCeo) return;
    const next = !user.is_ceo;
    setUsers((prevUsers) => prevUsers.map((u) => (u.id === user.id ? { ...u, is_ceo: next } : u)));
    const res = await supabase.setUserCeo(user.id, next);
    if (!res.success) {
      setUsers((prevUsers) => prevUsers.map((u) => (u.id === user.id ? { ...u, is_ceo: user.is_ceo } : u)));
      setNotice({ type: "error", text: res.error || "Failed to update CEO status" });
    } else {
      setNotice({ type: "success", text: next ? `${user.email} is now the CEO` : `${user.email} is no longer the CEO` });
    }
  };

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email.trim()) return;
    setSaving(true);
    setNotice(null);
    const res = await supabase.createUserProfile(newUser.email.trim(), newUser.full_name.trim(), newUser.role);
    setSaving(false);
    if (!res.success) {
      setNotice({ type: "error", text: res.error || "Failed to add user" });
      return;
    }
    setNotice({ type: "success", text: `${newUser.email} added with role ${newUser.role}` });
    setNewUser({ email: "", full_name: "", role: DEFAULT_ROLE });
    setUsers(await supabase.listUsers());
  };

  const toggleAlert = async (a: Alert) => {
    const next = !a.is_read;
    setAlerts((prev) => prev.map((x) => (x.id === a.id ? { ...x, is_read: next } : x)));
    const res = await supabase.updateAlert(a.id, { is_read: next });
    if (!res.success) {
      setAlerts((prev) => prev.map((x) => (x.id === a.id ? { ...x, is_read: a.is_read } : x)));
      setNotice({ type: "error", text: res.error || "Failed to update alert" });
    }
  };

  const statCards = stats
    ? [
        { label: "Total Transactions", value: stats.totalTransactions.toLocaleString(), accent: "text-[#00f0ff]" },
        { label: "Suspicious Flagged", value: stats.suspiciousTransactions.toLocaleString(), accent: "text-[#f59e0b]" },
        { label: "Confirmed Fraud", value: stats.confirmedFraud.toLocaleString(), accent: "text-[#ef4444]" },
        { label: "Blocked Attempts", value: stats.blockedAttempts.toLocaleString(), accent: "text-[#a78bfa]" },
        { label: "Avg Risk Score", value: Math.round(stats.avgRiskScore).toLocaleString(), accent: "text-[#22c55e]" },
        { label: "Unread Alerts", value: stats.unreadAlerts.toLocaleString(), accent: "text-[#3b82f6]" },
      ]
    : [];

  return (
    <div className="space-y-5 animate-fade-in">
      {notice && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium ${notice.type === "success" ? "bg-[#22c55e]/10 text-[#22c55e]" : "bg-[#ef4444]/10 text-[#ef4444]"}`}>
          {notice.text}
        </div>
      )}

      <div className="glass-neon rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white">Admin Tools</h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20">ADMIN</span>
          </div>
          <p className="text-xs text-[#64748b] mt-0.5 font-mono">Team management, system overview and alert control</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className="glass-neon rounded-2xl p-4">
            <p className={`text-xl font-bold tabular-nums ${s.accent}`}>{loading ? "..." : s.value}</p>
            <p className="text-[11px] text-[#64748b] mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="glass-neon rounded-2xl overflow-hidden">
        <div className="p-5 pb-0 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Icons.users size={15} className="text-[#00f0ff]" /> Team Management
            </h4>
            <p className="text-xs text-[#64748b] mt-0.5">
              {users.length} users · {roleCounts("admin")} admin · {roleCounts("investigator")} investigator · {roleCounts("analyst")} analyst
            </p>
            {!isCeo && <p className="text-[11px] text-[#f59e0b] mt-0.5">Only the CEO can manage admin accounts</p>}
          </div>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={`${inputCls} w-auto`}>
            <option value="all">All roles</option>
            <option value="admin">Admin</option>
            <option value="investigator">Investigator</option>
            <option value="analyst">Analyst</option>
            <option value="user">User</option>
          </select>
        </div>

        <form onSubmit={addUser} className="mx-5 mt-4 p-4 rounded-xl bg-[#111827] border border-[#1e293b] grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#64748b] mb-1">Email</label>
            <input required type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="user@bank.com" className={inputCls} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#64748b] mb-1">Full Name</label>
            <input value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} placeholder="Jordan Rivera" className={inputCls} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#64748b] mb-1">Role</label>
            <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className={inputCls}>
              <option value="user">User</option>
              <option value="analyst">Analyst</option>
              <option value="investigator">Investigator</option>
              {isCeo && <option value="admin">Admin</option>}
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={saving} className="w-full h-9 rounded-lg bg-gradient-to-r from-[#3b82f6] to-[#00f0ff] text-white text-xs font-semibold shadow-lg hover:shadow-blue-500/20 transition-all disabled:opacity-50">
              {saving ? "Adding..." : "Add User"}
            </button>
          </div>
        </form>

        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#64748b] text-[11px] uppercase tracking-wider border-y border-[#1e293b]">
                <th className="text-left font-medium px-5 py-3">User</th>
                <th className="text-left font-medium px-5 py-3">Role</th>
                <th className="text-left font-medium px-5 py-3">Joined</th>
                <th className="text-right font-medium px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const lockable = !canManage(u);
                return (
                <tr key={u.id} className="border-b border-[#1e293b]/50 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3">
                    <span className="block text-xs text-white flex items-center gap-1.5">
                      {u.full_name || u.email}
                      {u.is_ceo && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#fbbf24]/15 text-[#fbbf24] border border-[#fbbf24]/25">
                          <Icons.crown size={10} /> CEO
                        </span>
                      )}
                    </span>
                    <span className="block font-mono text-[10px] text-[#64748b]">{u.email}</span>
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={u.role}
                      disabled={lockable}
                      onChange={(e) => changeRole(u, e.target.value)}
                      title={lockable ? "Only the CEO can change this account's role" : undefined}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border-0 outline-none cursor-pointer ${ROLE_COLORS[u.role] || ROLE_COLORS.user} ${lockable ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      <option value="user">user</option>
                      <option value="analyst">analyst</option>
                      <option value="investigator">investigator</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs text-[#64748b]">{new Date(u.created_at).toLocaleDateString()}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {isCeo && (
                      <button
                        onClick={() => toggleCeo(u)}
                        className={`p-1.5 rounded-lg transition-all ${u.is_ceo ? "text-[#fbbf24] hover:text-[#facc15]" : "text-[#475569] hover:text-[#fbbf24]"}`}
                        title={u.is_ceo ? "Revoke CEO status" : "Grant CEO status"}
                      >
                        <Icons.crown size={16} />
                      </button>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-neon rounded-2xl overflow-hidden">
        <div className="p-5 pb-0 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Icons.bell size={15} className="text-[#f59e0b]" /> Alert Management
            </h4>
            <p className="text-xs text-[#64748b] mt-0.5">{alerts.filter((a) => !a.is_read).length} unread alerts</p>
          </div>
          <select value={alertFilter} onChange={(e) => setAlertFilter(e.target.value)} className={`${inputCls} w-auto`}>
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>
        <div className="p-5 pt-3 space-y-2">
          {loading && <p className="text-xs text-[#64748b] text-center py-6">Loading alerts...</p>}
          {!loading && filteredAlerts.length === 0 && <p className="text-xs text-[#64748b] text-center py-6">No alerts match the current filter</p>}
          {filteredAlerts.map((a) => (
            <div key={a.id} className={`flex items-start justify-between gap-3 p-4 rounded-xl border transition-colors ${a.is_read ? "bg-[#0b0f1a] border-[#1e293b]" : "bg-[#111827] border-[#334155]"}`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${alertSeverityColors[a.severity] || ""}`}>{a.severity}</span>
                  <span className="text-xs font-semibold text-white truncate">{a.title}</span>
                  {!a.is_read && <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-pulse" />}
                </div>
                <p className="text-xs text-[#94a3b8] mt-1">{a.message}</p>
                <p className="font-mono text-[10px] text-[#64748b] mt-1">tx {a.transaction_id} · {a.alert_type} · {new Date(a.created_at).toLocaleString()}</p>
              </div>
              <button
                onClick={() => toggleAlert(a)}
                className={`shrink-0 h-8 px-3 rounded-lg text-[11px] font-semibold border transition-all ${a.is_read ? "border-[#334155] text-[#64748b] hover:text-white" : "border-[#f59e0b]/40 text-[#f59e0b] hover:bg-[#f59e0b]/10"}`}
              >
                {a.is_read ? "Reopen" : "Mark Read"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
