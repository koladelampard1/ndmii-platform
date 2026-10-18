import { redirect } from "next/navigation";
import { AdministrationError, requireInstitutionActor } from "@/lib/institutional/administration-server";
import { requireInsightsViewer } from "@/lib/institutional/institution-insights-server";
import { InstitutionCommandCentre } from "@/components/institutional/institution-command-centre";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{institutionId:string}>}){
 const {institutionId}=await params;let actor;
 try{actor=await requireInstitutionActor(institutionId);requireInsightsViewer(actor);}catch(error){if(error instanceof AdministrationError&&error.status===401)redirect(`/login?next=/dashboard/institutions/${institutionId}/overview`);redirect("/dashboard/institutions");}
 const canConfigure=actor.platformAdmin||actor.membership?.role==="institution_admin";
 return <InstitutionCommandCentre institutionId={institutionId} canConfigure={canConfigure}/>;
}
