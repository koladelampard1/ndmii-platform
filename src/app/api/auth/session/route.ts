import { NextResponse } from "next/server";
import { normalizeUserRole } from "@/lib/auth/authorization";
import { getCredentialedCorsHeaders } from "@/lib/http/cors";

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
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = normalizeUserRole(typeof body.role === "string" ? body.role : undefined, "public");
  const headers = getCredentialedCorsHeaders(request, ["POST", "DELETE", "OPTIONS"]);
  headers.set("Cache-Control", "no-store, private");
  const response = NextResponse.json({ ok: true, role }, { headers });
  const cookieOptions = {
    ...baseCookieOptions,
    maxAge: 60 * 60 * 24 * 7,
  } as const;
  const authUserId = typeof body.userId === "string" ? body.userId : "";
  const appUserId = typeof body.appUserId === "string" ? body.appUserId : "";

  response.cookies.set("ndmii_auth", "1", cookieOptions);
  response.cookies.set("ndmii_role", role, cookieOptions);
  response.cookies.set("ndmii_email", email, cookieOptions);
  response.cookies.set("ndmii_auth_user_id", authUserId, cookieOptions);
  response.cookies.set("ndmii_app_user_id", appUserId, cookieOptions);

  console.info("[auth-session:set-cookies]", {
    isProduction,
    role,
    hasAuthUserId: Boolean(authUserId),
    cookieNamesSet: [...authCookieNames],
  });

  if (process.env.NODE_ENV !== "production") {
    console.info("[auth-session-write]", {
      email: email || null,
      rawRole: body.role ?? null,
      normalizedRole: role,
      authUserId: authUserId || null,
      appUserId: appUserId || null,
      reason: role === "public" ? "fallback_public_role_written" : "role_cookie_written",
    });
  }

  return response;
}

export async function DELETE(request: Request) {
  const response = NextResponse.json({ ok: true }, { headers: getCredentialedCorsHeaders(request, ["POST", "DELETE", "OPTIONS"]) });
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
