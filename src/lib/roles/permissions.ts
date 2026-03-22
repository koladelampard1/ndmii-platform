import { UserRole } from "@/types/roles";

export const roleRouteMap: Record<UserRole, string[]> = {
  public: ["/", "/verify", "/login", "/register"],
  msme: ["/dashboard"],
  association_officer: ["/dashboard"],
  reviewer: ["/dashboard"],
  fccpc_officer: ["/dashboard"],
  firs_officer: ["/dashboard"],
  admin: ["/dashboard"],
};

export function isRouteAllowed(role: UserRole, pathname: string) {
  if (pathname.startsWith("/verify")) return true;
  return roleRouteMap[role].some((route) => pathname.startsWith(route));
}
