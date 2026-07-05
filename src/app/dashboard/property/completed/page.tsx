import { getRegistryOperationsContext } from "@/app/dashboard/property/operations/_context";
import { listRegistryCases } from "@/lib/property/property-operations-service";
import { RegistryCaseTable, RegistryOperationsHero } from "@/components/property/property-operations-workspace";

export const dynamic = "force-dynamic";

export default async function CompletedRegistryCasesPage() {
  const { supabase } = await getRegistryOperationsContext();
  const all = await listRegistryCases({ client: supabase, limit: 200 });
  const cases = all.filter((item) => ["approved", "verified", "rejected", "cancelled"].includes(item.status));

  return (
    <main className="space-y-6">
      <RegistryOperationsHero title="Completed Registry Cases" description="Approved, verified, rejected or cancelled registry cases with permanent audit history." />
      <RegistryCaseTable cases={cases} empty="No completed registry cases yet." />
    </main>
  );
}
