import { NextResponse } from "next/server";

const isProduction = process.env.NODE_ENV === "production";
const authCookieNames = ["ndmii_auth", "ndmii_role", "ndmii_email", "ndmii_auth_user_id", "ndmii_app_user_id"] as const;
const baseCookieOptions = {
  httpOnly: false,
  path: "/",
  sameSite: "lax",
  secure: isProduction,
} as const;

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login?message=Signed%20out%20successfully", request.url));

  authCookieNames.forEach((name) => {
    response.cookies.set(name, "", {
      ...baseCookieOptions,
      expires: new Date(0),
      maxAge: 0,
    });
  });

  return response;
}
