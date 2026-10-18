import { redirect } from "next/navigation";
import { AdministrationError, requireInstitutionActor, requireManager } from "@/lib/institutional/administration-server";
import { InstitutionGoLiveWorkspace } from "@/components/institutional/institution-go-live-workspace";

export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ institutionId: string }> }) {
  const { institutionId } = await params; let actor;
  try { actor = await requireInstitutionActor(institutionId); requireManager(actor); }
  catch (error) {
    if (error instanceof AdministrationError && error.status === 401) redirect(`/login?next=/dashboard/institutions/${institutionId}/go-live`);
    redirect("/dashboard/institutions");
  }
  return <InstitutionGoLiveWorkspace institutionId={institutionId} platformAdmin={actor.platformAdmin} institutionName={actor.institution.name} />;
}
