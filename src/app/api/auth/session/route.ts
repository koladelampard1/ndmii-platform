import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { normalizeUserRole } from "@/lib/auth/authorization";

export async function POST(request: Request) {
  const body = await request.json();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = normalizeUserRole(typeof body.role === "string" ? body.role : undefined, "public");
  const cookieStore = await cookies();

  cookieStore.set("ndmii_auth", "1", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });

  cookieStore.set("ndmii_role", role, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });

  cookieStore.set("ndmii_email", email, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });

  cookieStore.set("ndmii_auth_user_id", body.userId ?? "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });

  cookieStore.set("ndmii_app_user_id", body.appUserId ?? "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });

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

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  ["ndmii_auth", "ndmii_role", "ndmii_email", "ndmii_auth_user_id", "ndmii_app_user_id"].forEach((name) => {
    response.cookies.set(name, "", { expires: new Date(0), path: "/" });
  });
  return response;
}
