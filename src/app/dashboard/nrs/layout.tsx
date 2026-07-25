import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { canAccessRoute } from "@/lib/auth/authorization";
import { requireWorkspaceAccess } from "@/lib/workspaces/workspace-access-server";

export default async function NrsWorkspaceLayout({ children }: { children: ReactNode }) {
  const { ctx, workspace, navigationSections } = await requireWorkspaceAccess("nrs", "/dashboard/nrs");
  if (!canAccessRoute(ctx.role, "/dashboard/nrs")) redirect("/access-denied?workspace=nrs");

  return (
    <WorkspaceShell
      workspace={workspace}
      userLabel={ctx.fullName ?? ctx.email ?? "NRS user"}
      userEmail={ctx.email}
      navigationSections={navigationSections}
    >
      {children}
    </WorkspaceShell>
  );
}
