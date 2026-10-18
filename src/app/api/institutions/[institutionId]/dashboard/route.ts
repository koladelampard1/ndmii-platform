import { NextResponse } from "next/server";
import { administrationErrorResponse, requireInstitutionActor } from "@/lib/institutional/administration-server";
import { loadInstitutionProfile, requireInsightsViewer } from "@/lib/institutional/institution-insights-server";
type Context={params:Promise<{institutionId:string}>};export const dynamic="force-dynamic";
export async function GET(_request:Request,context:Context){
 try{const actor=await requireInstitutionActor((await context.params).institutionId);requireInsightsViewer(actor);
  const [snapshot,profile]=await Promise.all([actor.db.rpc("institution_dashboard_snapshot",{p_institution_id:actor.institution.id}),loadInstitutionProfile(actor)]);
  if(snapshot.error)throw snapshot.error;
  return NextResponse.json({institution:actor.institution,profile,snapshot:snapshot.data},{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){return administrationErrorResponse(error);}
}
