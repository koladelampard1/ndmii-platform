import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { FinanceReadinessClient } from "./finance-readiness-client";

export default async function Page() {
  const workspace = await getProviderWorkspaceContext();
  return (
    <FinanceReadinessClient
      businessName={workspace.msme.business_name || workspace.provider.display_name || "MSME Business"}
      msmeId={workspace.msme.msme_id || "MSME-ID"}
    />
  );
}
