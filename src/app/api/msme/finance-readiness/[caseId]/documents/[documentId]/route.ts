import { AdministrationError, administrationErrorResponse } from "@/lib/institutional/administration-server";
import { ownerFinanceCase } from "@/lib/institutional/finance-readiness-server";
import { FINANCE_BUCKET } from "@/lib/institutional/finance-document";
import { isUuid } from "@/lib/institutional/administration-policy";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: {params:Promise<{caseId:string;documentId:string}>}) {
  try {
    const {caseId,documentId}=await context.params; const {actor,record}=await ownerFinanceCase(caseId);
    if(!isUuid(documentId)) throw new AdministrationError(400,"Invalid document.");
    const {data,error}=await actor.db.from("institution_finance_documents").select("storage_path,file_name,mime_type")
      .eq("institution_id",record.institution_id).eq("case_id",caseId).eq("id",documentId).maybeSingle();
    if(error) throw error; if(!data) throw new AdministrationError(404,"Document unavailable.");
    const result=await actor.db.storage.from(FINANCE_BUCKET).download(data.storage_path); if(result.error||!result.data) throw new AdministrationError(503,"Document temporarily unavailable.");
    return new Response(await result.data.arrayBuffer(),{headers:{"Content-Type":data.mime_type,"Content-Disposition":`attachment; filename*=UTF-8''${encodeURIComponent(data.file_name)}`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  } catch(error){return administrationErrorResponse(error);}
}
