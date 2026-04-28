import { ReactNode } from "react";
import { MsmeWorkspaceSidebar } from "@/components/msme/msme-workspace-sidebar";
import { MsmeDashboardTopbar } from "@/components/msme/msme-dashboard-topbar";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { isFeatureEnabled } from "@/lib/feature-flags";

export default async function MsmeWorkspaceLayout({ children }: { children: ReactNode }) {
  const workspace = await getProviderWorkspaceContext();
  const financeReadinessEnabled = isFeatureEnabled(process.env.FEATURE_FINANCE_READINESS);
  const publicProfileHref = `/providers/${workspace.provider.public_slug || workspace.provider.slug || workspace.provider.id}`;

  return (
    <div className="mx-auto grid w-full max-w-[1700px] gap-4 p-3 sm:p-4 lg:grid-cols-[290px,minmax(0,1fr)] lg:gap-5 lg:p-6">
      <MsmeWorkspaceSidebar financeReadinessEnabled={financeReadinessEnabled} />
      <main className="min-w-0 space-y-5">
        <MsmeDashboardTopbar
          ownerName={workspace.msme.owner_name || "MSME User"}
          businessName={workspace.provider.display_name || "Business"}
          publicProfileHref={publicProfileHref}
        />
        {children}
      </main>
    </div>
  );
}
