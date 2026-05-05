import { NextResponse } from "next/server";

const isProduction = process.env.NODE_ENV === "production";

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login?message=Signed%20out%20successfully", request.url));

  ["ndmii_auth", "ndmii_role", "ndmii_email", "ndmii_auth_user_id", "ndmii_app_user_id"].forEach((name) => {
    response.cookies.set(name, "", {
      httpOnly: false,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: isProduction,
    });
  });

  return response;
}
