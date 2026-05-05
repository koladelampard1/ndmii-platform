import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath } from "@/lib/auth/authorization";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.startsWith("/logout") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const hasAuth = request.cookies.get("ndmii_auth")?.value === "1";

  if (!isPublicPath(pathname) && !hasAuth) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
