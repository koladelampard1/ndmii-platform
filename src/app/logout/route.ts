import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login?message=Signed%20out%20successfully", request.url));

  ["ndmii_auth", "ndmii_role", "ndmii_email", "ndmii_auth_user_id", "ndmii_app_user_id"].forEach((name) => {
    response.cookies.set(name, "", { maxAge: 0, path: "/" });
  });

  return response;
}
