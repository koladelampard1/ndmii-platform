import type { ComponentProps } from "react";
import { MsmeComplaintsDashboard } from "@/components/msme/complaints-dashboard";
import { buildMsmeComplaintOrFilter } from "@/lib/data/complaints";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export default async function MsmeComplaintsPage() {
  const workspace = await getProviderWorkspaceContext();
  let complaints: ComponentProps<typeof MsmeComplaintsDashboard>["complaints"] = [];
  let errorMessage: string | null = null;

  try {
    const supabase = await createServiceRoleSupabaseClient();
    const ownershipFilter = buildMsmeComplaintOrFilter(workspace);

    const { data: rows, error } = await supabase
      .from("complaints")
      .select("id,msme_id,provider_msme_id,provider_id,provider_profile_id,complaint_reference,title,summary,priority,status,created_at,complainant_name,reporter_name")
      .or(ownershipFilter)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[provider-complaints][load_failed]", {
        operation: "load_msme_complaints",
        status: "error",
        error: error.message,
      });
      errorMessage = "Complaints could not be loaded right now.";
    } else {
      complaints = rows ?? [];
    }
  } catch (error) {
    console.error("[provider-complaints][load_failed]", {
      operation: "load_msme_complaints",
      status: "error",
      error: error instanceof Error ? error.message : "unknown_error",
    });
    errorMessage = "Complaints could not be loaded right now.";
  }

  return <MsmeComplaintsDashboard complaints={complaints} errorMessage={errorMessage} />;
}
