import type { UserRole } from "@/types/roles";

export const IMPACT_RESOURCES = [
  "workspace",
  "programme",
  "cohort",
  "beneficiary",
  "intervention",
  "assessment",
  "assessment_template",
  "monitoring_visit",
  "evidence",
  "indicator",
  "report",
  "analytics",
  "executive_dashboard",
  "intelligence",
  "risk_flag",
  "export",
  "assignment",
  "audit_log",
] as const;

export const IMPACT_ACTIONS = [
  "read",
  "create",
  "update",
  "submit",
  "review",
  "approve",
  "return",
  "verify",
  "archive",
  "export",
  "assign",
  "administer",
  "break_glass",
] as const;

export type ImpactResource = (typeof IMPACT_RESOURCES)[number];
export type ImpactAction = (typeof IMPACT_ACTIONS)[number];
export type ImpactPermission = Readonly<{ resource: ImpactResource; action: ImpactAction }>;

type ImpactRole = Extract<
  UserRole,
  | "admin"
  | "super_admin"
  | "boi_executive"
  | "programme_officer"
  | "assessment_officer"
  | "field_officer"
  | "data_analyst"
  | "auditor"
>;

type RoutePolicy = Readonly<{
  prefix: string;
  resource: ImpactResource;
  action: ImpactAction;
}>;

const READ = "read" as const;
const CREATE_UPDATE = ["create", "update"] as const;
const SUBMIT = ["submit"] as const;
const REVIEW_APPROVE_RETURN = ["review", "approve", "return"] as const;

function permissions(resource: ImpactResource, actions: readonly ImpactAction[]): ImpactPermission[] {
  return actions.map((action) => ({ resource, action }));
}

function readPermissions(resources: readonly ImpactResource[]): ImpactPermission[] {
  return resources.flatMap((resource) => permissions(resource, [READ]));
}

const ALL_READ_RESOURCES = IMPACT_RESOURCES.filter((resource) => resource !== "assignment") as ImpactResource[];
const PORTFOLIO_READ_RESOURCES: ImpactResource[] = [
  "workspace",
  "programme",
  "cohort",
  "beneficiary",
  "intervention",
  "assessment",
  "assessment_template",
  "monitoring_visit",
  "evidence",
  "indicator",
  "report",
  "analytics",
  "intelligence",
  "risk_flag",
  "export",
];
const PROGRAMME_OFFICER_READ_RESOURCES: ImpactResource[] = [
  "workspace",
  "programme",
  "cohort",
  "beneficiary",
  "intervention",
  "assessment",
  "monitoring_visit",
  "evidence",
  "indicator",
  "report",
  "export",
];

const ROLE_PERMISSIONS: Record<ImpactRole, readonly ImpactPermission[]> = {
  super_admin: [
    ...IMPACT_RESOURCES.flatMap((resource) => permissions(resource, IMPACT_ACTIONS)),
  ],
  admin: [
    ...readPermissions(IMPACT_RESOURCES),
    ...permissions("assignment", ["create", "update", "assign", "administer"]),
    ...permissions("workspace", ["administer"]),
    ...permissions("audit_log", ["export"]),
    ...permissions("export", ["export"]),
  ],
  boi_executive: [
    ...readPermissions([
      "workspace",
      "programme",
      "cohort",
      "beneficiary",
      "intervention",
      "assessment",
      "monitoring_visit",
      "evidence",
      "indicator",
      "report",
      "analytics",
      "executive_dashboard",
      "intelligence",
      "risk_flag",
      "export",
    ]),
    ...permissions("report", ["export"]),
    ...permissions("export", ["export"]),
  ],
  programme_officer: [
    ...readPermissions(PROGRAMME_OFFICER_READ_RESOURCES),
    ...["programme", "cohort", "beneficiary", "intervention"].flatMap((resource) =>
      permissions(resource as ImpactResource, CREATE_UPDATE),
    ),
    ...permissions("monitoring_visit", ["create", "update", "assign"]),
    ...permissions("report", [...CREATE_UPDATE, ...SUBMIT, "export"]),
    ...permissions("export", ["export"]),
  ],
  assessment_officer: [
    ...readPermissions(PORTFOLIO_READ_RESOURCES),
    ...permissions("assessment", [...CREATE_UPDATE, ...SUBMIT, ...REVIEW_APPROVE_RETURN]),
    ...permissions("assessment_template", CREATE_UPDATE),
    ...permissions("monitoring_visit", ["create", "update", "review", "return"]),
    ...permissions("evidence", [...CREATE_UPDATE, ...SUBMIT, "review", "verify", "return", "archive"]),
    ...permissions("indicator", [...CREATE_UPDATE, ...SUBMIT, "review", "verify", "return"]),
    ...permissions("report", ["review", "approve", "return", "export"]),
    ...permissions("risk_flag", ["update", "review"]),
    ...permissions("intelligence", ["update", "review"]),
    ...permissions("export", ["export"]),
  ],
  field_officer: [
    ...readPermissions(["workspace", "cohort", "beneficiary", "monitoring_visit", "evidence", "indicator", "intelligence", "risk_flag"]),
    ...permissions("monitoring_visit", ["update", "submit"]),
    ...permissions("evidence", [...CREATE_UPDATE, ...SUBMIT]),
    ...permissions("indicator", [...CREATE_UPDATE, ...SUBMIT]),
  ],
  data_analyst: [
    ...readPermissions([
      "workspace",
      "programme",
      "cohort",
      "beneficiary",
      "intervention",
      "assessment",
      "monitoring_visit",
      "evidence",
      "indicator",
      "report",
      "analytics",
      "executive_dashboard",
      "intelligence",
      "risk_flag",
      "export",
    ]),
    ...permissions("analytics", ["create", "update", "export"]),
    ...permissions("intelligence", ["create", "update"]),
    ...permissions("risk_flag", ["create", "update", "review"]),
    ...permissions("export", ["export"]),
  ],
  auditor: [
    ...readPermissions(ALL_READ_RESOURCES),
    ...permissions("audit_log", ["export"]),
    ...permissions("export", ["export"]),
  ],
};

const ROUTE_POLICIES: readonly RoutePolicy[] = [
  { prefix: "/dashboard/impact-intelligence/assessments/templates", resource: "assessment_template", action: "read" },
  { prefix: "/dashboard/impact-intelligence/programmes", resource: "programme", action: "read" },
  { prefix: "/dashboard/impact-intelligence/cohorts", resource: "cohort", action: "read" },
  { prefix: "/dashboard/impact-intelligence/interventions", resource: "intervention", action: "read" },
  { prefix: "/dashboard/impact-intelligence/assessments", resource: "assessment", action: "read" },
  { prefix: "/dashboard/impact-intelligence/monitoring", resource: "monitoring_visit", action: "read" },
  { prefix: "/dashboard/impact-intelligence/field-visits", resource: "monitoring_visit", action: "read" },
  { prefix: "/dashboard/impact-intelligence/evidence", resource: "evidence", action: "read" },
  { prefix: "/dashboard/impact-intelligence/indicators", resource: "indicator", action: "read" },
  { prefix: "/dashboard/impact-intelligence/reports", resource: "report", action: "read" },
  { prefix: "/dashboard/impact-intelligence/analytics", resource: "analytics", action: "read" },
  { prefix: "/dashboard/impact-intelligence/executive", resource: "executive_dashboard", action: "read" },
  { prefix: "/dashboard/impact-intelligence/intelligence", resource: "intelligence", action: "read" },
  { prefix: "/dashboard/impact-intelligence/risk-flags", resource: "risk_flag", action: "read" },
  { prefix: "/dashboard/impact-intelligence", resource: "workspace", action: "read" },
];

function isImpactRole(role: UserRole): role is ImpactRole {
  return role in ROLE_PERMISSIONS;
}

function routeMatchesPrefix(route: string, prefix: string) {
  return route === prefix || route.startsWith(`${prefix}/`);
}

export function canRole(role: UserRole, resource: ImpactResource, action: ImpactAction): boolean {
  if (!isImpactRole(role)) return false;
  return ROLE_PERMISSIONS[role].some((permission) => permission.resource === resource && permission.action === action);
}

export function requireRolePermission(
  role: UserRole,
  resource: ImpactResource,
  action: ImpactAction,
  message: string,
) {
  if (!canRole(role, resource, action)) throw new Error(message);
}

export function getRolePermissions(role: UserRole): readonly ImpactPermission[] {
  return isImpactRole(role) ? ROLE_PERMISSIONS[role] : [];
}

export function getRoutePolicy(route: string): RoutePolicy | null {
  return ROUTE_POLICIES.find((policy) => routeMatchesPrefix(route, policy.prefix)) ?? null;
}

export function canAccessRoute(role: UserRole, route: string): boolean {
  const policy = getRoutePolicy(route);
  return policy ? canRole(role, policy.resource, policy.action) : false;
}

export function roleHasAny(role: UserRole, checks: readonly ImpactPermission[]): boolean {
  return checks.some((check) => canRole(role, check.resource, check.action));
}

export function logImpactPolicyDrift(input: {
  role: UserRole;
  route: string;
  legacyAllowed: boolean;
  canonicalAllowed: boolean;
}) {
  if (input.legacyAllowed === input.canonicalAllowed) return;
  console.warn("[impact-authorization-policy-drift]", {
    role: input.role,
    route: input.route,
    legacyAllowed: input.legacyAllowed,
    canonicalAllowed: input.canonicalAllowed,
  });
}
