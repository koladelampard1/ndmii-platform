import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { isValidEmailAddress, normalizeEmail } from "@/lib/auth/email-validation";

type ResetPasswordRequest = {
  email?: string;
  redirectTo?: string;
};

function isDevEnvironment() {
  return process.env.NODE_ENV !== "production";
}

function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!url || !anonKey) return false;
  if (url.includes("demo.supabase.co") || anonKey.includes("demo-anon-key")) return false;

  return true;
}

function normalizeRedirectUrl(rawRedirectTo: string | undefined, origin: string) {
  if (!rawRedirectTo) return `${origin}/update-password`;

  try {
    const parsed = new URL(rawRedirectTo);
    return parsed.toString();
  } catch {
    return `${origin}/update-password`;
  }
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as ResetPasswordRequest;
  const normalizedEmail = normalizeEmail(String(payload.email ?? ""));
  const requestUrl = new URL(request.url);
  const redirectTo = normalizeRedirectUrl(payload.redirectTo, requestUrl.origin);
  const isDev = isDevEnvironment();

  if (!isValidEmailAddress(normalizedEmail)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Email address '${normalizedEmail}' is invalid.`,
      },
      { status: 400 },
    );
  }

  if (!isSupabaseConfigured()) {
    const message = "Supabase is not configured for email delivery. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.";

    if (isDev) {
      console.error("[reset-password] misconfigured supabase", {
        email: normalizedEmail,
        hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        hasAnon: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: message,
        debug: isDev
          ? {
              email: normalizedEmail,
              supabaseConfigured: false,
              emailDeliveryLikelyConfigured: false,
              reason: "Missing or placeholder Supabase environment variables.",
            }
          : undefined,
      },
      { status: 503 },
    );
  }

  const debug: Record<string, unknown> = {
    email: normalizedEmail,
    redirectTo,
    supabaseConfigured: true,
  };

  if (isDev && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const service = await createServiceRoleSupabaseClient();
      const [{ data: authUsers, error: authLookupError }, { data: appUser, error: appUserLookupError }] = await Promise.all([
        service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        service.from("users").select("id,email").eq("email", normalizedEmail).maybeSingle(),
      ]);

      debug.authUserExists = Boolean(authUsers?.users?.some((user) => (user.email ?? "").toLowerCase() === normalizedEmail));
      debug.appUserExists = Boolean(appUser?.id);
      if (authLookupError) debug.authLookupError = authLookupError.message;
      if (appUserLookupError) debug.appUserLookupError = appUserLookupError.message;
    } catch (serviceError) {
      debug.lookupError = serviceError instanceof Error ? serviceError.message : "Unknown service-role lookup error.";
    }
  } else if (isDev) {
    debug.authUserExists = "unknown (SUPABASE_SERVICE_ROLE_KEY not configured)";
    debug.appUserExists = "unknown (SUPABASE_SERVICE_ROLE_KEY not configured)";
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });

  debug.supabaseAcceptedResetRequest = !error;
  debug.supabaseResponse = data ?? null;

  if (error) {
    debug.supabaseError = {
      message: error.message,
      status: error.status ?? null,
      code: error.code ?? null,
      name: error.name ?? null,
    };

    if (isDev) {
      console.error("[reset-password] supabase resetPasswordForEmail failed", debug);
    }

    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Unable to send password setup link. Please try again.",
        debug: isDev ? debug : undefined,
      },
      { status: 400 },
    );
  }

  if (isDev) {
    console.info("[reset-password] supabase resetPasswordForEmail success", debug);
  }

  return NextResponse.json({
    ok: true,
    message: "Password setup link sent. Check your inbox and follow the secure link to complete account setup.",
    debug: isDev ? debug : undefined,
  });
}
