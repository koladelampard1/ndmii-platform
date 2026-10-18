import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { AdministrationError, administrationErrorResponse, requireInstitutionActor } from "@/lib/institutional/administration-server";
import { caseItems, financeCase, isFinanceOfficer, preparationComplete } from "@/lib/institutional/finance-readiness-server";
import { handoverDecision } from "@/lib/institutional/finance-readiness-policy";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context:{params:Promise<{institutionId:string;caseId:string}>}) {
  try {
    const {institutionId,caseId}=await context.params; const actor=await requireInstitutionActor(institutionId);
    const officer=isFinanceOfficer(actor); await financeCase(actor,caseId,!officer); const body=await request.json().catch(()=>null);
    const items=await caseItems(actor,institutionId,caseId); const complete=preparationComplete(items); const override=body?.override===true;
    const reason=typeof body?.reason==="string"?body.reason.trim():"";
    const decision=handoverDecision({complete,officer,override,reason});
    if(!decision.allowed) throw new AdministrationError(decision.reason==="override_reason"?400:409,decision.reason==="override_reason"?"Give a specific reason for the incomplete handover.":"Required items must be verified, or an institution officer must authorise an override.");
    const reference=`FIN-${new Date().getUTCFullYear()}-${randomUUID().replaceAll("-","").slice(0,10).toUpperCase()}`;
    const {data,error}=await actor.db.rpc("submit_institution_finance_application",{p_institution_id:institutionId,p_case_id:caseId,
      p_reference:reference,p_actor_user_id:actor.userId,p_override:decision.override,p_override_reason:reason||null});
    if(error?.code==="P0001") throw new AdministrationError(409,"Required items are incomplete."); if(error?.code==="P0002") throw new AdministrationError(409,"Case changed; reload and try again.");
    if(error?.code==="23505") throw new AdministrationError(409,"An active application already exists."); if(error) throw error;
    return NextResponse.json({applicationId:data,applicationReference:reference},{status:201});
  } catch(error){return administrationErrorResponse(error);}
}
