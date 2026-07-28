"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth, type UserRole } from "@/context/AuthContext";

interface Props {
  roles?: UserRole | UserRole[];
  children: ReactNode;
}

export default function ProtectedRoute({ roles, children }: Props) {
  const { user, loading, hasRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0e1a" }}>
        <div className="w-12 h-12 rounded-2xl accent-gradient mx-auto flex items-center justify-center shadow-lg animate-pulse">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="6" width="20" height="14" rx="2" /><path d="M12 2L2 6h20z" /><line x1="8" y1="12" x2="8" y2="16" /><line x1="12" y1="12" x2="12" y2="16" /><line x1="16" y1="12" x2="16" y2="16" /></svg>
        </div>
        <p className="text-[#64748b] text-sm">Authenticating...</p>
      </div>
    );
  }

  if (!user) return null;

  if (roles) {
    const roleList = Array.isArray(roles) ? roles : [roles];
    if (!hasRole(...roleList)) {
      router.push("/");
      return null;
    }
  }

  return <>{children}</>;
}
