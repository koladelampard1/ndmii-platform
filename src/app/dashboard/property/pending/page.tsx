import { getRegistryOperationsContext } from "@/app/dashboard/property/operations/_context";
import { listRegistryCases } from "@/lib/property/property-operations-service";
import { RegistryCaseTable, RegistryOperationsHero } from "@/components/property/property-operations-workspace";

export const dynamic = "force-dynamic";

export default async function PendingRegistryCasesPage() {
  const { supabase } = await getRegistryOperationsContext();
  const all = await listRegistryCases({ client: supabase, limit: 200 });
  const cases = all.filter((item) => ["submitted", "under_review", "awaiting_documents", "awaiting_survey", "awaiting_ownership", "returned", "suspended"].includes(item.status));

  return (
    <main className="space-y-6">
      <RegistryOperationsHero title="Pending Registry Cases" description="Applications requiring review, verification, correction, assignment, or registry decision." />
      <RegistryCaseTable cases={cases} empty="No pending registry cases." />
    </main>
  );
}
