import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  canAccessWorkspace,
  canAccessWorkspaceRoute,
  getVisibleWorkspaceNavigation,
} from "@/lib/workspaces/workspace-access-policy";
import type { WorkspaceId } from "@/lib/workspaces/workspace-registry";

export async function requireWorkspaceAccess(workspaceId: WorkspaceId, pathname?: string) {
  const ctx = await getCurrentUserContext();
  const decision = pathname
    ? canAccessWorkspaceRoute(ctx, workspaceId, pathname)
    : canAccessWorkspace(ctx, workspaceId);

  if (!ctx.appUserId || !decision.allowed) redirect(`/access-denied?workspace=${workspaceId}`);

  return {
    ctx,
    workspace: decision.workspace,
    decision,
    navigationSections: getVisibleWorkspaceNavigation(ctx, workspaceId),
  };
}
