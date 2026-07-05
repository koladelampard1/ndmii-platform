import { getRegistryOperationsContext } from "@/app/dashboard/property/operations/_context";
import { listRegistryCases } from "@/lib/property/property-operations-service";
import { RegistryCaseTable, RegistryOperationsHero } from "@/components/property/property-operations-workspace";

export const dynamic = "force-dynamic";

export default async function RegistryVerificationPage() {
  const { ctx, supabase } = await getRegistryOperationsContext();
  const all = await listRegistryCases({ client: supabase, ctx, limit: 200 });
  const cases = all.filter((item) => ["under_review", "awaiting_documents", "awaiting_survey", "awaiting_ownership"].includes(item.status));

  return (
    <main className="space-y-6">
      <RegistryOperationsHero title="Verification Workspace" description="Document, ownership and survey verification cases requiring officer action." />
      <RegistryCaseTable cases={cases} empty="No verification cases currently pending." />
    </main>
  );
}
