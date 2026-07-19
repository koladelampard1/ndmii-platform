import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { canAccessRoute } from "@/lib/auth/authorization";
import { requireWorkspaceRole } from "@/lib/auth/workspace-guards";
import { getWorkspaceDefinition } from "@/lib/workspaces/workspace-registry";

export default async function BoiWorkspaceLayout({ children }: { children: ReactNode }) {
  const ctx = await requireWorkspaceRole(["admin", "super_admin", "boi_executive"], "/dashboard/boi");
  if (!canAccessRoute(ctx.role, "/dashboard/boi")) redirect("/access-denied");
  const workspace = getWorkspaceDefinition("boi");

  return (
    <WorkspaceShell
      workspace={workspace}
      userLabel={ctx.fullName ?? ctx.email ?? "BOI user"}
      userEmail={ctx.email}
    >
      {children}
    </WorkspaceShell>
  );
}
