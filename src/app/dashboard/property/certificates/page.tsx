import { getRegistryOperationsContext } from "@/app/dashboard/property/operations/_context";
import { listRegistryCases } from "@/lib/property/property-operations-service";
import { RegistryCaseTable, RegistryOperationsHero } from "@/components/property/property-operations-workspace";

export const dynamic = "force-dynamic";

export default async function PropertyCertificatesPage() {
  const { supabase } = await getRegistryOperationsContext();
  const all = await listRegistryCases({ client: supabase, limit: 200 });
  const cases = all.filter((item) => ["approved", "verified"].includes(item.status));

  return (
    <main className="space-y-6">
      <RegistryOperationsHero title="Property Certificates" description="Approved registry cases eligible for NPIN credential issuance and printable property registration certificates." />
      <RegistryCaseTable cases={cases} empty="No approved cases eligible for certificates yet." />
    </main>
  );
}
