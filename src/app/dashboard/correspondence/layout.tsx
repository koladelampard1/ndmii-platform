import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { requireWorkspaceAccess } from "@/lib/workspaces/workspace-access-server";

export const dynamic = "force-dynamic";

export default async function CorrespondenceWorkspaceLayout({ children }: { children: ReactNode }) {
  const { ctx, workspace, navigationSections } = await requireWorkspaceAccess("correspondence", "/dashboard/correspondence");
  return (
    <WorkspaceShell
      workspace={workspace}
      userLabel={ctx.fullName ?? ctx.email ?? "Correspondence user"}
      userEmail={ctx.email}
      navigationSections={navigationSections}
    >
      {children}
    </WorkspaceShell>
  );
}
