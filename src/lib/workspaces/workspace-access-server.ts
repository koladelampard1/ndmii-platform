import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  canAccessWorkspace,
  canAccessWorkspaceRoute,
  canAccessWorkspaceRouteWithAssignments,
  getVisibleWorkspaceNavigation,
} from "@/lib/workspaces/workspace-access-policy";
import { canUseWorkspaceModule } from "@/lib/auth/scoped-permissions";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { WorkspaceId } from "@/lib/workspaces/workspace-registry";

export async function requireWorkspaceAccess(workspaceId: WorkspaceId, pathname?: string) {
  const ctx = await getCurrentUserContext();
  let decision = pathname
    ? canAccessWorkspaceRoute(ctx, workspaceId, pathname)
    : canAccessWorkspace(ctx, workspaceId);

  if (!decision.allowed && ctx.appUserId && decision.workspace.scopedAccess && pathname) {
    const supabase = await createServiceRoleSupabaseClient();
    const scopedAccess = decision.workspace.scopedAccess;
    const programme = scopedAccess.programmeSlug
      ? await supabase
          .from("programmes")
          .select("id,owning_institution_id")
          .eq("slug", scopedAccess.programmeSlug)
          .maybeSingle()
      : { data: null, error: null };
    if (programme.error) redirect(`/access-denied?workspace=${workspaceId}`);
    const scopeId = programme.data?.id ?? null;
    const institutionId = programme.data?.owning_institution_id ?? null;
    const assignments = await supabase
      .from("role_assignments")
      .select("role,scope_type,scope_id,institution_id,status,expires_at")
      .eq("user_id", ctx.appUserId)
      .eq("status", "active");
    if (!assignments.error) {
      const scopedDecision = canAccessWorkspaceRouteWithAssignments(ctx, workspaceId, pathname, assignments.data ?? [], {
        scopeId,
        institutionId,
      });
      if (scopedDecision.allowed && scopedAccess.moduleKey && scopeId) {
        const moduleAccess = await canUseWorkspaceModule({
          ctx,
          moduleKey: scopedAccess.moduleKey,
          allowedRoles: scopedAccess.roles,
          scopeType: scopedAccess.scopeType,
          scopeId,
          programmeId: scopeId,
          institutionId,
        }).catch(() => ({ allowed: false }));
        decision = moduleAccess.allowed ? scopedDecision : decision;
      } else if (scopedDecision.allowed) {
        decision = scopedDecision;
      }
    }
  }

  if (!ctx.appUserId || !decision.allowed) redirect(`/access-denied?workspace=${workspaceId}`);

  return {
    ctx,
    workspace: decision.workspace,
    decision,
    navigationSections: decision.reason === "scoped_role"
      ? decision.workspace.navigationSections ?? [{ label: "Workspace", items: decision.workspace.navigation }]
      : getVisibleWorkspaceNavigation(ctx, workspaceId),
  };
}
