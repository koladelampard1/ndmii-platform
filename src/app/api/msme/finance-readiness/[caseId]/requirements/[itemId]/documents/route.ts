import { NextResponse } from "next/server";
import { AdministrationError, administrationErrorResponse } from "@/lib/institutional/administration-server";
import { ownerFinanceCase } from "@/lib/institutional/finance-readiness-server";
import { checkedFinanceFile, FINANCE_BUCKET } from "@/lib/institutional/finance-document";
import { isUuid } from "@/lib/institutional/administration-policy";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{caseId:string;itemId:string}> }) {
  try {
    const { caseId,itemId } = await context.params; const { actor,record } = await ownerFinanceCase(caseId);
    if (!isUuid(itemId) || ["handed_over","accepted","closed"].includes(record.status)) throw new AdministrationError(409, "Documents cannot be added at this stage.");
    const { data: item, error } = await actor.db.from("institution_finance_requirement_items").select("id,status")
      .eq("institution_id", record.institution_id).eq("case_id", caseId).eq("id", itemId).maybeSingle();
    if (error) throw error; if (!item) throw new AdministrationError(404, "Requirement unavailable.");
    const { file,bytes } = await checkedFinanceFile(await request.formData()); const path = `${record.institution_id}/${caseId}/${crypto.randomUUID()}`;
    const { error: uploadError } = await actor.db.storage.from(FINANCE_BUCKET).upload(path,bytes,{contentType:file.type,upsert:false}); if (uploadError) throw uploadError;
    const { data, error: insertError } = await actor.db.from("institution_finance_documents").insert({ institution_id: record.institution_id,
      case_id: caseId, requirement_item_id: itemId, storage_path:path, file_name:file.name.slice(0,255),mime_type:file.type,
      byte_size:file.size,uploaded_by_user_id:actor.userId }).select("id,requirement_item_id,file_name,mime_type,byte_size,created_at").single();
    if (insertError) { await actor.db.storage.from(FINANCE_BUCKET).remove([path]); throw insertError; }
    const { error: itemError } = await actor.db.from("institution_finance_requirement_items").update({ status:"provided",provided_at:new Date().toISOString(),
      verified_at:null,verified_by_user_id:null,updated_at:new Date().toISOString() }).eq("id",itemId).eq("institution_id",record.institution_id).eq("case_id",caseId);
    if (itemError) throw itemError;
    return NextResponse.json({ document:data },{status:201});
  } catch (error) { return administrationErrorResponse(error); }
}
