import { administrationErrorResponse, requireInstitutionActor } from "@/lib/institutional/administration-server";
import { caseItems, financeCase } from "@/lib/institutional/finance-readiness-server";
import { financePreparationPack } from "@/lib/institutional/finance-pack-pdf";
export const dynamic="force-dynamic";
export async function GET(_request:Request,context:{params:Promise<{institutionId:string;caseId:string}>}){
 try{const {institutionId,caseId}=await context.params;const actor=await requireInstitutionActor(institutionId);const record=await financeCase(actor,caseId);
  const items=await caseItems(actor,institutionId,caseId);const {data:engagement,error}=await actor.db.from("institution_engagements").select("msme_id").eq("institution_id",institutionId).eq("id",record.engagement_id).single();if(error)throw error;
  const {data:business,error:businessError}=await actor.db.from("msmes").select("business_name,msme_id").eq("id",engagement.msme_id).single();if(businessError)throw businessError;
  const {data:application,error:appError}=await actor.db.from("institution_finance_applications").select("application_reference,status").eq("institution_id",institutionId).eq("case_id",caseId).maybeSingle();if(appError)throw appError;
  const bytes=await financePreparationPack({institutionName:actor.institution.name,businessName:business.business_name,businessId:business.msme_id,status:record.status,
    gapSummary:record.gap_summary,readinessNote:record.readiness_note,items,applicationReference:application?.application_reference,applicationStatus:application?.status});
  return new Response(Buffer.from(bytes),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="DBIN-finance-preparation-${business.msme_id}.pdf"`,"Cache-Control":"private, no-store"}});
 }catch(error){return administrationErrorResponse(error);}
}
