import { NextRequest, NextResponse } from "next/server";
import { clearDbinAuthCookies } from "@/lib/auth/cookies";
import { resolveDbinHostSurface } from "@/lib/routing/dbin-hosts";
import {
  SUPABASE_ACCESS_TOKEN_COOKIE,
  SUPABASE_REFRESH_TOKEN_COOKIE,
  clearSupabaseAuthCookies,
  createServerSupabaseClient,
} from "@/lib/supabase/server";

function getSafeReturnPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value === "/logout" || value.startsWith("/logout?")) return null;
  return value;
}

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get(SUPABASE_ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(SUPABASE_REFRESH_TOKEN_COOKIE)?.value;

  if (accessToken && refreshToken) {
    try {
      const supabase = await createServerSupabaseClient();
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (!sessionError) {
        await supabase.auth.signOut({ scope: "local" });
      }
    } catch (error) {
      console.warn("[auth-logout] Supabase sign-out failed; local cookies will still be cleared.", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const requestHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const surface = resolveDbinHostSurface(requestHost);
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = surface === "nrs" ? "/" : "/login";
  loginUrl.search = "";
  if (surface !== "nrs") {
    loginUrl.searchParams.set(
      "message",
      request.nextUrl.searchParams.get("switch") === "1"
        ? "Signed out. Choose another account."
        : "Signed out successfully.",
    );
    loginUrl.searchParams.set("signedOut", "1");
    if (surface === "lcdbo") loginUrl.searchParams.set("workspace", "lcdbo");
  }
  const returnTo = getSafeReturnPath(request.nextUrl.searchParams.get("returnTo"));
  if (returnTo && surface !== "nrs") loginUrl.searchParams.set("returnTo", returnTo);

  const response = NextResponse.redirect(loginUrl);
  clearSupabaseAuthCookies(response);
  clearDbinAuthCookies(response);
  return response;
}
