import { NextResponse, type NextRequest } from "next/server";
import { canAccessRoute, getDefaultDashboardRoute } from "@/lib/auth/authorization";
import type { UserRole } from "@/types/roles";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const hasAuth = request.cookies.get("ndmii_auth")?.value === "1";
  const role = hasAuth
    ? ((request.cookies.get("ndmii_role")?.value as UserRole | undefined) ?? "public")
    : "public";

  if (!canAccessRoute(role, pathname)) {
    const redirectPath = hasAuth && role !== "public" ? `/access-denied?from=${encodeURIComponent(pathname)}` : "/login";
    return NextResponse.redirect(new URL(redirectPath, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
