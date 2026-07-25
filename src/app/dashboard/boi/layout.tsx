import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { canAccessRoute } from "@/lib/auth/authorization";
import { requireWorkspaceAccess } from "@/lib/workspaces/workspace-access-server";

export default async function BoiWorkspaceLayout({ children }: { children: ReactNode }) {
  const { ctx, workspace, navigationSections } = await requireWorkspaceAccess("boi", "/dashboard/boi");
  if (!canAccessRoute(ctx.role, "/dashboard/boi")) redirect("/access-denied");

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
