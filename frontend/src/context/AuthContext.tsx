"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export type UserRole = "user" | "analyst" | "investigator" | "admin";

interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole | null;
  is_ceo: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
  hasRole: (...roles: UserRole[]) => boolean;
  updateName: (name: string) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({}),
  logout: () => {},
  isAuthenticated: false,
  hasRole: () => false,
  updateName: async () => ({}),
});

async function resolveProfile(userId: string, authUser?: { user_metadata?: unknown; app_metadata?: unknown }): Promise<{ role: UserRole | null; full_name: string | null; is_ceo: boolean }> {
  const valid = (r: string) => ["user", "analyst", "investigator", "admin"].includes(r);
  const metaRole = (authUser?.user_metadata as { role?: string } | undefined)?.role;
  const appRole = (authUser?.app_metadata as { role?: string } | undefined)?.role;
  // user_profiles is the source of truth — role changes via Team Management
  // only update this table, so it must win over stale auth metadata.
  try {
    const profile = await supabase.getUserProfile(userId);
    if (profile) {
      return {
        role: profile.role && valid(profile.role) ? (profile.role as UserRole) : null,
        full_name: profile.full_name || null,
        is_ceo: !!profile.is_ceo,
      };
    }
  } catch {}
  try {
    const freshUser = await supabase.getUser();
    const r = (freshUser?.user_metadata as { role?: string } | undefined)?.role;
    if (r && valid(r)) return { role: r as UserRole, full_name: null, is_ceo: false };
    const ar = (freshUser?.app_metadata as { role?: string } | undefined)?.role;
    if (ar && valid(ar)) return { role: ar as UserRole, full_name: null, is_ceo: false };
  } catch {}
  if (metaRole && valid(metaRole)) return { role: metaRole as UserRole, full_name: null, is_ceo: false };
  if (appRole && valid(appRole)) return { role: appRole as UserRole, full_name: null, is_ceo: false };
  return { role: null, full_name: null, is_ceo: false };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const knownUserIdRef = useRef<string | null>(null);
  const loggingInRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const authUser = await supabase.getUser();
      if (cancelled) return;
      if (authUser) {
        const profile = await resolveProfile(authUser.id, authUser);
        if (!cancelled) {
          knownUserIdRef.current = authUser.id;
          setUser({
            id: authUser.id,
            email: authUser.email || "",
            full_name: profile.full_name,
            role: profile.role,
            is_ceo: profile.is_ceo,
          });
        }
      }
      if (!cancelled) setLoading(false);
    })();

    const { data: listener } = supabase.getClient().auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setLoading(false);
        // login()/initial-session path already fetched the profile; skip the
        // duplicate network call when the same user is already known.
        if (knownUserIdRef.current === session.user.id || loggingInRef.current) return;
        knownUserIdRef.current = session.user.id;
        const profile = await resolveProfile(session.user.id, session.user);
        setUser({
          id: session.user.id,
          email: session.user.email || "",
          full_name: profile.full_name,
          role: profile.role,
          is_ceo: profile.is_ceo,
        });
      } else {
        knownUserIdRef.current = null;
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      listener?.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    loggingInRef.current = true;
    const result = await supabase.login(email, password);
    if (result.error) {
      loggingInRef.current = false;
      return { error: result.error };
    }
    const session = await supabase.getSession();
    loggingInRef.current = false;
    if (session?.user) {
      knownUserIdRef.current = session.user.id;
      const profile = await resolveProfile(session.user.id, session.user);
      const usr = {
        id: session.user.id,
        email: session.user.email || "",
        full_name: profile.full_name,
        role: profile.role,
        is_ceo: profile.is_ceo,
      };
      setUser(usr);
      return { user: usr };
    }
    return {};
  }, []);

  const logout = useCallback(() => {
    supabase.logout();
    setUser(null);
  }, []);

  const hasRole = useCallback((...roles: UserRole[]): boolean => {
    if (!user?.role) return false;
    return roles.includes(user.role);
  }, [user]);

  const updateName = useCallback(async (name: string) => {
    if (!user?.id) return { error: "Not signed in" };
    const res = await supabase.updateProfileName(user.id, name);
    if (!res.success) return { error: res.error || "Failed to update name" };
    setUser((prev) => (prev ? { ...prev, full_name: name } : prev));
    return {};
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user, hasRole, updateName }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
