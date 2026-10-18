import { redirect } from "next/navigation";
import { requireVerifiedActor } from "@/lib/institutional/administration-server";
import { BusinessDiagnosticPlans } from "@/components/institutional/business-diagnostic-plans";
export const dynamic = "force-dynamic";
export default async function DiagnosticPlansPage() {
  const actor = await requireVerifiedActor().catch(() => null);
  if (!actor) redirect("/login?next=/dashboard/msme/diagnostic-plans");
  if (actor.role !== "msme") redirect("/access-denied");
  return <BusinessDiagnosticPlans/>;
}
