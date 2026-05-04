import { NextResponse } from "next/server";
import { normalizeUserRole } from "@/lib/auth/authorization";

export async function POST(request: Request) {
  const body = await request.json();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = normalizeUserRole(typeof body.role === "string" ? body.role : undefined, "public");
  const response = NextResponse.json({ ok: true, role });
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set("ndmii_auth", "1", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  });

  response.cookies.set("ndmii_role", role, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  });

  response.cookies.set("ndmii_email", email, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  });

  response.cookies.set("ndmii_auth_user_id", typeof body.userId === "string" ? body.userId : "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  });

  response.cookies.set("ndmii_app_user_id", typeof body.appUserId === "string" ? body.appUserId : "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  });

  console.info("[auth-session:set-cookies]", { role });

  if (process.env.NODE_ENV !== "production") {
    console.info("[auth-session-write]", {
      email: email || null,
      rawRole: body.role ?? null,
      normalizedRole: role,
      authUserId: body.userId ?? null,
      appUserId: body.appUserId ?? null,
      reason: role === "public" ? "fallback_public_role_written" : "role_cookie_written",
    });
  }

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  ["ndmii_auth", "ndmii_role", "ndmii_email", "ndmii_auth_user_id", "ndmii_app_user_id"].forEach((name) => {
    response.cookies.set(name, "", { expires: new Date(0), path: "/" });
  });
  return response;
}
