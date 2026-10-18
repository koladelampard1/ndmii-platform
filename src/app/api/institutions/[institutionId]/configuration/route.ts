import { NextResponse } from "next/server";
import { AdministrationError, administrationErrorResponse, recordInstitutionAudit, requireInstitutionActor, requireManager } from "@/lib/institutional/administration-server";
import { OPERATING_PRESETS, validInstitutionProfile, validSupportTemplate, type OperatingModel } from "@/lib/institutional/institution-insights-policy";
import { loadInstitutionProfile, profileRow } from "@/lib/institutional/institution-insights-server";

type Context={params:Promise<{institutionId:string}>}; export const dynamic="force-dynamic";

export async function GET(_request:Request,context:Context){
 try{const actor=await requireInstitutionActor((await context.params).institutionId);requireManager(actor);
  const [profile,templates,diagnostic,finance]=await Promise.all([
   loadInstitutionProfile(actor),
   actor.db.from("institution_support_templates").select("*").eq("institution_id",actor.institution.id).order("pathway"),
   actor.db.from("institution_diagnostic_templates").select("id,name,version,active,created_at").eq("institution_id",actor.institution.id).order("created_at",{ascending:false}),
   actor.db.from("institution_finance_templates").select("id,name,version,active,created_at").eq("institution_id",actor.institution.id).order("created_at",{ascending:false}),
  ]);
  if(templates.error)throw templates.error;if(diagnostic.error)throw diagnostic.error;if(finance.error)throw finance.error;
  return NextResponse.json({profile,supportTemplates:templates.data??[],diagnosticTemplates:diagnostic.data??[],financeTemplates:finance.data??[],presets:OPERATING_PRESETS},{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){return administrationErrorResponse(error);}
}

export async function PATCH(request:Request,context:Context){
 try{const actor=await requireInstitutionActor((await context.params).institutionId);requireManager(actor);const body=await request.json().catch(()=>null);
  if(body?.action==="apply_preset"){
   const model=body?.operatingModel as OperatingModel;const preset=OPERATING_PRESETS[model];if(!preset)throw new AdministrationError(400,"Choose a valid operating model.");
   const input={...preset,shortName:actor.institution.name.length<=40?actor.institution.name:preset.shortName};
   const {data,error}=await actor.db.from("institution_operating_profiles").upsert(profileRow(actor.institution.id,input,actor.userId)).select("*").single();if(error)throw error;
   await recordInstitutionAudit(actor.db,{actorId:actor.userId,institutionId:actor.institution.id,eventType:"institution.configuration.preset_applied",entityType:"institution_operating_profiles",entityId:actor.institution.id,metadata:{operatingModel:model}});
   return NextResponse.json({profile:data},{headers:{"Cache-Control":"no-store"}});
  }
  if(body?.action==="update_profile"){
   if(!validInstitutionProfile(body?.profile))throw new AdministrationError(400,"Check the branding, terminology, thresholds and export settings.");
   const {data,error}=await actor.db.from("institution_operating_profiles").upsert(profileRow(actor.institution.id,body.profile,actor.userId)).select("*").single();if(error)throw error;
   await recordInstitutionAudit(actor.db,{actorId:actor.userId,institutionId:actor.institution.id,eventType:"institution.configuration.updated",entityType:"institution_operating_profiles",entityId:actor.institution.id,metadata:{operatingModel:body.profile.operatingModel}});
   return NextResponse.json({profile:data},{headers:{"Cache-Control":"no-store"}});
  }
  if(body?.action==="upsert_support_template"){
   if(!validSupportTemplate(body?.template))throw new AdministrationError(400,"Check the support template.");const item=body.template;
   const {data,error}=await actor.db.from("institution_support_templates").upsert({institution_id:actor.institution.id,pathway:item.pathway,
    name:item.name.trim(),objective:item.objective.trim(),target_days:item.targetDays,follow_up_days:item.followUpDays,
    milestone_blueprint:[],active:true,updated_by_user_id:actor.userId,updated_at:new Date().toISOString()},{onConflict:"institution_id,pathway"}).select("*").single();if(error)throw error;
   await recordInstitutionAudit(actor.db,{actorId:actor.userId,institutionId:actor.institution.id,eventType:"institution.support_template.updated",entityType:"institution_support_templates",entityId:data.id,metadata:{pathway:item.pathway}});
   return NextResponse.json({template:data},{headers:{"Cache-Control":"no-store"}});
  }
  throw new AdministrationError(400,"Unsupported configuration action.");
 }catch(error){return administrationErrorResponse(error);}
}
