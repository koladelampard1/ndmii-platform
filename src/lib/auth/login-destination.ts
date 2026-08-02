import { canAccessRoute, getDefaultDashboardRoute } from "@/lib/auth/authorization";
import { resolveDbinHostSurface, type DbinHostSurface } from "@/lib/routing/dbin-hosts";
import {
  canAccessWorkspaceRouteWithAssignments,
  findWorkspaceByRoute,
  type WorkspaceScopedAssignment,
} from "@/lib/workspaces/workspace-access-policy";
import { getWorkspaceDefinition, type WorkspaceId } from "@/lib/workspaces/workspace-registry";
import type { UserRole } from "@/types/roles";

type MinimalSupabaseClient = {
  from: (table: string) => {
    select: (columns: string) => any;
  };
};

type LoginDestinationInput = {
  role: UserRole;
  appUserId: string | null;
  requestedWorkspace?: string | null;
  returnTo?: string | null;
  next?: string | null;
  requestHost?: string | null;
};

type WorkspaceScope = {
  scopeId: string | null;
  institutionId: string | null;
};

export type LoginDestinationResult = {
  targetRoute: string;
  reason:
    | "safe_return_to"
    | "safe_next"
    | "lcdbo_scoped_default"
    | "lcdbo_applicant_default"
    | "lcdbo_denied"
    | "ekirs_scoped_default"
    | "ekirs_applicant_default"
    | "ekirs_denied"
    | "nrs_default"
    | "nrs_denied"
    | "role_default";
};

const STATE_REVENUE_ROUTE_BY_ROLE: Record<string, string> = {
  registration_reviewer: "/dashboard/ekirs/applications",
  field_officer: "/dashboard/ekirs/verification/field",
  field_supervisor: "/dashboard/ekirs/verification/field",
  state_revenue_admin: "/dashboard/ekirs",
  state_revenue_executive: "/dashboard/ekirs",
  taxpayer_support_officer: "/dashboard/ekirs/applications",
  data_analyst: "/dashboard/ekirs/intelligence",
  auditor: "/dashboard/ekirs/intelligence",
  observer: "/dashboard/ekirs",
};

const STATE_REVENUE_ROLE_PRIORITY = [
  "state_revenue_admin",
  "registration_reviewer",
  "field_supervisor",
  "field_officer",
  "taxpayer_support_officer",
  "state_revenue_executive",
  "data_analyst",
  "auditor",
  "observer",
];

const LCDBO_ROUTE_BY_ROLE: Record<string, string> = {
  programme_officer: "/dashboard/lcdbo/delivery",
  institution_admin: "/dashboard/lcdbo",
  data_analyst: "/dashboard/lcdbo/intelligence",
  auditor: "/dashboard/lcdbo/intelligence",
  observer: "/dashboard/lcdbo/executive",
  state_coordinator: "/dashboard/lcdbo/my-work",
  lga_coordinator: "/dashboard/lcdbo/my-work",
  cluster_manager: "/dashboard/lcdbo/my-work",
};

const LCDBO_ROLE_PRIORITY = [
  "programme_officer",
  "institution_admin",
  "state_coordinator",
  "lga_coordinator",
  "cluster_manager",
  "data_analyst",
  "auditor",
  "observer",
];

function getSafeRelativePath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value === "/login" || value.startsWith("/login?")) return null;
  if (value === "/logout" || value.startsWith("/logout?")) return null;
  return value;
}

function getHostSurface(requestHost: string | null | undefined) {
  return resolveDbinHostSurface(requestHost);
}

function internalPathForSurface(surface: DbinHostSurface, path: string) {
  if (surface === "ekirs") {
    if (path === "/") return "/ekirs";
    if (path === "/apply") return "/ekirs/apply";
    if (path.startsWith("/apply/")) return `/ekirs${path}`;
  }
  if (surface === "lcdbo") {
    if (path === "/") return "/lcdbo";
    if (["/about", "/clusters", "/contact", "/events", "/model", "/opportunities", "/partners", "/resources"].includes(path)) {
      return `/lcdbo${path}`;
    }
  }
  return path;
}

function displayPathForSurface(surface: DbinHostSurface, path: string) {
  if (surface === "ekirs") {
    if (path === "/ekirs") return "/";
    if (path === "/ekirs/apply") return "/apply";
    if (path.startsWith("/ekirs/apply/")) return path.replace(/^\/ekirs/, "");
  }
  if (surface === "lcdbo") {
    if (path === "/lcdbo") return "/";
    if (path.startsWith("/lcdbo/")) return path.replace(/^\/lcdbo/, "");
  }
  return path;
}

function isActiveAssignment(assignment: WorkspaceScopedAssignment, now = new Date()) {
  if (assignment.status !== "active") return false;
  if (!assignment.expires_at) return true;
  return new Date(assignment.expires_at).getTime() > now.getTime();
}

async function resolveWorkspaceScope(client: MinimalSupabaseClient, workspaceId: WorkspaceId): Promise<WorkspaceScope | null> {
  const workspace = getWorkspaceDefinition(workspaceId);
  const scopedAccess = workspace.scopedAccess;
  if (!scopedAccess) return { scopeId: null, institutionId: null };

  if (scopedAccess.programmeSlug) {
    const { data, error } = await client
      .from("programmes")
      .select("id,owning_institution_id")
      .eq("slug", scopedAccess.programmeSlug)
      .maybeSingle();
    if (error || !data?.id) return null;
    return {
      scopeId: String(data.id),
      institutionId: data.owning_institution_id ? String(data.owning_institution_id) : null,
    };
  }

  if (scopedAccess.institutionSlug) {
    const { data, error } = await client
      .from("institutions")
      .select("id")
      .eq("slug", scopedAccess.institutionSlug)
      .maybeSingle();
    if (error || !data?.id) return null;
    return {
      scopeId: null,
      institutionId: String(data.id),
    };
  }

  return { scopeId: null, institutionId: null };
}

async function loadAssignments(client: MinimalSupabaseClient, appUserId: string) {
  const { data, error } = await client
    .from("role_assignments")
    .select("role,scope_type,scope_id,institution_id,status,expires_at")
    .eq("user_id", appUserId)
    .eq("status", "active");

  if (error) return null;
  return (data ?? []) as WorkspaceScopedAssignment[];
}

async function canAccessCandidatePath(
  client: MinimalSupabaseClient,
  input: LoginDestinationInput,
  candidatePath: string,
  surface: DbinHostSurface,
) {
  const internalPath = internalPathForSurface(surface, candidatePath);
  if (canAccessRoute(input.role, internalPath)) return true;

  if (!input.appUserId) return false;
  const workspace = findWorkspaceByRoute(internalPath);
  if (!workspace?.scopedAccess) return false;

  const [scope, assignments] = await Promise.all([
    resolveWorkspaceScope(client, workspace.id),
    loadAssignments(client, input.appUserId),
  ]);
  if (!scope || !assignments) return false;

  return canAccessWorkspaceRouteWithAssignments(
    { role: input.role, appUserId: input.appUserId },
    workspace.id,
    internalPath,
    assignments,
    scope,
  ).allowed;
}

async function resolveEkirsDefault(
  client: MinimalSupabaseClient,
  input: LoginDestinationInput,
  surface: DbinHostSurface,
): Promise<LoginDestinationResult> {
  if (input.role === "msme") {
    return { targetRoute: surface === "ekirs" ? "/apply" : "/ekirs/apply", reason: "ekirs_applicant_default" };
  }

  if (input.role === "admin" || input.role === "super_admin") {
    return { targetRoute: "/dashboard/ekirs", reason: "ekirs_scoped_default" };
  }

  if (input.role !== "workspace_user" || !input.appUserId) {
    return { targetRoute: "/access-denied?workspace=ekirs&returnTo=/ekirs", reason: "ekirs_denied" };
  }

  const [scope, assignments] = await Promise.all([
    resolveWorkspaceScope(client, "ekirs"),
    loadAssignments(client, input.appUserId),
  ]);
  if (!scope?.institutionId || !assignments) {
    return { targetRoute: "/access-denied?workspace=ekirs&returnTo=/ekirs", reason: "ekirs_denied" };
  }

  const activeEkirsRoles = assignments
    .filter((assignment) => (
      isActiveAssignment(assignment)
      && assignment.scope_type === "institution"
      && assignment.institution_id === scope.institutionId
    ))
    .map((assignment) => assignment.role);

  const role = STATE_REVENUE_ROLE_PRIORITY.find((candidate) => activeEkirsRoles.includes(candidate));
  const route = role ? STATE_REVENUE_ROUTE_BY_ROLE[role] : null;
  if (!route) return { targetRoute: "/access-denied?workspace=ekirs&returnTo=/ekirs", reason: "ekirs_denied" };

  const allowed = canAccessWorkspaceRouteWithAssignments(
    { role: input.role, appUserId: input.appUserId },
    "ekirs",
    route,
    assignments,
    scope,
  ).allowed;

  return allowed
    ? { targetRoute: route, reason: "ekirs_scoped_default" }
    : { targetRoute: "/access-denied?workspace=ekirs&returnTo=/ekirs", reason: "ekirs_denied" };
}

async function resolveLcdboDefault(
  client: MinimalSupabaseClient,
  input: LoginDestinationInput,
): Promise<LoginDestinationResult> {
  if (input.role === "msme") {
    return { targetRoute: "/dashboard/msme/lcdbo", reason: "lcdbo_applicant_default" };
  }

  if (input.role === "admin" || input.role === "super_admin") {
    return { targetRoute: "/dashboard/lcdbo", reason: "lcdbo_scoped_default" };
  }

  if (input.role !== "workspace_user" || !input.appUserId) {
    return { targetRoute: "/access-denied?workspace=lcdbo&returnTo=/lcdbo", reason: "lcdbo_denied" };
  }

  const [scope, assignments] = await Promise.all([
    resolveWorkspaceScope(client, "lcdbo"),
    loadAssignments(client, input.appUserId),
  ]);
  if (!scope || !assignments) {
    return { targetRoute: "/access-denied?workspace=lcdbo&returnTo=/lcdbo", reason: "lcdbo_denied" };
  }

  const activeLcdboRoles = assignments
    .filter((assignment) => {
      if (!isActiveAssignment(assignment)) return false;
      const programmeMatches = Boolean(scope.scopeId && assignment.scope_type === "programme" && assignment.scope_id === scope.scopeId);
      const institutionMatches = Boolean(scope.institutionId && assignment.institution_id === scope.institutionId);
      return programmeMatches || institutionMatches;
    })
    .map((assignment) => assignment.role);

  const role = LCDBO_ROLE_PRIORITY.find((candidate) => activeLcdboRoles.includes(candidate));
  const route = role ? LCDBO_ROUTE_BY_ROLE[role] : null;
  if (!route) return { targetRoute: "/access-denied?workspace=lcdbo&returnTo=/lcdbo", reason: "lcdbo_denied" };

  const allowed = canAccessWorkspaceRouteWithAssignments(
    { role: input.role, appUserId: input.appUserId },
    "lcdbo",
    route,
    assignments,
    scope,
  ).allowed;

  return allowed
    ? { targetRoute: route, reason: "lcdbo_scoped_default" }
    : { targetRoute: "/access-denied?workspace=lcdbo&returnTo=/lcdbo", reason: "lcdbo_denied" };
}

export async function resolveLoginDestination(
  client: MinimalSupabaseClient,
  input: LoginDestinationInput,
): Promise<LoginDestinationResult> {
  const surface = getHostSurface(input.requestHost);
  const candidates = [
    { path: getSafeRelativePath(input.returnTo), reason: "safe_return_to" as const },
    { path: getSafeRelativePath(input.next), reason: "safe_next" as const },
  ];

  for (const candidate of candidates) {
    if (!candidate.path) continue;
    const allowed = await canAccessCandidatePath(client, input, candidate.path, surface);
    if (allowed) return { targetRoute: displayPathForSurface(surface, candidate.path), reason: candidate.reason };
  }

  if (surface === "ekirs" || input.requestedWorkspace === "ekirs") {
    return resolveEkirsDefault(client, input, surface);
  }

  if (surface === "lcdbo" || input.requestedWorkspace === "lcdbo") {
    return resolveLcdboDefault(client, input);
  }

  if (input.requestedWorkspace === "nrs") {
    return canAccessRoute(input.role, "/dashboard/nrs")
      ? { targetRoute: "/dashboard/nrs", reason: "nrs_default" }
      : {
          targetRoute: `/access-denied?workspace=nrs&returnTo=${encodeURIComponent(getDefaultDashboardRoute(input.role))}`,
          reason: "nrs_denied",
        };
  }

  return { targetRoute: getDefaultDashboardRoute(input.role), reason: "role_default" };
}
