import { NextResponse, type NextRequest } from "next/server";
import {
  SUPABASE_ACCESS_TOKEN_COOKIE,
  SUPABASE_REFRESH_TOKEN_COOKIE,
  clearSupabaseAuthCookies,
  createServerSupabaseClient,
  setSupabaseAuthCookies,
} from "@/lib/supabase/server";
import { clearDbinAuthCookies } from "@/lib/auth/cookies";
import { resolveDbinCanonicalRedirectUrl, resolveDbinHostSurface, resolveDbinRewritePath } from "@/lib/routing/dbin-hosts";

function createRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `req_${Date.now().toString(36)}`;
}

function isProtectedWorkspacePath(pathname: string) {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/") || pathname === "/admin" || pathname.startsWith("/admin/");
}

function loginRedirectForAuthFailure(request: NextRequest, reason: string, requestId: string) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  loginUrl.searchParams.set("reason", reason);
  loginUrl.searchParams.set("requestId", requestId);
  const response = NextResponse.redirect(loginUrl);
  response.headers.set("x-dbin-request-id", requestId);
  response.headers.set("x-debug-auth", reason);
  clearSupabaseAuthCookies(response);
  clearDbinAuthCookies(response);
  return response;
}

function createRoutingResponse(request: NextRequest, requestId: string) {
  const requestHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const surface = resolveDbinHostSurface(requestHost);
  const redirectUrl = resolveDbinCanonicalRedirectUrl(surface, request.nextUrl);
  if (redirectUrl) {
    const redirectResponse = NextResponse.redirect(redirectUrl, 308);
    redirectResponse.headers.set("x-dbin-request-id", requestId);
    redirectResponse.headers.set("x-dbin-surface", surface);
    redirectResponse.headers.set("x-dbin-canonical-redirect", redirectUrl.pathname);
    return redirectResponse;
  }

  const rewritePath = resolveDbinRewritePath(surface, request.nextUrl.pathname);
  const rewriteUrl = request.nextUrl.clone();
  if (rewritePath) rewriteUrl.pathname = rewritePath;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-dbin-pathname", request.nextUrl.pathname);
  requestHeaders.set("x-dbin-request-id", requestId);

  const response = rewritePath
    ? NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } })
    : NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set("x-dbin-request-id", requestId);
  response.headers.set("x-dbin-surface", surface);
  if (rewritePath) response.headers.set("x-dbin-rewrite", rewritePath);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = request.headers.get("x-dbin-request-id") ?? createRequestId();
  const response = createRoutingResponse(request, requestId);
  response.headers.set("x-debug-path", pathname);

  if (response.headers.get("x-dbin-canonical-redirect")) {
    return response;
  }

  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.startsWith("/logout") || pathname.includes(".")) {
    return response;
  }

  const accessToken = request.cookies.get(SUPABASE_ACCESS_TOKEN_COOKIE)?.value ?? null;
  const refreshToken = request.cookies.get(SUPABASE_REFRESH_TOKEN_COOKIE)?.value ?? null;

  response.headers.set("x-debug-auth", accessToken ? "present" : "missing");

  if (!refreshToken) {
    return response;
  }

  try {
    const supabase = await createServerSupabaseClient();
    const shouldRefresh = !accessToken || Boolean((await supabase.auth.getUser(accessToken)).error);

    if (shouldRefresh) {
      const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
      if (!error && data.session) {
        setSupabaseAuthCookies(response, {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: data.session.expires_at ?? null,
        });
        response.headers.set("x-debug-auth", "refreshed");
      } else {
        response.headers.set("x-debug-auth", "refresh-failed");
        if (isProtectedWorkspacePath(pathname)) {
          console.info("[auth-refresh-denied]", {
            requestId,
            path: pathname,
            host: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
            reason: "SESSION_REFRESH_FAILED",
          });
          return loginRedirectForAuthFailure(request, "session_refresh_failed", requestId);
        }
      }
    }
  } catch (error) {
    response.headers.set("x-debug-auth", "refresh-error");
    console.warn("[middleware-auth-refresh]", {
      path: pathname,
      error: error instanceof Error ? error.message : String(error),
    });
    if (isProtectedWorkspacePath(pathname)) {
      return loginRedirectForAuthFailure(request, "session_refresh_failed", requestId);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
