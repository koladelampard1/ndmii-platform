import { createClient } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://demo.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "demo-anon-key";
const isProduction = process.env.NODE_ENV === "production";
const authCookieDomain = process.env.DBIN_AUTH_COOKIE_DOMAIN?.trim() || undefined;

function getSupabaseProjectRef() {
  try {
    const hostname = new URL(supabaseUrl).hostname;
    return hostname.split(".")[0] || "ndmii";
  } catch {
    return "ndmii";
  }
}

const supabaseProjectRef = getSupabaseProjectRef();

export const SUPABASE_ACCESS_TOKEN_COOKIE = `sb-${supabaseProjectRef}-access-token`;
export const SUPABASE_REFRESH_TOKEN_COOKIE = `sb-${supabaseProjectRef}-refresh-token`;

export type SupabaseAuthTokenPair = {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: number | null;
};

export const supabaseAuthCookieNames = [
  SUPABASE_ACCESS_TOKEN_COOKIE,
  SUPABASE_REFRESH_TOKEN_COOKIE,
] as const;

export const supabaseAuthCookieOptions = {
  httpOnly: true,
  path: "/",
  sameSite: "lax",
  secure: isProduction,
  ...(authCookieDomain ? { domain: authCookieDomain } : {}),
} as const;

export async function createServerSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

export async function createServiceRoleSupabaseClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || supabaseUrl.includes("demo.supabase.co")) {
    throw new Error("Server registration is unavailable because Supabase URL is not configured.");
  }

  if (!serviceRoleKey) {
    throw new Error("Server registration is unavailable because SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function setSupabaseAuthCookies(
  response: NextResponse,
  tokens: SupabaseAuthTokenPair,
) {
  const accessTokenMaxAge = tokens.expiresAt
    ? Math.max(tokens.expiresAt - Math.floor(Date.now() / 1000), 60)
    : 60 * 60;

  response.cookies.set(SUPABASE_ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...supabaseAuthCookieOptions,
    maxAge: accessTokenMaxAge,
  });

  if (tokens.refreshToken) {
    response.cookies.set(SUPABASE_REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      ...supabaseAuthCookieOptions,
      maxAge: 60 * 60 * 24 * 30,
    });
  }
}

export function clearSupabaseAuthCookies(response: NextResponse) {
  supabaseAuthCookieNames.forEach((name) => {
    const expiredOptions = {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: isProduction,
      expires: new Date(0),
      maxAge: 0,
    } as const;

    response.cookies.set(name, "", expiredOptions);
    if (authCookieDomain) {
      response.cookies.set(name, "", {
        ...expiredOptions,
        domain: authCookieDomain,
      });
    }
  });
}
