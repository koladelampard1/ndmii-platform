import { NextResponse } from "next/server";
import { AdministrationError, administrationErrorResponse, requireVerifiedActor } from "@/lib/institutional/administration-server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const actor = await requireVerifiedActor();
    if (actor.role !== "msme") throw new AdministrationError(403, "Business owner access required.");
    const { data: engagements, error } = await actor.db.from("institution_engagements")
      .select("id,institution_id,relationship_status,passport_access_status")
      .eq("owner_user_id", actor.userId).neq("relationship_status", "closed").eq("passport_access_status", "granted");
    if (error) throw error;
    const plans = [];
    for (const engagement of engagements ?? []) {
      const { data: consent, error: consentError } = await actor.db.from("institution_passport_consents")
        .select("status").eq("institution_id", engagement.institution_id).eq("engagement_id", engagement.id).maybeSingle();
      if (consentError) throw consentError;
      if (consent?.status !== "granted") continue;
      const { data: records, error: caseError } = await actor.db.from("institution_diagnostic_cases")
        .select("id,institution_id,engagement_id,questions,answers,findings,actions,status,review_reason,next_action,updated_at")
        .eq("institution_id", engagement.institution_id).eq("engagement_id", engagement.id);
      if (caseError) throw caseError;
      plans.push(...(records ?? []).filter(record => !["draft", "returned"].includes(record.status)));
    }
    return NextResponse.json({ plans }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}
