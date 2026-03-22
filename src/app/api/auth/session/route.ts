import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const response = NextResponse.json({ ok: true });

  response.cookies.set("ndmii_auth", "1", { httpOnly: true, sameSite: "lax", path: "/" });
  response.cookies.set("ndmii_role", body.role ?? "public", { httpOnly: true, sameSite: "lax", path: "/" });
  response.cookies.set("ndmii_email", body.email ?? "", { httpOnly: true, sameSite: "lax", path: "/" });
  response.cookies.set("ndmii_auth_user_id", body.userId ?? "", { httpOnly: true, sameSite: "lax", path: "/" });
  response.cookies.set("ndmii_app_user_id", body.appUserId ?? "", { httpOnly: true, sameSite: "lax", path: "/" });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  ["ndmii_auth", "ndmii_role", "ndmii_email", "ndmii_auth_user_id", "ndmii_app_user_id"].forEach((name) => {
    response.cookies.set(name, "", { expires: new Date(0), path: "/" });
  });
  return response;
}
