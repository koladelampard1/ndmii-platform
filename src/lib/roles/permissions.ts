import { UserRole } from "@/types/roles";
import { ROLE_ROUTE_PREFIXES, isPublicPath } from "@/lib/auth/authorization";

export const roleRouteMap: Record<UserRole, string[]> = {
  public: ["/", "/verify", "/login", "/register", "/access-denied"],
  msme: ROLE_ROUTE_PREFIXES.msme,
  association_officer: ROLE_ROUTE_PREFIXES.association_officer,
  reviewer: ROLE_ROUTE_PREFIXES.reviewer,
  fccpc_officer: ROLE_ROUTE_PREFIXES.fccpc_officer,
  firs_officer: ROLE_ROUTE_PREFIXES.firs_officer,
  admin: ["/dashboard"],
};

export function isRouteAllowed(role: UserRole, pathname: string) {
  if (isPublicPath(pathname)) return true;
  if (role === "public") return false;
  if (role === "admin") return pathname.startsWith("/dashboard");
  return roleRouteMap[role].some((route) => pathname.startsWith(route));
}
