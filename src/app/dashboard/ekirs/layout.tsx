import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { requireStateRevenueWorkspaceAccess } from "@/lib/state-revenue/access";

export const dynamic = "force-dynamic";

export default async function EkirsWorkspaceLayout({ children }: { children: ReactNode }) {
  const { ctx, workspace, navigationSections } = await requireStateRevenueWorkspaceAccess("ekiti", "/dashboard/ekirs");

  return (
    <WorkspaceShell
      workspace={workspace}
      userLabel={ctx.fullName ?? ctx.email ?? "EKIRS user"}
      userEmail={ctx.email}
      navigationSections={navigationSections}
    >
      {children}
    </WorkspaceShell>
  );
}
