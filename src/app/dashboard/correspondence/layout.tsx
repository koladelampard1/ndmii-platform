import type { ReactNode } from "react";
import { headers } from "next/headers";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { requireWorkspaceAccess } from "@/lib/workspaces/workspace-access-server";

export const dynamic = "force-dynamic";

export default async function CorrespondenceWorkspaceLayout({ children }: { children: ReactNode }) {
  const headerStore = await headers();
  const requestedPath = headerStore.get("x-dbin-pathname") ?? "/dashboard/correspondence";
  const safePath = requestedPath.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/dashboard/correspondence";
  const { ctx, workspace, navigationSections } = await requireWorkspaceAccess("correspondence", safePath);
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
