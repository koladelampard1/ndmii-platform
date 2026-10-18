import { NextResponse } from "next/server";
import { AdministrationError, administrationErrorResponse, requireInstitutionActor } from "@/lib/institutional/administration-server";
import { caseItems, financeCase, isFinanceOfficer, preparationComplete } from "@/lib/institutional/finance-readiness-server";
import { isUuid } from "@/lib/institutional/administration-policy";
export const dynamic = "force-dynamic";
export async function PATCH(request: Request, context: { params: Promise<{ institutionId:string;caseId:string;itemId:string }> }) {
  try {
    const { institutionId,caseId,itemId } = await context.params; const actor = await requireInstitutionActor(institutionId);
    const officer = isFinanceOfficer(actor); const record = await financeCase(actor, caseId, !officer);
    if (!isUuid(itemId) || ["handed_over","accepted","closed"].includes(record.status)) throw new AdministrationError(409, "Requirement cannot be changed.");
    const { data: item, error } = await actor.db.from("institution_finance_requirement_items").select("*")
      .eq("institution_id", institutionId).eq("case_id", caseId).eq("id", itemId).maybeSingle();
    if (error) throw error; if (!item) throw new AdministrationError(404, "Requirement unavailable.");
    const body = await request.json().catch(() => null); const action = body?.action; const now = new Date().toISOString();
    let values: Record<string,unknown> = { updated_at: now };
    if (action === "request") {
      const message = body?.message?.trim(); if (typeof message !== "string" || message.length < 3 || message.length > 1000)
        throw new AdministrationError(400, "Explain the document required.");
      values = { ...values, status: "requested", request_message: message, requested_at: now };
    } else if (action === "verify") {
      if (item.status !== "provided") throw new AdministrationError(409, "A provided document is required before verification.");
      values = { ...values, status: "verified", verified_at: now, verified_by_user_id: actor.userId };
    } else if (action === "reject") {
      const note = body?.note?.trim(); if (typeof note !== "string" || note.length < 5 || note.length > 1000) throw new AdministrationError(400, "Explain what must be corrected.");
      values = { ...values, status: "requested", gap_note: note, request_message: note, requested_at: now, verified_at: null, verified_by_user_id: null };
    } else if (action === "waive") {
      if (!officer) throw new AdministrationError(403, "Only an institution officer can waive a requirement.");
      const note = body?.note?.trim(); if (typeof note !== "string" || note.length < 10 || note.length > 1000) throw new AdministrationError(400, "Give the reason for the waiver.");
      values = { ...values, status: "waived", gap_note: note, verified_at: now, verified_by_user_id: actor.userId };
    } else throw new AdministrationError(400, "Invalid requirement action.");
    const { data, error: updateError } = await actor.db.from("institution_finance_requirement_items").update(values)
      .eq("id", itemId).eq("institution_id", institutionId).eq("case_id", caseId).eq("status", item.status).select("*").maybeSingle();
    if (updateError) throw updateError; if (!data) throw new AdministrationError(409, "Requirement changed; reload and try again.");
    const items = await caseItems(actor, institutionId, caseId);
    await actor.db.from("institution_finance_cases").update({ status: preparationComplete(items) ? "ready" : "collecting", updated_at: now })
      .eq("id", caseId).eq("institution_id", institutionId).in("status", ["collecting", "ready", "returned"]);
    return NextResponse.json({ item: data });
  } catch (error) { return administrationErrorResponse(error); }
}
