import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath } from "@/lib/auth/authorization";

function isAuthPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/auth/") ||
    pathname === "/reset-password" ||
    pathname === "/update-password" ||
    pathname.startsWith("/activate-account/")
  );
}

function isProtectedPath(pathname: string) {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/") || pathname === "/admin" || pathname.startsWith("/admin/");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.startsWith("/logout") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const hasAuth = request.cookies.get("ndmii_auth")?.value === "1";
  const roleCookie = request.cookies.get("ndmii_role")?.value ?? null;
  const cookieNames = request.cookies.getAll().map((cookie) => cookie.name);

  console.info("[middleware-auth]", {
    path: pathname,
    hasAuth,
    roleCookie,
    cookieNames,
  });

  if (isPublicPath(pathname) || isAuthPath(pathname)) {
    const response = NextResponse.next();
    response.headers.set("x-debug-auth", hasAuth ? "present" : "missing");
    response.headers.set("x-debug-path", pathname);
    return response;
  }

  if (isProtectedPath(pathname)) {
    if (!hasAuth) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.headers.set("x-debug-auth", "missing");
      response.headers.set("x-debug-path", pathname);
      return response;
    }

    const response = NextResponse.next();
    response.headers.set("x-debug-auth", "present");
    response.headers.set("x-debug-path", pathname);
    return response;
  }

  const response = NextResponse.next();
  response.headers.set("x-debug-auth", hasAuth ? "present" : "missing");
  response.headers.set("x-debug-path", pathname);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
