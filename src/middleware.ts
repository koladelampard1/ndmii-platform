import { NextResponse, type NextRequest } from "next/server";
import { canAccessRoute, normalizeUserRole } from "@/lib/auth/authorization";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.startsWith("/logout") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const hasAuth = request.cookies.get("ndmii_auth")?.value === "1";
  const role = request.cookies.get("ndmii_role")?.value;
  const authEmail = request.cookies.get("ndmii_email")?.value ?? null;
  const normalizedRole = hasAuth && role ? normalizeUserRole(role, "public") : "public";
  const isAllowed = canAccessRoute(normalizedRole, pathname);

  console.log("[middleware] cookies:", {
    auth: request.cookies.get("ndmii_auth")?.value,
    role: request.cookies.get("ndmii_role")?.value,
    path: request.nextUrl.pathname,
  });

  if (hasAuth && !role) {
    console.warn("[middleware] authenticated request missing role cookie", {
      email: authEmail,
      path: pathname,
    });
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[route-rbac]", {
      email: authEmail,
      rawCookieRole: role ?? null,
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

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
