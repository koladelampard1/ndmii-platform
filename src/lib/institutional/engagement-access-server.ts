import { cookies } from "next/headers";
import { SUPABASE_ACCESS_TOKEN_COOKIE, createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { decideInstitutionAccess, type InstitutionMembership } from "@/lib/institutional/engagement-access-policy";

export const INSTITUTION_ENGAGEMENT_READ_ROLES = ["institution_admin", "institution_officer", "institution_reviewer"] as const;

export class InstitutionAccessError extends Error {
  constructor(readonly status: 401 | 403 | 503, message: string) {
    super(message);
    this.name = "InstitutionAccessError";
  }
}

/** Verify the Supabase session directly; do not accept fallback identity cookies. */
export async function requireInstitutionEngagementAccess(institutionId: string) {
  const accessToken = (await cookies()).get(SUPABASE_ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) throw new InstitutionAccessError(401, "Sign in is required.");

  const authClient = await createServerSupabaseClient();
  const { data: auth, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !auth.user?.id) throw new InstitutionAccessError(401, "Session could not be verified.");

  const db = await createServiceRoleSupabaseClient();
  const { data: appUser, error: userError } = await db.from("users").select("id").eq("auth_user_id", auth.user.id).maybeSingle();
  if (userError) throw new InstitutionAccessError(503, "Access could not be checked.");
  if (!appUser?.id) throw new InstitutionAccessError(403, "Access denied.");

  const [institutionResult, membershipResult] = await Promise.all([
    db.from("institutions").select("id,status").eq("id", institutionId).maybeSingle(),
    db.from("institution_members")
      .select("institution_id,user_id,role,status,expires_at")
      .eq("institution_id", institutionId)
      .eq("user_id", appUser.id)
      .eq("status", "active"),
  ]);
  if (institutionResult.error || membershipResult.error) throw new InstitutionAccessError(503, "Access could not be checked.");
  if (institutionResult.data?.status !== "active") throw new InstitutionAccessError(403, "Access denied.");

  const decisions = (membershipResult.data ?? []).map((membership) => decideInstitutionAccess({
    institutionId,
    userId: appUser.id,
    membership: membership as InstitutionMembership,
    allowedRoles: INSTITUTION_ENGAGEMENT_READ_ROLES,
  }));
  if (!decisions.some((decision) => decision.allowed)) throw new InstitutionAccessError(403, "Access denied.");

  return { db, userId: String(appUser.id), institutionId };
}
