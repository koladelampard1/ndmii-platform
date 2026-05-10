import { NextResponse } from "next/server";
import { normalizeUserRole } from "@/lib/auth/authorization";
import { getCredentialedCorsHeaders } from "@/lib/http/cors";
import {
  clearSupabaseAuthCookies,
  createServerSupabaseClient,
  createServiceRoleSupabaseClient,
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

async function resolveSessionMetadata(accessToken: string) {
  const authClient = await createServerSupabaseClient();
  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
  const authUser = authData.user;

  if (authError || !authUser?.id) {
    return {
      ok: false as const,
      status: 401,
      error: authError?.message || "Invalid Supabase access token.",
    };
  }

  const email = authUser.email?.trim().toLowerCase() ?? "";
  const service = await createServiceRoleSupabaseClient();
  const { data: profileByAuthId, error: profileByAuthIdError } = await service
    .from("users")
    .select("id,email,role,full_name,auth_user_id")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  if (profileByAuthIdError) {
    return {
      ok: false as const,
      status: 500,
      error: profileByAuthIdError.message,
    };
  }

  const { data: profileByEmail, error: profileByEmailError } = !profileByAuthId && email
    ? await service
        .from("users")
        .select("id,email,role,full_name,auth_user_id")
        .eq("email", email)
        .maybeSingle()
    : { data: null, error: null };

  if (profileByEmailError) {
    return {
      ok: false as const,
      status: 500,
      error: profileByEmailError.message,
    };
  }

  if (profileByEmail?.auth_user_id && profileByEmail.auth_user_id !== authUser.id) {
    return {
      ok: false as const,
      status: 409,
      error: "User profile email is already linked to a different authenticated account.",
    };
  }

  const { data: linkedProfileByEmail, error: linkProfileError } = !profileByAuthId && profileByEmail && !profileByEmail.auth_user_id
    ? await service
        .from("users")
        .update({ auth_user_id: authUser.id })
        .eq("id", profileByEmail.id)
        .is("auth_user_id", null)
        .select("id,email,role,full_name,auth_user_id")
        .maybeSingle()
    : { data: null, error: null };

  if (linkProfileError) {
    return {
      ok: false as const,
      status: linkProfileError.code === "23505" ? 409 : 500,
      error: linkProfileError.message,
    };
  }

  if (!profileByAuthId && profileByEmail && !profileByEmail.auth_user_id && !linkedProfileByEmail) {
    return {
      ok: false as const,
      status: 409,
      error: "User profile auth linkage changed while creating the session.",
    };
  }

  const profile = profileByAuthId ?? linkedProfileByEmail ?? null;
  const role = normalizeUserRole(typeof profile?.role === "string" ? profile.role : undefined, "public");

  return {
    ok: true as const,
    role,
    email: profile?.email?.trim().toLowerCase() || email,
    authUserId: authUser.id,
    appUserId: profile?.id ?? "",
    profileMatchedBy: profileByAuthId ? "auth_user_id" : linkedProfileByEmail ? "email_backfilled_auth_user_id" : "none",
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const accessToken = typeof body.accessToken === "string" ? body.accessToken : "";
  const refreshToken = typeof body.refreshToken === "string" ? body.refreshToken : "";
  const expiresAt = typeof body.expiresAt === "number" ? body.expiresAt : null;
  const headers = getCredentialedCorsHeaders(request, ["POST", "DELETE", "OPTIONS"]);
  headers.set("Cache-Control", "no-store, private");
  if (!accessToken || !refreshToken) {
    return NextResponse.json({ success: false, ok: false, error: "Missing Supabase session tokens." }, { status: 400, headers });
  }

  const metadata = await resolveSessionMetadata(accessToken);
  if (!metadata.ok) {
    return NextResponse.json({ success: false, ok: false, error: metadata.error }, { status: metadata.status, headers });
  }

  const response = NextResponse.json({
    success: true,
    ok: true,
    role: metadata.role,
    appUserId: metadata.appUserId || null,
    authUserId: metadata.authUserId,
    profileMatchedBy: metadata.profileMatchedBy,
    cookieNamesSet: [...authCookieNames, ...supabaseAuthCookieNames],
  }, { headers });

  setSupabaseAuthCookies(response, {
    accessToken,
    refreshToken,
    expiresAt,
  });

  response.cookies.set("ndmii_auth", "1", baseCookieOptions);
  response.cookies.set("ndmii_role", metadata.role, baseCookieOptions);
  response.cookies.set("ndmii_email", metadata.email, baseCookieOptions);
  response.cookies.set("ndmii_auth_user_id", metadata.authUserId, baseCookieOptions);
  response.cookies.set("ndmii_app_user_id", metadata.appUserId, baseCookieOptions);

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
      normalizedRole: metadata.role,
      profileMatchedBy: metadata.profileMatchedBy,
      reason: "server_verified_token_and_public_users_role",
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
