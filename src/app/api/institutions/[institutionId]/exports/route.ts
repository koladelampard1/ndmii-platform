import { administrationErrorResponse, recordInstitutionAudit, requireInstitutionActor } from "@/lib/institutional/administration-server";
import { EXPORT_DATASETS, EXPORT_FORMATS, rowsToCsv, type ExportDataset, type ExportFormat } from "@/lib/institutional/institution-insights-policy";
import { loadInstitutionProfile, requireInsightsViewer } from "@/lib/institutional/institution-insights-server";
type Context={params:Promise<{institutionId:string}>};export const dynamic="force-dynamic";
export async function GET(request:Request,context:Context){
 try{const actor=await requireInstitutionActor((await context.params).institutionId);requireInsightsViewer(actor);const url=new URL(request.url);
  const dataset=url.searchParams.get("dataset") as ExportDataset;const format=(url.searchParams.get("format")??"csv") as ExportFormat;
  if(!EXPORT_DATASETS.includes(dataset)||!EXPORT_FORMATS.includes(format))return new Response(JSON.stringify({error:"Choose a valid export dataset and format."}),{status:400,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
  const profile=await loadInstitutionProfile(actor);if(!(profile.export_formats??["csv"]).includes(format))return new Response(JSON.stringify({error:"That export format is not enabled for this institution."}),{status:403,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
  const {data,error}=await actor.db.rpc("institution_export_dataset",{p_institution_id:actor.institution.id,p_dataset:dataset});if(error)throw error;
  const rows=(Array.isArray(data)?data:[]) as Record<string,unknown>[];
  const {data:audit,error:auditError}=await actor.db.from("institution_report_exports").insert({institution_id:actor.institution.id,dataset,export_format:format,row_count:rows.length,requested_by_user_id:actor.userId}).select("id").single();if(auditError)throw auditError;
  await recordInstitutionAudit(actor.db,{actorId:actor.userId,institutionId:actor.institution.id,eventType:"institution.report.exported",entityType:"institution_report_exports",entityId:audit.id,metadata:{dataset,format,rowCount:rows.length}});
  const stamp=new Date().toISOString().slice(0,10);const filename=`${profile.short_name.toLowerCase().replace(/[^a-z0-9]+/g,"-")}-${dataset}-${stamp}.${format}`;
  const content=format==="json"?JSON.stringify({institution:profile.short_name,dataset,generatedAt:new Date().toISOString(),rows},null,2):rowsToCsv(rows);
  return new Response(content,{headers:{"Content-Type":format==="json"?"application/json; charset=utf-8":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${filename}"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 }catch(error){return administrationErrorResponse(error);}
}
