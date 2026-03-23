import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/types/roles";

type UserProfileRow = {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  auth_user_id: string | null;
};

const DEMO_ROLE_BY_EMAIL: Record<string, UserRole> = {
  "admin@ndmii.gov.ng": "admin",
  "reviewer@ndmii.gov.ng": "reviewer",
  "officer@fccpc.gov.ng": "fccpc_officer",
  "officer@nrs.gov.ng": "firs_officer",
  "assoc.lagos@ndmii.ng": "association_officer",
  "assoc.kano@ndmii.ng": "association_officer",
  "msme.demo@ndmii.ng": "msme",
};

export function inferRoleFromEmail(email: string): UserRole {
  const normalizedEmail = email.trim().toLowerCase();
  return DEMO_ROLE_BY_EMAIL[normalizedEmail] ?? "msme";
}

export function inferDisplayName(email: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  const username = normalizedEmail.split("@")[0] ?? "MSME User";
  return username
    .split(/[._-]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function resolveOrCreateUserProfile(
  supabase: SupabaseClient,
  params: { authUserId: string; email: string }
): Promise<UserProfileRow | null> {
  const email = params.email.trim().toLowerCase();
  const authUserId = params.authUserId;

  const { data: existingRows, error: fetchError } = await supabase
    .from("users")
    .select("id,email,role,full_name,auth_user_id")
    .or(`auth_user_id.eq.${authUserId},email.eq.${email}`)
    .limit(5);

  if (fetchError) {
    throw fetchError;
  }

  const preferredMatch = (existingRows ?? []).find((row) => row.auth_user_id === authUserId)
    ?? (existingRows ?? []).find((row) => row.email === email);

  if (preferredMatch) {
    if (preferredMatch.auth_user_id !== authUserId) {
      const { data: linkedRow, error: linkError } = await supabase
        .from("users")
        .update({ auth_user_id: authUserId })
        .eq("id", preferredMatch.id)
        .select("id,email,role,full_name,auth_user_id")
        .single();

      if (linkError) throw linkError;
      return linkedRow as UserProfileRow;
    }

    return preferredMatch as UserProfileRow;
  }

  const fallbackRole = inferRoleFromEmail(email);
  const fallbackName = inferDisplayName(email);

  const { data: createdRow, error: createError } = await supabase
    .from("users")
    .insert({
      email,
      full_name: fallbackName,
      role: fallbackRole,
      auth_user_id: authUserId,
    })
    .select("id,email,role,full_name,auth_user_id")
    .single();

  if (createError) throw createError;

  return createdRow as UserProfileRow;
}
