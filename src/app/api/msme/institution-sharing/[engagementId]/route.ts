import { NextResponse } from "next/server";
import { administrationErrorResponse, AdministrationError, requireVerifiedActor } from "@/lib/institutional/administration-server";
import { isUuid } from "@/lib/institutional/administration-policy";

export const dynamic = "force-dynamic";
export async function PATCH(request: Request, context: { params: Promise<{ engagementId: string }> }) {
  try {
    const actor = await requireVerifiedActor();
    if (actor.role !== "msme") throw new AdministrationError(403, "A business account is required.");
    const { engagementId } = await context.params;
    const body = await request.json().catch(() => null);
    if (!isUuid(engagementId) || !["grant", "revoke"].includes(body?.action) || body?.confirmed !== true)
      throw new AdministrationError(400, "Confirm your decision to share or withdraw the business identity summary.");
    const { data, error } = await actor.db.rpc("decide_institution_passport_consent", {
      p_engagement_id: engagementId, p_owner_user_id: actor.userId, p_action: body.action,
    });
    if (error?.code === "P0002") throw new AdministrationError(404, "Request unavailable to this business account.");
    if (error?.code === "23505") throw new AdministrationError(409, "Consent state changed; refresh and try again.");
    if (error) throw error;
    return NextResponse.json({ status: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}
