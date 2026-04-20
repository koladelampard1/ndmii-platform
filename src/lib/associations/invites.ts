import crypto from "node:crypto";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const DEFAULT_INVITE_EXPIRY_HOURS = Number(process.env.NDMII_ASSOCIATION_INVITE_EXPIRY_HOURS ?? "72");

export function generateInviteToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function computeInviteExpiry(sentAt = new Date()) {
  return new Date(sentAt.getTime() + DEFAULT_INVITE_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();
}

export async function sendActivationInvite({
  email,
  token,
}: {
  email: string;
  token: string;
}) {
  const activationPath = `/activate-account/${token}`;
  const activationUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}${activationPath}`;

  if (process.env.NODE_ENV !== "production") {
    console.info("[association-activation-invite]", {
      email,
      subject: "You're invited to activate your NDMII business account",
      activationUrl,
    });
  }

  return { ok: true, activationPath, activationUrl };
}

export async function activateInviteToken({
  token,
  password,
}: {
  token: string;
  password: string;
}) {
  const supabase = await createServiceRoleSupabaseClient();
  const nowIso = new Date().toISOString();

  const { data: member } = await supabase
    .from("association_members")
    .select("id,msme_id,invite_status,invite_expires_at,activated_at,msmes(created_by)")
    .eq("invite_token", token)
    .maybeSingle();

  if (!member?.id) {
    return { ok: false, error: "This activation link is invalid." };
  }

  if (member.activated_at) {
    return { ok: false, error: "This activation link has already been used." };
  }

  if (member.invite_expires_at && member.invite_expires_at < nowIso) {
    return { ok: false, error: "This activation link has expired." };
  }

  const createdBy = (member.msmes as { created_by?: string | null } | null)?.created_by;
  if (!createdBy) {
    return { ok: false, error: "Unable to locate the invited MSME account." };
  }

  const { data: user } = await supabase
    .from("users")
    .select("id,auth_user_id")
    .eq("id", createdBy)
    .maybeSingle();

  if (!user?.auth_user_id) {
    return { ok: false, error: "Unable to locate the invited user profile." };
  }

  const { error: passwordError } = await supabase.auth.admin.updateUserById(user.auth_user_id, {
    password,
    email_confirm: true,
  });

  if (passwordError) {
    return { ok: false, error: "Unable to set password for this invite." };
  }

  await supabase
    .from("association_members")
    .update({
      invite_status: "ACTIVATED",
      activated_at: nowIso,
      invite_token: null,
    })
    .eq("id", member.id);

  return { ok: true };
}
