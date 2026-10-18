import { NextResponse } from "next/server";
import { AdministrationError, administrationErrorResponse, requireInstitutionActor } from "@/lib/institutional/administration-server";
import { isUuid } from "@/lib/institutional/administration-policy";
import { completionRequiresNote, SUPPORT_ITEM_TYPES, type SupportItemType, validItemStatus, validItemStatusTransition } from "@/lib/institutional/continuing-support-policy";
import { cleanText, isoDate, isoDateTime, optionalText, requireOpenSupportPlan, supportPlan } from "@/lib/institutional/continuing-support-server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ institutionId: string; planId: string }> };
const tableFor: Record<SupportItemType, string> = {
  milestone: "institution_support_milestones", touchpoint: "institution_support_touchpoints",
  issue: "institution_support_issues", referral: "institution_market_referrals",
};

function itemType(value: unknown): SupportItemType {
  if (typeof value !== "string" || !SUPPORT_ITEM_TYPES.includes(value as SupportItemType)) throw new AdministrationError(400, "Choose a valid support record type.");
  return value as SupportItemType;
}

export async function POST(request: Request, context: Context) {
  try {
    const { institutionId, planId } = await context.params;
    const actor = await requireInstitutionActor(institutionId);
    const plan = await supportPlan(actor, planId); requireOpenSupportPlan(plan);
    const body = await request.json().catch(() => null); const type = itemType(body?.type);
    let payload: Record<string, unknown> = { institution_id: institutionId, plan_id: planId, created_by_user_id: actor.userId };
    if (type === "milestone") {
      if (!["business_growth", "facility_condition", "repayment", "compliance", "market", "development"].includes(body?.category) || !["business", "agent", "institution"].includes(body?.ownerType))
        throw new AdministrationError(400, "Choose a valid milestone category and owner.");
      payload = { ...payload, title: cleanText(body.title, 3, 300, "milestone"), category: body.category, owner_type: body.ownerType, due_date: isoDate(body.dueDate, "milestone date") };
    } else if (type === "touchpoint") {
      if (!["field_visit", "mentoring", "training", "review", "check_in"].includes(body?.kind)) throw new AdministrationError(400, "Choose a valid follow-up type.");
      payload = { ...payload, kind: body.kind, summary: cleanText(body.summary, 3, 1000, "follow-up summary"), scheduled_at: isoDateTime(body.scheduledAt, "follow-up date") };
    } else if (type === "issue") {
      if (!["operational", "financial", "repayment", "compliance", "market", "other"].includes(body?.category) || !["low", "medium", "high", "critical"].includes(body?.severity))
        throw new AdministrationError(400, "Choose a valid issue category and severity.");
      payload = { ...payload, category: body.category, severity: body.severity, summary: cleanText(body.summary, 3, 1000, "issue summary"), due_date: body.dueDate ? isoDate(body.dueDate, "issue date") : null };
    } else {
      if (!["buyer", "supplier"].includes(body?.kind)) throw new AdministrationError(400, "Choose buyer or supplier.");
      payload = { ...payload, kind: body.kind, partner_name: cleanText(body.partnerName, 2, 200, "partner name"),
        opportunity: cleanText(body.opportunity, 3, 1000, "opportunity"), contact_name: optionalText(body.contactName, 200, "contact name"),
        contact_channel: optionalText(body.contactChannel, 300, "contact channel"), follow_up_at: isoDateTime(body.followUpAt, "referral follow-up", true),
        updated_by_user_id: actor.userId };
    }
    const { data, error } = await actor.db.from(tableFor[type]).insert(payload).select("*").single();
    if (error) throw error;
    return NextResponse.json({ item: data }, { status: 201 });
  } catch (error) { return administrationErrorResponse(error); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { institutionId, planId } = await context.params;
    const actor = await requireInstitutionActor(institutionId);
    const plan = await supportPlan(actor, planId); requireOpenSupportPlan(plan);
    const body = await request.json().catch(() => null); const type = itemType(body?.type);
    if (!isUuid(body?.itemId ?? "") || !validItemStatus(type, body?.status)) throw new AdministrationError(400, "Choose a valid record and status.");
    const { data: current, error: currentError } = await actor.db.from(tableFor[type]).select("id,status").eq("institution_id", institutionId)
      .eq("plan_id", planId).eq("id", body.itemId).maybeSingle();
    if (currentError) throw currentError;
    if (!current) throw new AdministrationError(404, "Support record unavailable.");
    if (!validItemStatusTransition(type, current.status, body.status)) throw new AdministrationError(409, "That support status change is not allowed.");
    const note = typeof body?.note === "string" ? body.note.trim() : "";
    if (note.length > 2000 || !completionRequiresNote(type, body.status, note)) throw new AdministrationError(400, "A short outcome or resolution note is required.");
    const now = new Date().toISOString(); let updates: Record<string, unknown> = { status: body.status, updated_at: now };
    if (type === "milestone") updates = { ...updates, completion_note: note || null, completed_at: body.status === "completed" ? now : null };
    if (type === "touchpoint") updates = { ...updates, outcome_note: note || null, completed_at: body.status === "completed" ? now : null,
      completed_by_user_id: body.status === "completed" ? actor.userId : null, next_follow_up_at: isoDateTime(body?.nextFollowUpAt, "next follow-up", true) };
    if (type === "issue") updates = { ...updates, resolution_note: note || null, resolved_at: ["resolved", "closed"].includes(body.status) ? now : null,
      resolved_by_user_id: ["resolved", "closed"].includes(body.status) ? actor.userId : null };
    if (type === "referral") updates = { ...updates, outcome_note: note || null, updated_by_user_id: actor.userId,
      follow_up_at: isoDateTime(body?.followUpAt, "referral follow-up", true) };
    const { data, error } = await actor.db.from(tableFor[type]).update(updates).eq("institution_id", institutionId)
      .eq("plan_id", planId).eq("id", body.itemId).select("*").maybeSingle();
    if (error) throw error;
    if (!data) throw new AdministrationError(404, "Support record unavailable.");
    return NextResponse.json({ item: data });
  } catch (error) { return administrationErrorResponse(error); }
}
