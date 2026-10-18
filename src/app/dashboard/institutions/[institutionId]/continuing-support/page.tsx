import { redirect } from "next/navigation";
import { requireInstitutionActor } from "@/lib/institutional/administration-server";
import { ContinuingSupportWorkbench } from "@/components/institutional/continuing-support-workbench";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ institutionId: string }> }) {
  const { institutionId } = await params;
  const actor = await requireInstitutionActor(institutionId).catch(() => null);
  if (!actor) redirect("/dashboard/institutions");
  const role = actor.membership?.role ?? "";
  const supervisor = actor.platformAdmin || ["institution_admin", "institution_officer", "institution_reviewer"].includes(role);
  if (!supervisor && role !== "institution_agent") redirect("/dashboard/institutions");
  return <ContinuingSupportWorkbench institutionId={institutionId} institutionName={actor.institution.name} supervisor={supervisor} />;
}
