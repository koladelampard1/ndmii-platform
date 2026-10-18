import { redirect } from "next/navigation";
import { requireVerifiedActor } from "@/lib/institutional/administration-server";
import { InstitutionSharingConsole } from "@/components/institutional/institution-sharing-console";
export const dynamic = "force-dynamic";
export default async function InstitutionSharingPage() {
  const actor = await requireVerifiedActor().catch(() => null);
  if (!actor) redirect("/login?next=/dashboard/msme/institution-sharing");
  if (actor.role !== "msme") redirect("/access-denied");
  return <InstitutionSharingConsole />;
}
