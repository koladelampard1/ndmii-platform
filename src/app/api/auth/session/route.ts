import { NextResponse } from "next/server";
import { normalizeUserRole } from "@/lib/auth/authorization";
import { getCredentialedCorsHeaders } from "@/lib/http/cors";
import {
  clearSupabaseAuthCookies,
  setSupabaseAuthCookies,
  supabaseAuthCookieNames,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const isProduction = process.env.NODE_ENV === "production";
const authCookieNames = ["ndmii_auth", "ndmii_role", "ndmii_email", "ndmii_auth_user_id", "ndmii_app_user_id"] as const;
const baseCookieOptions = {
  httpOnly: true,
  path: "/",
  sameSite: "lax",
  secure: isProduction,
} as const;

export async function POST(request: Request) {
  const body = await request.json();
  const role = normalizeUserRole(typeof body.role === "string" ? body.role : undefined, "public");
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const authUserId = typeof body.userId === "string" ? body.userId : "";
  const appUserId = typeof body.appUserId === "string" ? body.appUserId : "";
  const accessToken = typeof body.accessToken === "string" ? body.accessToken : "";
  const refreshToken = typeof body.refreshToken === "string" ? body.refreshToken : "";
  const expiresAt = typeof body.expiresAt === "number" ? body.expiresAt : null;
  const headers = getCredentialedCorsHeaders(request, ["POST", "DELETE", "OPTIONS"]);
  headers.set("Cache-Control", "no-store, private");
  if (!accessToken || !refreshToken) {
    return NextResponse.json({ success: false, ok: false, error: "Missing Supabase session tokens." }, { status: 400, headers });
  }

  const response = NextResponse.json({
    success: true,
    ok: true,
    role,
    cookieNamesSet: [...authCookieNames, ...supabaseAuthCookieNames],
  }, { headers });

  setSupabaseAuthCookies(response, {
    accessToken,
    refreshToken,
    expiresAt,
  });

  response.cookies.set("ndmii_auth", "1", baseCookieOptions);
  response.cookies.set("ndmii_role", role, baseCookieOptions);
  response.cookies.set("ndmii_email", email, baseCookieOptions);
  response.cookies.set("ndmii_auth_user_id", authUserId, baseCookieOptions);
  response.cookies.set("ndmii_app_user_id", appUserId, baseCookieOptions);

  const responseSetCookieHeaders = response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie")].filter((value): value is string => Boolean(value));

  console.info("[auth-session:set-cookies]", {
    isProduction,
    requestOrigin: request.headers.get("origin"),
    requestHost: request.headers.get("host"),
    cookieNamesSet: [...authCookieNames, ...supabaseAuthCookieNames],
    cookieCountBeingSet: authCookieNames.length + supabaseAuthCookieNames.length,
    responseSetCookieHeaders,
    responseHasSetCookieHeader: responseSetCookieHeaders.length > 0,
  });

  if (process.env.NODE_ENV !== "production") {
    console.info("[auth-session-write]", {
      rawRole: body.role ?? null,
      normalizedRole: role,
      reason: "single_response_multi_cookie_storage",
    });
  }

  return response;
}

export async function DELETE(request: Request) {
  const response = NextResponse.json({ ok: true }, { headers: getCredentialedCorsHeaders(request, ["POST", "DELETE", "OPTIONS"]) });
  clearSupabaseAuthCookies(response);
  authCookieNames.forEach((name) => {
    response.cookies.set(name, "", {
      ...baseCookieOptions,
      expires: new Date(0),
      maxAge: 0,
    });
  });
  return response;
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: getCredentialedCorsHeaders(request, ["POST", "DELETE", "OPTIONS"]),
  });
}
