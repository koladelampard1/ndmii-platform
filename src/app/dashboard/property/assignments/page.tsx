import { getRegistryOperationsContext } from "@/app/dashboard/property/operations/_context";
import { listRegistryCases } from "@/lib/property/property-operations-service";
import { RegistryCaseTable, RegistryOperationsHero } from "@/components/property/property-operations-workspace";

export const dynamic = "force-dynamic";

export default async function RegistryAssignmentsPage() {
  const { ctx, supabase } = await getRegistryOperationsContext();
  const cases = await listRegistryCases({ client: supabase, ctx, assignedTo: ctx.appUserId, limit: 200 });

  return (
    <main className="space-y-6">
      <RegistryOperationsHero
        title="My Registry Assignments"
        description="Cases currently assigned to you for document review, ownership verification, survey review, title preparation or registry decision support."
        actions={[{ href: "/dashboard/property/operations", label: "Command Centre" }]}
      />
      <RegistryCaseTable cases={cases} empty="No active case assignments." />
    </main>
  );
}
