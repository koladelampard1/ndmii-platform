import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { canAccessRoute } from "@/lib/auth/authorization";
import { requireWorkspaceRole } from "@/lib/auth/workspace-guards";
import { NRS_ACCESS_ROLES } from "@/lib/nrs/access";
import { getWorkspaceDefinition } from "@/lib/workspaces/workspace-registry";

export default async function NrsWorkspaceLayout({ children }: { children: ReactNode }) {
  const ctx = await requireWorkspaceRole([...NRS_ACCESS_ROLES], "/dashboard/nrs");
  if (!canAccessRoute(ctx.role, "/dashboard/nrs")) redirect("/access-denied?workspace=nrs");
  const workspace = getWorkspaceDefinition("nrs");

  return (
    <WorkspaceShell
      workspace={workspace}
      userLabel={ctx.fullName ?? ctx.email ?? "NRS user"}
      userEmail={ctx.email}
    >
      {children}
    </WorkspaceShell>
  );
}
