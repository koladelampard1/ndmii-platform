import { NextResponse } from "next/server";
import { isValidEmailAddress, normalizeEmail } from "@/lib/auth/email-validation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

type Payload = {
  email?: string;
  newPassword?: string;
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

  const supabase = await createServiceRoleSupabaseClient();
  const { data: usersResponse, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (listError) {
    return NextResponse.json({ ok: false, error: "Unable to query auth users.", details: listError.message }, { status: 500 });
  }

  const authUser = usersResponse.users.find((user) => (user.email ?? "").toLowerCase() === email);
  if (!authUser?.id) {
    return NextResponse.json({ ok: false, error: "Auth user not found for this email." }, { status: 404 });
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(authUser.id, {
    password: newPassword,
    email_confirm: true,
  });

  if (updateError) {
    return NextResponse.json({ ok: false, error: "Unable to update user password.", details: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    email,
    authUserId: authUser.id,
    updatedByRole: ctx.role,
    note: "Password updated for existing auth user in development mode.",
  });
}
