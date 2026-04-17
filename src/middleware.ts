import { NextResponse, type NextRequest } from "next/server";
import { canAccessRoute, normalizeUserRole } from "@/lib/auth/authorization";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.startsWith("/logout") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const hasAuth = request.cookies.get("ndmii_auth")?.value === "1";
  const authEmail = request.cookies.get("ndmii_email")?.value ?? null;
  const rawCookieRole = request.cookies.get("ndmii_role")?.value;
  const normalizedRole = hasAuth ? normalizeUserRole(rawCookieRole, "public") : "public";
  const isAllowed = canAccessRoute(normalizedRole, pathname);

  if (process.env.NODE_ENV !== "production") {
    console.info("[route-rbac]", {
      email: authEmail,
      rawCookieRole: rawCookieRole ?? null,
      normalizedRole,
      path: pathname,
      canAccessRoute: isAllowed,
      reason: isAllowed
        ? "allowed_by_route_prefix"
        : hasAuth
          ? normalizedRole === "public"
            ? "deny_authenticated_user_with_unusable_role_cookie"
            : "deny_route_not_permitted_for_role"
          : "deny_missing_auth_cookie",
    });
  }

  if (!isAllowed) {
    const redirectPath = hasAuth && normalizedRole !== "public" ? `/access-denied?from=${encodeURIComponent(pathname)}` : "/login";
    return NextResponse.redirect(new URL(redirectPath, request.url));
  }

  const response = NextResponse.next();
  if (hasAuth && rawCookieRole !== normalizedRole) {
    response.cookies.set("ndmii_role", normalizedRole, { httpOnly: true, sameSite: "lax", path: "/" });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
