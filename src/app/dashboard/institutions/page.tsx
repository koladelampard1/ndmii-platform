import { redirect } from "next/navigation";
import { AdministrationError, requireVerifiedActor } from "@/lib/institutional/administration-server";
import { InstitutionAdministrationConsole } from "@/components/institutional/institution-administration-console";

export const dynamic = "force-dynamic";

export default async function InstitutionsPage() {
  try {
    await requireVerifiedActor();
  } catch (error) {
    if (error instanceof AdministrationError && error.status === 401) redirect("/login?next=/dashboard/institutions");
    redirect("/access-denied");
  }
  return <InstitutionAdministrationConsole />;
}
