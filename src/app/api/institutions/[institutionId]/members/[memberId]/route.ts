import { NextResponse } from "next/server";
import { canManageMember, isUuid } from "@/lib/institutional/administration-policy";
import { AdministrationError, administrationErrorResponse, recordInstitutionAudit, requireInstitutionActor, requireManager } from "@/lib/institutional/administration-server";

type Context = { params: Promise<{ institutionId: string; memberId: string }> };
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: Context) {
  try {
    const { institutionId, memberId } = await context.params;
    if (!isUuid(memberId)) throw new AdministrationError(400, "Invalid membership.");
    const actor = await requireInstitutionActor(institutionId);
    requireManager(actor);
    const body = await request.json().catch(() => null);
    const action = body?.action as "revoke" | "suspend" | "reactivate";
    if (!["revoke", "suspend", "reactivate"].includes(action)) throw new AdministrationError(400, "Invalid action.");
    const { data: member, error: lookupError } = await actor.db.from("institution_members")
      .select("id,user_id,role,status").eq("id", memberId).eq("institution_id", institutionId).maybeSingle();
    if (lookupError) throw lookupError;
    if (!member) throw new AdministrationError(404, "Membership not found.");
    if (!canManageMember({ platformAdmin: actor.platformAdmin, actorRole: actor.membership?.role ?? null,
      targetRole: member.role, actorUserId: actor.userId, targetUserId: member.user_id, action })) {
      throw new AdministrationError(403, "This membership cannot be changed.");
    }
    if (action === "reactivate" && !["suspended", "revoked", "inactive"].includes(member.status)) {
      throw new AdministrationError(409, "Only a suspended or revoked member can be reactivated.");
    }
    if (action !== "reactivate" && !["active", "invited"].includes(member.status)) {
      throw new AdministrationError(409, "This membership is already inactive.");
    }
    const status = action === "reactivate" ? "invited" : action === "revoke" ? "revoked" : "suspended";
    const { data, error } = await actor.db.from("institution_members")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", memberId).eq("institution_id", institutionId).eq("status", member.status)
      .select("id,role,status").maybeSingle();
    if (error) throw error;
    if (!data) throw new AdministrationError(409, "Membership changed; reload and try again.");
    await recordInstitutionAudit(actor.db, { actorId: actor.userId, institutionId,
      eventType: `institution.member.${status}`, entityType: "institution_members", entityId: memberId,
      metadata: { role: member.role } });
    return NextResponse.json({ member: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}
