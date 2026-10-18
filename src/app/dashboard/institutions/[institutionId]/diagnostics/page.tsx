import { redirect } from "next/navigation";
import { requireInstitutionActor } from "@/lib/institutional/administration-server";
import { DiagnosticWorkbench } from "@/components/institutional/diagnostic-workbench";
export const dynamic = "force-dynamic";
export default async function DiagnosticsPage({ params }: { params: Promise<{ institutionId: string }> }) {
  const { institutionId } = await params;
  const actor = await requireInstitutionActor(institutionId).catch(() => null);
  if (!actor) redirect("/dashboard/institutions");
  return <DiagnosticWorkbench institutionId={institutionId} institutionName={actor.institution.name}
    manager={actor.platformAdmin || actor.membership?.role === "institution_admin"} />;
}
