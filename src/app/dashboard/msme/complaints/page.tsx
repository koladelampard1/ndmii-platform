import { MsmeComplaintsDashboard } from "@/components/msme/complaints-dashboard";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export default async function MsmeComplaintsPage() {
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();
  const loggedInMsmeId = workspace.msme.id;
  const loggedInPublicMsmeId = workspace.msme.msme_id;
  const loggedInProviderId = workspace.provider.id;
  const filterBeingUsed = "msme_id";

  console.log("[provider-complaints][query-context]", {
    loggedInMsmeId,
    loggedInProviderId,
    loggedInPublicMsmeId,
    filterBeingUsed,
  });

  const { data: rows } = await supabase
    .from("complaints")
    .select("id,msme_id,provider_id,complaint_reference,title,summary,priority,status,created_at,complainant_name,reporter_name")
    .eq("msme_id", loggedInMsmeId)
    .order("created_at", { ascending: false })
    .limit(50);

  console.log("[provider-complaints][query-results]", {
    count: rows?.length ?? 0,
    complaintIds: (rows ?? []).map((row) => row.id),
    msmeIds: (rows ?? []).map((row) => row.msme_id),
    providerIds: (rows ?? []).map((row) => row.provider_id),
  });

  return <MsmeComplaintsDashboard complaints={rows ?? []} />;
}
