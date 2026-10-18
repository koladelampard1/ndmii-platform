import { NextResponse } from "next/server";
import { AdministrationError, administrationErrorResponse, requireVerifiedActor } from "@/lib/institutional/administration-server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const actor = await requireVerifiedActor(); if (actor.role !== "msme") throw new AdministrationError(403, "Business owner access required.");
    const { data: engagements, error } = await actor.db.from("institution_engagements").select("id,institution_id")
      .eq("owner_user_id", actor.userId).neq("relationship_status", "closed").eq("passport_access_status", "granted");
    if (error) throw error; const cases = [];
    for (const engagement of engagements ?? []) {
      const { data: consent } = await actor.db.from("institution_passport_consents").select("status")
        .eq("institution_id", engagement.institution_id).eq("engagement_id", engagement.id).maybeSingle();
      if (consent?.status !== "granted") continue;
      const { data: record, error: caseError } = await actor.db.from("institution_finance_cases").select("*")
        .eq("institution_id", engagement.institution_id).eq("engagement_id", engagement.id).maybeSingle();
      if (caseError) throw caseError; if (!record) continue;
      const { data: items, error: itemError } = await actor.db.from("institution_finance_requirement_items").select("*")
        .eq("institution_id", engagement.institution_id).eq("case_id", record.id).order("label");
      if (itemError) throw itemError;
      const { data: documents, error: documentError } = await actor.db.from("institution_finance_documents")
        .select("id,requirement_item_id,file_name,mime_type,byte_size,created_at").eq("institution_id", engagement.institution_id).eq("case_id", record.id);
      if (documentError) throw documentError;
      const { data: institution } = await actor.db.from("institutions").select("name").eq("id", engagement.institution_id).maybeSingle();
      cases.push({ ...record, institutionName: institution?.name ?? "Institution", items: items ?? [], documents: documents ?? [] });
    }
    return NextResponse.json({ cases }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}
