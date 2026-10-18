import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SUPABASE_ACCESS_TOKEN_COOKIE, createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/institutional/administration-policy";

export class AdministrationError extends Error {
  constructor(readonly status: 400 | 401 | 403 | 404 | 409 | 503, message: string) {
    super(message);
  }
}

export function administrationErrorResponse(error: unknown) {
  if (error instanceof AdministrationError) {
    return NextResponse.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  }
  console.error("[institution-administration]", error instanceof Error ? error.message : "Unknown failure");
  return NextResponse.json({ error: "This action is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

/** No fallback identity cookies or unverified global role are accepted. */
export async function requireVerifiedActor() {
  const token = (await cookies()).get(SUPABASE_ACCESS_TOKEN_COOKIE)?.value;
  if (!token) throw new AdministrationError(401, "Sign in is required.");
  const authClient = await createServerSupabaseClient();
  const { data: auth, error } = await authClient.auth.getUser(token);
  if (error || !auth.user?.id) throw new AdministrationError(401, "Session could not be verified.");
  const db = await createServiceRoleSupabaseClient();
  const { data: user, error: userError } = await db.from("users")
    .select("id,role,email").eq("auth_user_id", auth.user.id).maybeSingle();
  if (userError) throw new AdministrationError(503, "Access could not be checked.");
  if (!user) throw new AdministrationError(403, "Access denied.");
  return { db, userId: String(user.id), role: String(user.role), email: String(user.email) };
}

export async function requireInstitutionActor(institutionId: string) {
  if (!isUuid(institutionId)) throw new AdministrationError(400, "Invalid institution.");
  const actor = await requireVerifiedActor();
  const { data: institution, error: institutionError } = await actor.db.from("institutions")
    .select("id,name,institution_type,status").eq("id", institutionId).maybeSingle();
  if (institutionError) throw new AdministrationError(503, "Institution could not be checked.");
  if (!institution || institution.status !== "active") throw new AdministrationError(404, "Institution unavailable.");

  const platformAdmin = ["admin", "super_admin"].includes(actor.role);
  const { data: memberships, error: memberError } = await actor.db.from("institution_members")
    .select("id,role,status,expires_at").eq("institution_id", institutionId)
    .eq("user_id", actor.userId).eq("status", "active");
  if (memberError) throw new AdministrationError(503, "Membership could not be checked.");
  const active = (memberships ?? [])
    .filter((membership) => !membership.expires_at || Date.parse(membership.expires_at) > Date.now())
    .sort((a, b) => Number(b.role === "institution_admin") - Number(a.role === "institution_admin"))[0];
  if (!platformAdmin && !active) throw new AdministrationError(403, "Access denied.");
  return { ...actor, institution, membership: active ?? null, platformAdmin };
}

export function requireManager(actor: Awaited<ReturnType<typeof requireInstitutionActor>>) {
  if (!actor.platformAdmin && actor.membership?.role !== "institution_admin") {
    throw new AdministrationError(403, "Institution administrator access is required.");
  }
}

export async function findVerifiedExistingUser(
  db: Awaited<ReturnType<typeof createServiceRoleSupabaseClient>>,
  emailInput: string,
) {
  const email = emailInput.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new AdministrationError(400, "Enter a valid account email.");
  }
  const { data: appUser, error } = await db.from("users")
    .select("id,auth_user_id,email,full_name,role").eq("email", email).maybeSingle();
  if (error) throw new AdministrationError(503, "Account could not be checked.");
  if (!appUser?.auth_user_id) throw new AdministrationError(404, "No verified DBIN account was found for that email.");
  const { data: auth, error: authError } = await db.auth.admin.getUserById(appUser.auth_user_id);
  if (authError || !auth.user || auth.user.email?.toLowerCase() !== email || !auth.user.email_confirmed_at) {
    throw new AdministrationError(404, "No verified DBIN account was found for that email.");
  }
  return appUser;
}

export async function recordInstitutionAudit(
  db: Awaited<ReturnType<typeof createServiceRoleSupabaseClient>>,
  input: { actorId: string; institutionId: string; eventType: string; entityType: string; entityId: string; metadata?: Record<string, unknown> },
) {
  const { error } = await db.from("platform_events").insert({
    actor_user_id: input.actorId, actor_institution_id: input.institutionId,
    event_type: input.eventType, entity_type: input.entityType, entity_id: input.entityId,
    scope_type: "institution", scope_id: input.institutionId,
    metadata: input.metadata ?? {},
  });
  if (error) console.error("[institution-audit]", error.message);
}
