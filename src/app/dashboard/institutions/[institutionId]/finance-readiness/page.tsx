import { redirect } from "next/navigation";
import { requireInstitutionActor } from "@/lib/institutional/administration-server";
import { FinanceReadinessWorkbench } from "@/components/institutional/finance-readiness-workbench";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{institutionId:string}>}){
 const {institutionId}=await params;const actor=await requireInstitutionActor(institutionId).catch(()=>null);if(!actor)redirect("/dashboard/institutions");
 const role=actor.membership?.role??"";return <FinanceReadinessWorkbench institutionId={institutionId} institutionName={actor.institution.name}
   manager={actor.platformAdmin||role==="institution_admin"} officer={actor.platformAdmin||["institution_admin","institution_officer","institution_reviewer"].includes(role)}/>;
}
