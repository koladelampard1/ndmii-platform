import { NextResponse } from "next/server";
import { AdministrationError, administrationErrorResponse, requireInstitutionActor } from "@/lib/institutional/administration-server";
import { requireFinanceOfficer } from "@/lib/institutional/finance-readiness-server";
import { isUuid } from "@/lib/institutional/administration-policy";
import { validBankOutcome } from "@/lib/institutional/finance-readiness-policy";
export const dynamic="force-dynamic";
export async function POST(request:Request,context:{params:Promise<{institutionId:string;applicationId:string}>}){
 try{const {institutionId,applicationId}=await context.params;const actor=await requireInstitutionActor(institutionId);requireFinanceOfficer(actor);
  if(!isUuid(applicationId)) throw new AdministrationError(400,"Invalid application.");const body=await request.json().catch(()=>null);
  const reason=body?.reason?.trim();
  const amount=body?.outcome==="facility_approved"?Number(body?.approvedAmount):null;const currency=body?.outcome==="facility_approved"?String(body?.currency??"").toUpperCase():null;
  if(typeof body?.decisionDate!=="string"||typeof reason!=="string"||!validBankOutcome({outcome:body?.outcome,decisionDate:body.decisionDate,reason,approvedAmount:amount,currency}))
    throw new AdministrationError(400,"Enter a valid bank outcome, decision date and reason.");
  const {data,error}=await actor.db.rpc("record_institution_finance_outcome",{p_institution_id:institutionId,p_application_id:applicationId,
    p_actor_user_id:actor.userId,p_outcome:body.outcome,p_decision_date:body.decisionDate,p_reason:reason,p_approved_amount:amount,p_currency:currency});
  if(error?.code==="P0002") throw new AdministrationError(409,"An accepted application is required.");if(error?.code==="23505") throw new AdministrationError(409,"A bank outcome is already recorded.");if(error) throw error;
  return NextResponse.json({outcomeId:data},{status:201});
 }catch(error){return administrationErrorResponse(error);}
}
