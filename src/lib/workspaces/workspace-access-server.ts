import { redirect } from "next/navigation";
import { headers } from "next/headers";
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
import type { UserContext } from "@/lib/auth/authorization";
import type { WorkspaceScopedAssignment } from "@/lib/workspaces/workspace-access-policy";

export type WorkspaceAccessDenialReason =
  | "AUTH_REQUIRED"
  | "SESSION_EXPIRED"
  | "SESSION_REFRESH_FAILED"
  | "GLOBAL_ROLE_DENIED"
  | "NO_ACTIVE_ASSIGNMENT"
  | "WORKSPACE_ROLE_DENIED"
  | "PROGRAMME_SCOPE_DENIED"
  | "INSTITUTION_SCOPE_DENIED"
  | "MODULE_DENIED"
  | "RECORD_NOT_FOUND"
  | "RECORD_SCOPE_DENIED"
  | "SERVER_ERROR";

export type ResolvedWorkspaceAccess = {
  authenticated: boolean;
  ctx: UserContext;
  workspaceId: WorkspaceId;
  workspace: ReturnType<typeof canAccessWorkspace>["workspace"];
  requestedPath: string;
  requestId: string;
  globalRole: UserContext["role"];
  scopedAssignments: WorkspaceScopedAssignment[];
  programmeId: string | null;
  institutionId: string | null;
  allowed: boolean;
  reason: WorkspaceAccessDenialReason | "PLATFORM_ADMIN" | "GLOBAL_ROLE" | "SCOPED_ROLE";
  safeRedirectDestination: string;
  navigationSections: ReturnType<typeof getVisibleWorkspaceNavigation>;
};

function createRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `req_${Date.now().toString(36)}`;
}

async function getRequestId() {
  const headerStore = await headers();
  return headerStore.get("x-dbin-request-id") ?? createRequestId();
}

function loginRedirect(pathname: string, reason: WorkspaceAccessDenialReason, requestId: string) {
  const safePath = pathname.startsWith("/") && !pathname.startsWith("//") ? pathname : "/dashboard";
  return `/login?next=${encodeURIComponent(safePath)}&reason=${encodeURIComponent(reason.toLowerCase())}&requestId=${encodeURIComponent(requestId)}`;
}

function accessDeniedRedirect(workspaceId: WorkspaceId, pathname: string, reason: WorkspaceAccessDenialReason, requestId: string) {
  return `/access-denied?workspace=${encodeURIComponent(workspaceId)}&returnTo=${encodeURIComponent(pathname)}&reason=${encodeURIComponent(reason)}&requestId=${encodeURIComponent(requestId)}`;
}

function safeAssignments(data: unknown): WorkspaceScopedAssignment[] {
  return Array.isArray(data) ? (data as WorkspaceScopedAssignment[]) : [];
}

function deriveScopedDenialReason(
  assignments: WorkspaceScopedAssignment[],
  scope: { scopeId: string | null; institutionId: string | null },
  scopedAccess: NonNullable<ResolvedWorkspaceAccess["workspace"]["scopedAccess"]>,
): WorkspaceAccessDenialReason {
  const activeForRole = assignments.filter((assignment) => (
    assignment.status === "active"
    && (!assignment.expires_at || new Date(assignment.expires_at).getTime() > Date.now())
    && scopedAccess.roles.includes(assignment.role)
  ));
  if (!activeForRole.length) return "NO_ACTIVE_ASSIGNMENT";
  if (scopedAccess.scopeType === "programme" && scope.scopeId) {
    const programmeScoped = activeForRole.some((assignment) => assignment.scope_type === "programme");
    if (programmeScoped && !activeForRole.some((assignment) => assignment.scope_type === "programme" && assignment.scope_id === scope.scopeId)) {
      return "PROGRAMME_SCOPE_DENIED";
    }
  }
  if (scopedAccess.scopeType === "institution" && scope.institutionId) {
    const institutionScoped = activeForRole.some((assignment) => assignment.scope_type === "institution" || assignment.institution_id);
    if (institutionScoped && !activeForRole.some((assignment) => assignment.institution_id === scope.institutionId)) {
      return "INSTITUTION_SCOPE_DENIED";
    }
  }
  return "WORKSPACE_ROLE_DENIED";
}

function logWorkspaceAccess(result: ResolvedWorkspaceAccess, source: "resolver" | "require") {
  if (result.allowed) return;
  console.info("[workspace-access-denied]", {
    requestId: result.requestId,
    source,
    authenticated: result.authenticated,
    userId: result.ctx.appUserId,
    authUserId: result.ctx.authUserId,
    requestedPath: result.requestedPath,
    workspace: result.workspaceId,
    globalRole: result.globalRole,
    scopedRoles: result.scopedAssignments.map((assignment) => assignment.role),
    programmeId: result.programmeId,
    institutionId: result.institutionId,
    reason: result.reason,
  });
}

export async function resolveWorkspaceAccess(input: {
  workspaceId: WorkspaceId;
  pathname?: string;
  ctx?: UserContext;
}): Promise<ResolvedWorkspaceAccess> {
  const requestId = await getRequestId();
  const ctx = input.ctx ?? await getCurrentUserContext();
  const workspaceId = input.workspaceId;
  const pathname = input.pathname ?? canAccessWorkspace(ctx, workspaceId).workspace.homepage;
  let decision = pathname
    ? canAccessWorkspaceRoute(ctx, workspaceId, pathname)
    : canAccessWorkspace(ctx, workspaceId);
  let scopedAssignments: WorkspaceScopedAssignment[] = [];
  let programmeId: string | null = null;
  let institutionId: string | null = null;
  let denialReason: WorkspaceAccessDenialReason = "GLOBAL_ROLE_DENIED";

  const baseResult = () => ({
    authenticated: Boolean(ctx.appUserId && ctx.role !== "public"),
    ctx,
    workspaceId,
    workspace: decision.workspace,
    requestedPath: pathname,
    requestId,
    globalRole: ctx.role,
    scopedAssignments,
    programmeId,
    institutionId,
    allowed: decision.allowed,
    reason: decision.allowed
      ? decision.reason === "platform_admin"
        ? "PLATFORM_ADMIN" as const
        : decision.reason === "scoped_role"
          ? "SCOPED_ROLE" as const
          : "GLOBAL_ROLE" as const
      : denialReason,
    safeRedirectDestination: decision.allowed
      ? pathname
      : !ctx.appUserId || ctx.role === "public"
        ? loginRedirect(pathname, "AUTH_REQUIRED", requestId)
        : accessDeniedRedirect(workspaceId, pathname, denialReason, requestId),
    navigationSections: decision.reason === "scoped_role"
      ? decision.workspace.navigationSections ?? [{ label: "Workspace", items: decision.workspace.navigation }]
      : getVisibleWorkspaceNavigation(ctx, workspaceId),
  });

  if (!ctx.appUserId || ctx.role === "public") {
    denialReason = "AUTH_REQUIRED";
    const result = baseResult();
    logWorkspaceAccess(result, "resolver");
    return result;
  }

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
    if (programme.error) {
      denialReason = "SERVER_ERROR";
      const result = baseResult();
      logWorkspaceAccess(result, "resolver");
      return result;
    }

    const institution = !scopedAccess.programmeSlug && scopedAccess.institutionSlug
      ? await supabase
          .from("institutions")
          .select("id")
          .eq("slug", scopedAccess.institutionSlug)
          .maybeSingle()
      : { data: null, error: null };
    if (institution.error) {
      denialReason = "SERVER_ERROR";
      const result = baseResult();
      logWorkspaceAccess(result, "resolver");
      return result;
    }

    const scopeId = programme.data?.id ?? null;
    programmeId = scopeId;
    institutionId = programme.data?.owning_institution_id ?? institution.data?.id ?? null;
    const assignments = await supabase
      .from("role_assignments")
      .select("role,scope_type,scope_id,institution_id,status,expires_at")
      .eq("user_id", ctx.appUserId)
      .eq("status", "active");
    if (!assignments.error) {
      scopedAssignments = safeAssignments(assignments.data);
      denialReason = deriveScopedDenialReason(scopedAssignments, { scopeId, institutionId }, scopedAccess);
      const scopedDecision = canAccessWorkspaceRouteWithAssignments(ctx, workspaceId, pathname, scopedAssignments, {
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
        if (moduleAccess.allowed) {
          decision = scopedDecision;
          denialReason = "WORKSPACE_ROLE_DENIED";
        } else {
          denialReason = "MODULE_DENIED";
        }
      } else if (scopedDecision.allowed) {
        decision = scopedDecision;
        denialReason = "WORKSPACE_ROLE_DENIED";
      }
    } else {
      denialReason = "SERVER_ERROR";
    }
  }

  const result = baseResult();
  logWorkspaceAccess(result, "resolver");
  return result;
}

export async function requireWorkspaceAccess(workspaceId: WorkspaceId, pathname?: string) {
  const access = await resolveWorkspaceAccess({ workspaceId, pathname });

  if (!access.allowed) {
    logWorkspaceAccess(access, "require");
    redirect(access.safeRedirectDestination);
  }

  return {
    ctx: access.ctx,
    workspace: access.workspace,
    decision: access,
    navigationSections: access.navigationSections,
  };
}
