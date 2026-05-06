import { NextResponse } from "next/server";
import { normalizeUserRole } from "@/lib/auth/authorization";
import { getCredentialedCorsHeaders } from "@/lib/http/cors";

export const dynamic = "force-dynamic";

const isProduction = process.env.NODE_ENV === "production";
const authCookieNames = ["ndmii_auth"] as const;
const baseCookieOptions = {
  httpOnly: false,
  path: "/",
  sameSite: "lax",
  secure: true,
} as const;

export async function POST(request: Request) {
  const body = await request.json();
  const role = normalizeUserRole(typeof body.role === "string" ? body.role : undefined, "public");
  const headers = getCredentialedCorsHeaders(request, ["POST", "DELETE", "OPTIONS"]);
  headers.set("Cache-Control", "no-store, private");
  const response = NextResponse.json({ success: true, ok: true, role, cookieNamesSet: [...authCookieNames] }, { headers });

  response.cookies.set("ndmii_auth", "1", baseCookieOptions);

  const responseSetCookieHeaders = response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie")].filter((value): value is string => Boolean(value));

  console.info("[auth-session:set-cookies]", {
    isProduction,
    requestOrigin: request.headers.get("origin"),
    requestHost: request.headers.get("host"),
    cookieNamesSet: [...authCookieNames],
    cookieCountBeingSet: authCookieNames.length,
    responseSetCookieHeaders,
    responseHasSetCookieHeader: responseSetCookieHeaders.length > 0,
  });

  if (process.env.NODE_ENV !== "production") {
    console.info("[auth-session-write]", {
      rawRole: body.role ?? null,
      normalizedRole: role,
      reason: "minimal_cookie_storage_test",
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
