import { UserRole } from "@/types/roles";

export const roleRouteMap: Record<UserRole, string[]> = {
  public: ["/", "/verify", "/login", "/register"],
  msme: ["/dashboard", "/dashboard/msme", "/dashboard/complaints", "/dashboard/payments"],
  association_officer: ["/dashboard", "/dashboard/associations", "/dashboard/msmes"],
  reviewer: ["/dashboard", "/dashboard/reviews", "/dashboard/compliance"],
  fccpc_officer: ["/dashboard", "/dashboard/complaints", "/dashboard/enforcement"],
  firs_officer: ["/dashboard", "/dashboard/payments", "/dashboard/tax"],
  admin: ["/dashboard", "/dashboard/admin", "/dashboard/settings"],
};

export function isRouteAllowed(role: UserRole, pathname: string) {
  if (pathname.startsWith("/verify")) return true;
  return roleRouteMap[role].some((route) => pathname.startsWith(route));
}
