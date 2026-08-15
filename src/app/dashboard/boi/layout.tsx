import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { requireWorkspaceAccess } from "@/lib/workspaces/workspace-access-server";

export const dynamic = "force-dynamic";

export default async function BoiWorkspaceLayout({ children }: { children: ReactNode }) {
  const { ctx, workspace, navigationSections } = await requireWorkspaceAccess("boi", "/dashboard/boi");

  return (
    <WorkspaceShell
      workspace={workspace}
      userLabel={ctx.fullName ?? ctx.email ?? "BOI user"}
      userEmail={ctx.email}
      navigationSections={navigationSections}
    >
      {children}
    </WorkspaceShell>
  );
}
