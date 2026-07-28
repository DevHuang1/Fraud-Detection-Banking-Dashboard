"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export type UserRole = "analyst" | "investigator" | "admin";

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

function extractRole(data: any): UserRole | null {
  if (!data) return null;
  const role = data.role || data.user_metadata?.role || null;
  if (["analyst", "investigator", "admin"].includes(role)) return role as UserRole;
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
          setUser({
            id: authUser.id,
            email: authUser.email || "",
            role: extractRole(authUser),
          });
        }
      }
      setLoading(false);
    })();

    const { data: listener } = supabase.getClient().auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || "",
          role: extractRole(session.user),
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
      setUser({
        id: session.user.id,
        email: session.user.email || "",
        role: extractRole(session.user),
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
