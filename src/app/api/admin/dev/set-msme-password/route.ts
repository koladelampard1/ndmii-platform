import { NextResponse } from "next/server";
import { isValidEmailAddress, normalizeEmail } from "@/lib/auth/email-validation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

type Payload = {
  email?: string;
  newPassword?: string;
};

type AdminSetPasswordDebug = {
  email: string;
  hasSupabaseUrl: boolean;
  hasServiceRoleKey: boolean;
  lookupMethod?: "app-users.auth_user_id" | "auth.admin.listUsers";
  failingMethod?: string;
  supabaseError?: unknown;
};

function isDevMode() {
  return process.env.NODE_ENV !== "production";
}

export async function POST(request: Request) {
  if (!isDevMode()) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const ctx = await getCurrentUserContext();
  if (ctx.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const email = normalizeEmail(String(payload.email ?? ""));
  const newPassword = String(payload.newPassword ?? "").trim();

  if (!isValidEmailAddress(email)) {
    return NextResponse.json({ ok: false, error: `Email address '${email}' is invalid.` }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ ok: false, error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const debug: AdminSetPasswordDebug = {
    email,
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  if (isDevMode()) {
    console.info("[admin/dev/set-msme-password] env check", debug);
  }

  let supabase: Awaited<ReturnType<typeof createServiceRoleSupabaseClient>>;
  try {
    supabase = await createServiceRoleSupabaseClient();
  } catch (error) {
    if (isDevMode()) {
      console.error("[admin/dev/set-msme-password] failed to create service-role client", error);
    }
    return NextResponse.json(
      { ok: false, error: "Unable to initialize Supabase admin client.", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }

  let authUserId: string | null = null;

  const { data: appUser, error: appUserLookupError } = await supabase
    .from("users")
    .select("auth_user_id")
    .eq("email", email)
    .maybeSingle();

  if (appUserLookupError && isDevMode()) {
    console.error("[admin/dev/set-msme-password] app user lookup failed", appUserLookupError);
  }

  if (appUser?.auth_user_id) {
    debug.lookupMethod = "app-users.auth_user_id";
    authUserId = appUser.auth_user_id;
  } else {
    debug.lookupMethod = "auth.admin.listUsers";
    const { data: usersResponse, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (listError) {
      debug.failingMethod = "auth.admin.listUsers";
      debug.supabaseError = listError;
      if (isDevMode()) {
        console.error("[admin/dev/set-msme-password] listUsers failed", listError);
      }
      return NextResponse.json(
        { ok: false, error: "Unable to query auth users.", details: listError.message, debug: isDevMode() ? debug : undefined },
        { status: 500 },
      );
    }

    authUserId = usersResponse.users.find((user) => (user.email ?? "").toLowerCase() === email)?.id ?? null;
  }

  if (!authUserId) {
    return NextResponse.json({ ok: false, error: "Auth user not found for this email." }, { status: 404 });
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(authUserId, {
    password: newPassword,
    email_confirm: true,
  });

  if (updateError) {
    debug.failingMethod = "auth.admin.updateUserById";
    debug.supabaseError = updateError;
    if (isDevMode()) {
      console.error("[admin/dev/set-msme-password] updateUserById failed", updateError);
    }
    return NextResponse.json(
      { ok: false, error: "Unable to update user password.", details: updateError.message, debug: isDevMode() ? debug : undefined },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    email,
    authUserId,
    updatedByRole: ctx.role,
    note: "Password updated for existing auth user in development mode.",
    debug: isDevMode() ? debug : undefined,
  });
}
