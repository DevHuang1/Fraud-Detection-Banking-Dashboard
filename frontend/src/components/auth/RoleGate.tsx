"use client";

import type { ReactNode } from "react";
import { useAuth, type UserRole } from "@/context/AuthContext";

interface Props {
  roles: UserRole | UserRole[];
  fallback?: ReactNode;
  children: ReactNode;
}

export default function RoleGate({ roles, fallback = null, children }: Props) {
  const { hasRole } = useAuth();
  const roleList = Array.isArray(roles) ? roles : [roles];
  if (hasRole(...roleList)) return <>{children}</>;
  return <>{fallback}</>;
}
