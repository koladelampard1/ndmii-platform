import type { UserRole } from "@/types/roles";
import { getWorkspaceDefinition, listWorkspaceDefinitions, type WorkspaceDefinition, type WorkspaceId, type WorkspaceNavigationItem } from "@/lib/workspaces/workspace-registry";

export type WorkspaceAccessContext = {
  role: UserRole;
  appUserId?: string | null;
};

export type WorkspaceAccessDecision = {
  allowed: boolean;
  workspace: WorkspaceDefinition;
  reason: "platform_admin" | "workspace_role" | "route_alias" | "navigation_route" | "denied";
};

function isPlatformAdminRole(role: UserRole) {
  return role === "admin" || role === "super_admin";
}

function routeMatches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function workspaceRoutes(workspace: WorkspaceDefinition) {
  return new Set([
    workspace.homepage,
    workspace.publicLanding,
    workspace.executiveDashboard,
    workspace.reports,
    ...(workspace.legacyRouteAliases ?? []),
    ...workspace.navigation.map((item) => item.href),
    ...workspace.navigation.map((item) => item.legacyHref).filter(Boolean),
    ...workspace.quickActions.map((item) => item.href),
    ...(workspace.navigationSections?.flatMap((section) => section.items.map((item) => item.href)) ?? []),
  ].filter((value): value is string => Boolean(value)));
}

export function getWorkspaceAccessPolicy(workspaceId: WorkspaceId) {
  const workspace = getWorkspaceDefinition(workspaceId);
  return {
    workspace,
    allowedRoles: workspace.allowedRoles,
    routes: [...workspaceRoutes(workspace)],
    capabilities: workspace.capabilities,
  };
}

export function canAccessWorkspace(ctx: WorkspaceAccessContext, workspaceId: WorkspaceId): WorkspaceAccessDecision {
  const workspace = getWorkspaceDefinition(workspaceId);
  if (ctx.role === "public" || (ctx.role === "msme" && workspaceId !== "msme" && workspaceId !== "property")) {
    return { allowed: false, workspace, reason: "denied" };
  }
  if (isPlatformAdminRole(ctx.role)) return { allowed: true, workspace, reason: "platform_admin" };
  if (workspace.allowedRoles.includes(ctx.role)) return { allowed: true, workspace, reason: "workspace_role" };
  return { allowed: false, workspace, reason: "denied" };
}

export function canAccessWorkspaceRoute(ctx: WorkspaceAccessContext, workspaceId: WorkspaceId, pathname: string): WorkspaceAccessDecision {
  const decision = canAccessWorkspace(ctx, workspaceId);
  if (!decision.allowed) return decision;
  const routes = workspaceRoutes(decision.workspace);
  const routeAllowed = [...routes].some((route) => routeMatches(pathname, route));
  if (!routeAllowed) return { ...decision, allowed: false, reason: "denied" };
  return { ...decision, reason: decision.reason === "platform_admin" ? "platform_admin" : "navigation_route" };
}

export function getVisibleWorkspaceNavigation(ctx: WorkspaceAccessContext, workspaceId: WorkspaceId) {
  const decision = canAccessWorkspace(ctx, workspaceId);
  if (!decision.allowed) return [];
  const roleAllowsItem = (item: WorkspaceNavigationItem) => !item.allowedRoles?.length || isPlatformAdminRole(ctx.role) || item.allowedRoles.includes(ctx.role);
  return decision.workspace.navigationSections?.map((section) => ({
    ...section,
    items: section.items.filter(roleAllowsItem),
  })).filter((section) => section.items.length) ?? [{ label: "Workspace", items: decision.workspace.navigation.filter(roleAllowsItem) }];
}

export function findWorkspaceByRoute(pathname: string) {
  return listWorkspaceDefinitions().find((workspace) => [...workspaceRoutes(workspace)].some((route) => routeMatches(pathname, route))) ?? null;
}
