import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isRouteAllowed } from "@/lib/roles/permissions";
import type { UserRole } from "@/types/roles";

export function middleware(request: NextRequest) {
  const role = (request.cookies.get("ndmii_role")?.value ?? "public") as UserRole;
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.includes(".")) {
    return NextResponse.next();
  }

  if (!isRouteAllowed(role, pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
