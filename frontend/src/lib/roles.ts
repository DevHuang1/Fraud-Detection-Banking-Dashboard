export type Role = "user" | "analyst" | "investigator" | "admin";

export const VALID_ROLES: Role[] = ["user", "analyst", "investigator", "admin"];

export const ROLE_HOME: Record<Role, string> = {
  user: "/",
  analyst: "/analyst",
  investigator: "/investigator",
  admin: "/admin",
};

export const ROLE_LABEL: Record<Role, string> = {
  user: "User",
  analyst: "Analyst",
  investigator: "Investigator",
  admin: "Admin",
};

export const ROLE_COLOR: Record<Role, { text: string; dot: string }> = {
  user: { text: "#64748b", dot: "#64748b" },
  analyst: { text: "#60a5fa", dot: "#60a5fa" },
  investigator: { text: "#a78bfa", dot: "#a78bfa" },
  admin: { text: "#fbbf24", dot: "#fbbf24" },
};

export const ALLOWED_WORKSPACE_ROLES: Record<string, Role[]> = {
  analyst: ["analyst", "investigator", "admin"],
  investigator: ["investigator", "admin"],
  admin: ["admin"],
};

export interface NavItem {
  label: string;
  icon: string;
  key: string;
}

export const WORKSPACE_NAV: Record<Role, NavItem[]> = {
  user: [],
  analyst: [
    { label: "Overview", icon: "dashboard", key: "overview" },
    { label: "Transactions", icon: "activity", key: "transactions" },
    { label: "Fraud Cases", icon: "shield", key: "cases" },
    { label: "Analytics", icon: "barChart", key: "analytics" },
    { label: "Detection Flow", icon: "nodes", key: "flow" },
    { label: "Reports", icon: "fileText", key: "reports" },
  ],
  investigator: [
    { label: "Overview", icon: "dashboard", key: "overview" },
    { label: "Transactions", icon: "activity", key: "transactions" },
    { label: "Fraud Cases", icon: "shield", key: "cases" },
    { label: "Analytics", icon: "barChart", key: "analytics" },
    { label: "Detection Flow", icon: "nodes", key: "flow" },
    { label: "Rules Engine", icon: "settings", key: "rules" },
    { label: "Reports", icon: "fileText", key: "reports" },
  ],
  admin: [
    { label: "Overview", icon: "dashboard", key: "overview" },
    { label: "Transactions", icon: "activity", key: "transactions" },
    { label: "Fraud Cases", icon: "shield", key: "cases" },
    { label: "Analytics", icon: "barChart", key: "analytics" },
    { label: "Detection Flow", icon: "nodes", key: "flow" },
    { label: "Rules Engine", icon: "settings", key: "rules" },
    { label: "Reports", icon: "fileText", key: "reports" },
    { label: "Team", icon: "users", key: "team" },
  ],
};

export function homePathForRole(role: Role | null | undefined): string {
  if (role && VALID_ROLES.includes(role)) return ROLE_HOME[role];
  return "/";
}
