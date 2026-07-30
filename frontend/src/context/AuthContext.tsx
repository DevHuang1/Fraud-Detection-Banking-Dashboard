"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export type UserRole = "user" | "analyst" | "investigator" | "admin";

interface User {
  id: string;
  email: string;
  role: UserRole | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({}),
  logout: () => {},
  isAuthenticated: false,
  hasRole: () => false,
});

async function resolveRole(userId: string, authUser?: any): Promise<UserRole | null> {
  const valid = (r: string) => ["user", "analyst", "investigator", "admin"].includes(r);
  try {
    const freshUser = await supabase.getUser();
    const r = freshUser?.user_metadata?.role;
    if (r && valid(r)) return r as UserRole;
    const ar = freshUser?.app_metadata?.role;
    if (ar && valid(ar)) return ar as UserRole;
  } catch {}
  if (authUser) {
    const r = authUser.user_metadata?.role;
    if (r && valid(r)) return r as UserRole;
    const ar = authUser.app_metadata?.role;
    if (ar && valid(ar)) return ar as UserRole;
  }
  try {
    const profile = await supabase.getUserProfile(userId);
    if (profile?.role && valid(profile.role)) return profile.role as UserRole;
  } catch {}
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await supabase.getSession();
      if (cancelled) return;
      if (session) {
        const authUser = session.user;
        if (authUser) {
          const role = await resolveRole(authUser.id, authUser);
          if (!cancelled) {
            setUser({
              id: authUser.id,
              email: authUser.email || "",
              role,
            });
          }
        }
      }
      if (!cancelled) setLoading(false);
    })();

    const { data: listener } = supabase.getClient().auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const role = await resolveRole(session.user.id, session.user);
        setUser({
          id: session.user.id,
          email: session.user.email || "",
          role,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
      listener?.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await supabase.login(email, password);
    if (result.error) return { error: result.error };
    const session = await supabase.getSession();
    if (session?.user) {
      const role = await resolveRole(session.user.id, session.user);
      setUser({
        id: session.user.id,
        email: session.user.email || "",
        role,
      });
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

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
