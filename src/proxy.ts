import { NextResponse, type NextRequest } from "next/server";
import {
  SUPABASE_ACCESS_TOKEN_COOKIE,
  SUPABASE_REFRESH_TOKEN_COOKIE,
  createServerSupabaseClient,
  setSupabaseAuthCookies,
} from "@/lib/supabase/server";
import { resolveDbinHostSurface, resolveDbinRewritePath } from "@/lib/routing/dbin-hosts";

function createRoutingResponse(request: NextRequest) {
  const requestHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const surface = resolveDbinHostSurface(requestHost);
  const rewritePath = resolveDbinRewritePath(surface, request.nextUrl.pathname);
  const rewriteUrl = request.nextUrl.clone();
  if (rewritePath) rewriteUrl.pathname = rewritePath;

  const response = rewritePath ? NextResponse.rewrite(rewriteUrl) : NextResponse.next();

  response.headers.set("x-dbin-surface", surface);
  if (rewritePath) response.headers.set("x-dbin-rewrite", rewritePath);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = createRoutingResponse(request);
  response.headers.set("x-debug-path", pathname);

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
      }
    }
  } catch (error) {
    response.headers.set("x-debug-auth", "refresh-error");
    console.warn("[middleware-auth-refresh]", {
      path: pathname,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
