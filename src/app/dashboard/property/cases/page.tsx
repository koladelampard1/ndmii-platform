import { getRegistryOperationsContext } from "@/app/dashboard/property/operations/_context";
import { listRegistryCases } from "@/lib/property/property-operations-service";
import { RegistryCaseTable, RegistryOperationsHero } from "@/components/property/property-operations-workspace";

export const dynamic = "force-dynamic";

export default async function RegistryCasesPage() {
  const { supabase } = await getRegistryOperationsContext();
  const cases = await listRegistryCases({ client: supabase, limit: 200 });

  return (
    <main className="space-y-6">
      <RegistryOperationsHero
        title="Registry Cases"
        description="Permanent case records for submitted property registration applications, including assignments, decisions, comments, documents and audit trail."
        actions={[
          { href: "/dashboard/property/operations", label: "Command Centre" },
          { href: "/dashboard/property/pending", label: "Pending" },
          { href: "/dashboard/property/completed", label: "Completed" },
        ]}
      />
      <RegistryCaseTable cases={cases} />
    </main>
  );
}
