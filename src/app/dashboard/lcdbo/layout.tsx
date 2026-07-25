import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { requireWorkspaceAccess } from "@/lib/workspaces/workspace-access-server";

export default async function LcdboWorkspaceLayout({ children }: { children: ReactNode }) {
  const { ctx, workspace, navigationSections } = await requireWorkspaceAccess("lcdbo", "/dashboard/lcdbo");

  return (
    <WorkspaceShell
      workspace={workspace}
      userLabel={ctx.fullName ?? ctx.email ?? "LCDBO user"}
      userEmail={ctx.email}
      navigationSections={navigationSections}
    >
      {children}
    </WorkspaceShell>
  );
}
