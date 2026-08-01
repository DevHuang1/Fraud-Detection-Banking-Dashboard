"use client";

import { useState, useEffect, useCallback } from "react";
import { Icons } from "@/components/ui/Icons";
import { supabase } from "@/lib/supabase";
import { ROLE_COLOR, ROLE_LABEL, VALID_ROLES, type Role } from "@/lib/roles";
import { useAuth } from "@/context/AuthContext";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_ceo: boolean;
  created_at: string;
}

export default function TeamManagement() {
  const { user: currentUser } = useAuth();
  const isCeo = !!currentUser?.is_ceo;
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState({ email: "", full_name: "", role: "analyst" });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const rows = await supabase.listUsers();
    setUsers(rows as UserProfile[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.listUsers().then((rows) => {
      if (!active) return;
      setUsers(rows as UserProfile[]);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase())
  );

  const counts = {
    total: users.length,
    analyst: users.filter((u) => u.role === "analyst").length,
    investigator: users.filter((u) => u.role === "investigator").length,
    admin: users.filter((u) => u.role === "admin").length,
  };

  // Only the CEO can manage admin accounts (other admins, the CEO).
  const isStaffManaged = (u: UserProfile) => u.role === "admin" || u.is_ceo;
  const canManage = (u: UserProfile) => isCeo || !isStaffManaged(u);

  const changeRole = async (user: UserProfile, role: string) => {
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
      setNotice({ type: "success", text: `${user.email} role changed to ${ROLE_LABEL[role as Role]}` });
    }
  };

  const removeUser = async (user: UserProfile) => {
    if (!canManage(user)) {
      setNotice({ type: "error", text: "Only the CEO can remove an admin account" });
      return;
    }
    if (!window.confirm(`Remove ${user.email} from the team?`)) return;
    const res = await supabase.deleteUserProfile(user.id);
    if (!res.success) {
      setNotice({ type: "error", text: res.error || "Failed to remove user" });
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== user.id));
    setNotice({ type: "success", text: `${user.email} removed` });
  };

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    const res = await supabase.createUserProfile(form.email.trim(), form.full_name.trim(), form.role);
    setSaving(false);
    if (!res.success) {
      setNotice({ type: "error", text: res.error || "Failed to add user" });
      return;
    }
    setNotice({ type: "success", text: `${form.email} added as ${ROLE_LABEL[form.role as Role]}` });
    setForm({ email: "", full_name: "", role: "analyst" });
    setAdding(false);
    loadUsers();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {notice && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium ${notice.type === "success" ? "bg-[#22c55e]/10 text-[#22c55e]" : "bg-[#ef4444]/10 text-[#ef4444]"}`}>
          {notice.text}
        </div>
      )}

      <div className="glass-neon rounded-2xl overflow-hidden">
        <div className="p-5 pb-0 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-white">Team Management</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#fbbf24]/10 text-[#fbbf24] border border-[#fbbf24]/20">ADMIN</span>
            </div>
            <p className="text-xs text-[#64748b] mt-0.5 font-mono">Manage analysts, investigators and users</p>
            {!isCeo && <p className="text-[11px] text-[#f59e0b] mt-0.5">Only the CEO can manage admin accounts</p>}
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]"><Icons.search size={14} /></span>
              <input
                type="text"
                placeholder="Search team..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-48 h-9 pl-9 pr-3 rounded-lg text-xs bg-[#1e293b] border border-[#334155] text-white placeholder-[#4a5568] outline-none focus:border-[#00f0ff]/30"
              />
            </div>
            <button
              onClick={() => setAdding((a) => !a)}
              className="h-9 px-4 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#00f0ff] text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg hover:shadow-blue-500/20 transition-all"
            >
              <Icons.plus size={14} /> Add User
            </button>
          </div>
        </div>

        {adding && (
          <form onSubmit={addUser} className="mx-5 mt-4 p-4 rounded-xl bg-[#111827] border border-[#1e293b] grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#64748b] mb-1">Full Name</label>
              <input
                type="text"
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Jane Doe"
                className="w-full h-9 px-3 rounded-lg text-xs bg-[#1e293b] border border-[#334155] text-white outline-none focus:border-[#00f0ff]/30 placeholder-[#4a5568]"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#64748b] mb-1">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jane@banking.demo"
                className="w-full h-9 px-3 rounded-lg text-xs bg-[#1e293b] border border-[#334155] text-white outline-none focus:border-[#00f0ff]/30 placeholder-[#4a5568]"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#64748b] mb-1">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full h-9 px-3 rounded-lg text-xs bg-[#1e293b] border border-[#334155] text-white outline-none focus:border-[#00f0ff]/30"
              >
                {VALID_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                )).filter((o) => isCeo || o.props.value !== "admin")}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 h-9 rounded-lg bg-[#22c55e]/10 text-[#22c55e] text-xs font-semibold hover:bg-[#22c55e]/20 transition-all disabled:opacity-50"
              >
                {saving ? "Adding..." : "Add User"}
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="h-9 px-3 rounded-lg bg-[#1e293b] border border-[#334155] text-[#64748b] text-xs hover:text-white transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-5 py-4">
          {[
            { label: "Total Users", value: counts.total, color: "#00f0ff" },
            { label: "Analysts", value: counts.analyst, color: "#60a5fa" },
            { label: "Investigators", value: counts.investigator, color: "#a78bfa" },
            { label: "Admins", value: counts.admin, color: "#fbbf24" },
          ].map((c) => (
            <div key={c.label} className="rounded-xl bg-[#111827] border border-[#1e293b] px-4 py-3">
              <span className="block text-[10px] uppercase tracking-wider text-[#64748b]">{c.label}</span>
              <span className="block text-lg font-bold text-white tabular-nums mt-0.5" style={{ color: c.color }}>{c.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-neon rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#64748b] text-[11px] uppercase tracking-wider border-y border-[#1e293b]">
                <th className="text-left font-medium px-5 py-3">User</th>
                <th className="text-left font-medium px-5 py-3">Email</th>
                <th className="text-left font-medium px-5 py-3">Role</th>
                <th className="text-left font-medium px-5 py-3">Member Since</th>
                <th className="text-right font-medium px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-[#64748b] text-sm">Loading team...</td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-[#64748b] text-sm">No users match your search</td>
                </tr>
              )}
              {filtered.map((u) => {
                const colors = ROLE_COLOR[(u.role as Role)] || ROLE_COLOR.user;
                const lockable = !canManage(u);
                return (
                  <tr key={u.id} className="border-b border-[#1e293b]/50 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                          {(u.full_name || u.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-white flex items-center gap-1.5">
                            {u.full_name || "—"}
                            {u.is_ceo && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#fbbf24]/15 text-[#fbbf24] border border-[#fbbf24]/25">
                                <Icons.crown size={10} /> CEO
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs text-[#94a3b8]">{u.email}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <select
                        value={u.role}
                        disabled={lockable}
                        onChange={(e) => changeRole(u, e.target.value)}
                        title={lockable ? "Only the CEO can change this account's role" : undefined}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border-0 outline-none cursor-pointer ${lockable ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                        style={{ background: `${colors.dot}15`, color: colors.dot }}
                      >
                        {VALID_ROLES.map((r) => (
                          <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-[#64748b]">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => removeUser(u)}
                        disabled={lockable}
                        className={`p-1.5 rounded-lg transition-all ${lockable ? "text-[#334155] cursor-not-allowed" : "text-[#64748b] hover:text-red-400 hover:bg-red-500/10"}`}
                        title={lockable ? "Only the CEO can remove an admin account" : "Remove from team"}
                      >
                        <Icons.x size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
