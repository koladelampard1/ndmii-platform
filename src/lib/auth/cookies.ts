import type { NextResponse } from "next/server";

const isProduction = process.env.NODE_ENV === "production";
const authCookieDomain = process.env.DBIN_AUTH_COOKIE_DOMAIN?.trim() || undefined;

export const dbinAuthCookieNames = [
  "ndmii_auth",
  "ndmii_role",
  "ndmii_email",
  "ndmii_auth_user_id",
  "ndmii_app_user_id",
] as const;

export const dbinAuthCookieOptions = {
  httpOnly: true,
  path: "/",
  sameSite: "lax",
  secure: isProduction,
  ...(authCookieDomain ? { domain: authCookieDomain } : {}),
} as const;

export function clearDbinAuthCookies(response: NextResponse) {
  dbinAuthCookieNames.forEach((name) => {
    const expiredOptions = {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: isProduction,
      expires: new Date(0),
      maxAge: 0,
    } as const;

    // Clear legacy host-only cookies as well as the shared .dbin.ng cookie.
    response.cookies.set(name, "", expiredOptions);
    if (authCookieDomain) {
      response.cookies.set(name, "", {
        ...expiredOptions,
        domain: authCookieDomain,
      });
    }
  });
}
