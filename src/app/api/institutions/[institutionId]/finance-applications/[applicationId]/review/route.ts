import { NextResponse } from "next/server";
import { AdministrationError, administrationErrorResponse, requireInstitutionActor } from "@/lib/institutional/administration-server";
import { requireFinanceOfficer } from "@/lib/institutional/finance-readiness-server";
import { isUuid } from "@/lib/institutional/administration-policy";
export const dynamic="force-dynamic";
export async function PATCH(request:Request,context:{params:Promise<{institutionId:string;applicationId:string}>}){
 try{const {institutionId,applicationId}=await context.params;const actor=await requireInstitutionActor(institutionId);requireFinanceOfficer(actor);
  if(!isUuid(applicationId)) throw new AdministrationError(400,"Invalid application.");const body=await request.json().catch(()=>null);
  const action=body?.action;const reason=typeof body?.reason==="string"?body.reason.trim():"";const nextAction=typeof body?.nextAction==="string"?body.nextAction.trim():"";
  if(!["accept","return"].includes(action)||(action==="return"&&(reason.length<10||reason.length>2000||nextAction.length<3||nextAction.length>1000)))
    throw new AdministrationError(400,"Choose accept, or give a return reason and next action.");
  const {error}=await actor.db.rpc("review_institution_finance_application",{p_institution_id:institutionId,p_application_id:applicationId,
    p_actor_user_id:actor.userId,p_action:action,p_reason:reason||null,p_next_action:nextAction||null});
  if(error?.code==="P0002") throw new AdministrationError(409,"Application changed; reload and try again.");if(error) throw error;
  return NextResponse.json({status:action==="accept"?"accepted":"returned"});
 }catch(error){return administrationErrorResponse(error);}
}
