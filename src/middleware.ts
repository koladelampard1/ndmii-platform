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
  let isAllowed = canAccessRoute(normalizedRole, pathname);

  if (normalizedRole === "admin" && pathname.startsWith("/dashboard")) {
    isAllowed = true;
  }

  console.log("[middleware]", {
    pathname,
    role: normalizedRole,
    allowed: isAllowed,
  });

  if (hasAuth && !role) {
    console.warn("[middleware] authenticated request missing role cookie", {
      email: authEmail,
      path: pathname,
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
