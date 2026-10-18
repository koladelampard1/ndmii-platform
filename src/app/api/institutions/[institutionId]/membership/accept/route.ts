import { NextResponse } from "next/server";
import { AdministrationError, administrationErrorResponse, recordInstitutionAudit, requireVerifiedActor } from "@/lib/institutional/administration-server";
import { isUuid } from "@/lib/institutional/administration-policy";

type Context = { params: Promise<{ institutionId: string }> };
export async function POST(_request: Request, context: Context) {
  try {
    const { institutionId } = await context.params;
    if (!isUuid(institutionId)) throw new AdministrationError(400, "Invalid institution.");
    const actor = await requireVerifiedActor();
    const { data: institution } = await actor.db.from("institutions")
      .select("id").eq("id", institutionId).eq("status", "active").maybeSingle();
    if (!institution) throw new AdministrationError(404, "Institution unavailable.");
    const { data: invitations, error } = await actor.db.from("institution_members")
      .select("id,role").eq("institution_id", institutionId).eq("user_id", actor.userId).eq("status", "invited");
    if (error) throw error;
    if (!invitations?.length) throw new AdministrationError(404, "No pending invitation.");
    const accepted: string[] = [];
    for (const invitation of invitations) {
      const { data, error: updateError } = await actor.db.from("institution_members")
        .update({ status: "active", joined_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", invitation.id).eq("status", "invited")
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .select("id").maybeSingle();
      if (updateError) throw updateError;
      if (data) accepted.push(data.id);
    }
    if (!accepted.length) throw new AdministrationError(409, "Invitation expired or changed.");
    for (const id of accepted) await recordInstitutionAudit(actor.db, { actorId: actor.userId,
      institutionId, eventType: "institution.member.accepted", entityType: "institution_members", entityId: id });
    return NextResponse.json({ accepted }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}
