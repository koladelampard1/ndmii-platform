import type { UserRole } from "@/types/roles";

export const ROLE_HOME: Record<Exclude<UserRole, "public">, string> = {
  admin: "/dashboard/executive",
  reviewer: "/dashboard/reviews",
  fccpc_officer: "/dashboard/fccpc",
  firs_officer: "/dashboard/firs",
  association_officer: "/dashboard/associations",
  msme: "/dashboard/msme",
};

const SHARED_DASHBOARD_PATHS = ["/dashboard", "/dashboard/compliance", "/dashboard/reports", "/dashboard/audit"];

const ROLE_SPECIFIC_PREFIXES: Record<Exclude<UserRole, "public">, string[]> = {
  admin: ["/dashboard"],
  reviewer: ["/dashboard/reviews"],
  fccpc_officer: ["/dashboard/fccpc"],
  firs_officer: ["/dashboard/firs", "/dashboard/payments"],
  association_officer: ["/dashboard/associations"],
  msme: ["/dashboard/msme"],
};

export function getDefaultDashboardRoute(role: UserRole): string {
  if (role === "public") return "/login";
  return ROLE_HOME[role];
}

export function isPublicPath(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/verify") || pathname === "/login" || pathname === "/register";
}

export function isRoleAllowedPath(role: UserRole, pathname: string): boolean {
  if (isPublicPath(pathname)) return true;
  if (role === "public") return false;
  if (role === "admin") return pathname.startsWith("/dashboard");

  if (SHARED_DASHBOARD_PATHS.includes(pathname)) return true;

  return ROLE_SPECIFIC_PREFIXES[role].some((prefix) => pathname.startsWith(prefix));
}
