import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath } from "@/lib/auth/authorization";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.startsWith("/logout") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const ndmiiAuthValue = request.cookies.get("ndmii_auth")?.value ?? null;
  const hasNdmiiAuth = ndmiiAuthValue === "1";
  const role = request.cookies.get("ndmii_role")?.value ?? null;
  const cookieNames = request.cookies.getAll().map((cookie) => cookie.name);

  console.info("[middleware-auth]", {
    path: pathname,
    hasNdmiiAuth,
    ndmiiAuthValue,
    role,
    cookieNames,
  });

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    if (!hasNdmiiAuth) {
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

  if (!isPublicPath(pathname) && !hasNdmiiAuth) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.headers.set("x-debug-auth", "missing");
    response.headers.set("x-debug-path", pathname);
    return response;
  }

  const response = NextResponse.next();
  response.headers.set("x-debug-auth", hasNdmiiAuth ? "present" : "missing");
  response.headers.set("x-debug-path", pathname);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
