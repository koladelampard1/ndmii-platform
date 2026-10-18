import { NextResponse } from "next/server";
import { canManageMember, INSTITUTION_MEMBER_ROLES, type InstitutionMemberRole } from "@/lib/institutional/administration-policy";
import { AdministrationError, administrationErrorResponse, findVerifiedExistingUser, recordInstitutionAudit, requireInstitutionActor, requireManager } from "@/lib/institutional/administration-server";

type Context = { params: Promise<{ institutionId: string }> };
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireInstitutionActor((await context.params).institutionId);
    requireManager(actor);
    const { data: members, error } = await actor.db.from("institution_members")
      .select("id,user_id,role,title,status,expires_at,created_at,users!institution_members_user_id_fkey(email,full_name)")
      .eq("institution_id", actor.institution.id).order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    return NextResponse.json({ members: members ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireInstitutionActor((await context.params).institutionId);
    requireManager(actor);
    const body = await request.json().catch(() => null);
    const role = body?.role as InstitutionMemberRole;
    if (!INSTITUTION_MEMBER_ROLES.includes(role) || role === "institution_agent") {
      throw new AdministrationError(400, "Choose a bank staff role. Add agents through the agent roster.");
    }
    const user = await findVerifiedExistingUser(actor.db, String(body?.email ?? ""));
    if (!canManageMember({ platformAdmin: actor.platformAdmin, actorRole: actor.membership?.role ?? null,
      targetRole: role, actorUserId: actor.userId, targetUserId: user.id, action: "invite" })) {
      throw new AdministrationError(403, "This role cannot be assigned.");
    }
    const title = typeof body?.title === "string" ? body.title.trim().slice(0, 100) : null;
    const { data: existing, error: lookupError } = await actor.db.from("institution_members")
      .select("id,status").eq("institution_id", actor.institution.id).eq("user_id", user.id)
      .eq("role", role).in("status", ["active", "invited"]).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) throw new AdministrationError(409, "This person already has that role at this institution.");
    const { data, error } = await actor.db.from("institution_members")
      .insert({ institution_id: actor.institution.id, user_id: user.id, role, title,
        status: "invited", invited_by: actor.userId })
      .select("id,user_id,role,status").single();
    if (error?.code === "23505") throw new AdministrationError(409, "This membership already exists.");
    if (error || !data) throw error ?? new Error("Membership could not be created.");
    await recordInstitutionAudit(actor.db, { actorId: actor.userId, institutionId: actor.institution.id,
      eventType: "institution.member.invited", entityType: "institution_members", entityId: data.id,
      metadata: { role } });
    return NextResponse.json({ member: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}
