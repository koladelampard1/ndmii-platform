import type { UserRole } from "@/types/roles";

export type UserContext = {
  authUserId: string | null;
  appUserId: string | null;
  role: UserRole;
  email: string | null;
  fullName: string | null;
  linkedMsmeId: string | null;
  linkedProviderId: string | null;
  linkedAssociationId: string | null;
};

const KNOWN_ROLES: UserRole[] = [
  "public",
  "msme",
  "association_officer",
  "reviewer",
  "boi_executive",
  "programme_officer",
  "assessment_officer",
  "field_officer",
  "auditor",
  "fccpc_officer",
  "nrs_officer",
  "firs_officer",
  "admin",
  "super_admin",
];

const ROLE_ALIASES: Record<string, UserRole> = {
  association: "association_officer",
  associationofficer: "association_officer",
  association_officer: "association_officer",
  reviewer: "reviewer",
  boi: "boi_executive",
  boi_executive: "boi_executive",
  programme: "programme_officer",
  programme_officer: "programme_officer",
  program_officer: "programme_officer",
  assessment: "assessment_officer",
  assessment_officer: "assessment_officer",
  field: "field_officer",
  field_officer: "field_officer",
  fieldofficer: "field_officer",
  auditor: "auditor",
  fccpc: "fccpc_officer",
  fccpc_officer: "fccpc_officer",
  nrs: "nrs_officer",
  nrs_officer: "nrs_officer",
  firs: "firs_officer",
  firs_officer: "firs_officer",
  msme: "msme",
  admin: "admin",
  super_admin: "super_admin",
  public: "public",
};

const ROLE_HOME: Record<Exclude<UserRole, "public">, string> = {
  admin: "/dashboard/admin",
  super_admin: "/dashboard/admin",
  boi_executive: "/dashboard/impact-intelligence",
  programme_officer: "/dashboard/impact-intelligence",
  assessment_officer: "/dashboard/impact-intelligence",
  field_officer: "/dashboard/impact-intelligence/monitoring",
  auditor: "/dashboard/impact-intelligence",
  reviewer: "/dashboard/reviews",
  fccpc_officer: "/dashboard/fccpc",
  nrs_officer: "/dashboard/nrs",
  firs_officer: "/dashboard/nrs",
  association_officer: "/dashboard/associations",
  msme: "/dashboard/msme",
};

export const ROLE_ROUTE_PREFIXES: Record<Exclude<UserRole, "public">, string[]> = {
  admin: ["/dashboard", "/admin"],
  super_admin: ["/dashboard", "/admin"],
  boi_executive: ["/dashboard/impact-intelligence"],
  programme_officer: ["/dashboard/impact-intelligence"],
  assessment_officer: ["/dashboard/impact-intelligence"],
  field_officer: ["/dashboard/impact-intelligence"],
  auditor: ["/dashboard/impact-intelligence"],
  nrs_officer: ["/dashboard/nrs", "/dashboard/firs", "/dashboard/payments", "/dashboard/reviews"],
  msme: ["/dashboard/msme"],
  association_officer: ["/dashboard/associations", "/dashboard/reports"],
  reviewer: ["/dashboard/reviews", "/dashboard/compliance"],
  fccpc_officer: ["/dashboard/fccpc", "/dashboard/reviews"],
  firs_officer: ["/dashboard/nrs", "/dashboard/firs", "/dashboard/payments", "/dashboard/reviews"],
};

export function isPublicPath(path: string): boolean {
  return (
    path === "/" ||
    path === "/login" ||
    path === "/forgot-password" ||
    path === "/reset-password" ||
    path === "/auth/callback" ||
    path.startsWith("/auth/callback/") ||
    path === "/auth/confirm" ||
    path.startsWith("/auth/confirm/") ||
    path === "/auth/reset-password" ||
    path.startsWith("/auth/reset-password/") ||
    path === "/password-setup" ||
    path.startsWith("/password-setup/") ||
    path === "/set-password" ||
    path.startsWith("/set-password/") ||
    path === "/update-password" ||
    path.startsWith("/update-password/") ||
    path.startsWith("/signup") ||
    path.startsWith("/register") ||
    path === "/activate-account" ||
    path.startsWith("/activate-account/") ||
    path === "/association-access" ||
    path.startsWith("/verify") ||
    path === "/marketplace" ||
    path.startsWith("/marketplace/") ||
    path === "/search" ||
    path.startsWith("/search?") ||
    path === "/categories" ||
    path.startsWith("/categories/") ||
    path === "/about" ||
    path === "/terms" ||
    path.startsWith("/terms/") ||
    path === "/privacy" ||
    path.startsWith("/privacy/") ||
    path === "/cookies" ||
    path.startsWith("/cookies/") ||
    path === "/for-msmes" ||
    path === "/for-associations" ||
    path === "/for-government" ||
    path === "/for-financial-institutions" ||
    path === "/partners" ||
    path === "/resources" ||
    path === "/contact" ||
    path === "/sample-id-card" ||
    path.startsWith("/provider/") ||
    path.startsWith("/providers/") ||
    path.startsWith("/invoice/") ||
    path === "/access-denied"
  );
}

export function getDefaultDashboardRoute(role: UserRole): string {
  if (role === "public") return "/login";
  return ROLE_HOME[role];
}

export function normalizeUserRole(rawRole: string | null | undefined, fallback: UserRole = "public"): UserRole {
  if (!rawRole) return fallback;
  const cleaned = rawRole.trim().toLowerCase();
  if (!cleaned) return fallback;
  const compacted = cleaned.replace(/[\s-]/g, "_");
  const withoutUnderscore = compacted.replace(/_/g, "");
  const resolved = ROLE_ALIASES[compacted] ?? ROLE_ALIASES[withoutUnderscore];
  if (resolved) return resolved;
  return KNOWN_ROLES.includes(compacted as UserRole) ? (compacted as UserRole) : fallback;
}

function routeMatchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function canAccessRoute(role: UserRole, path: string): boolean {
  if (isPublicPath(path)) return true;
  if (role === "public") return false;
  if (role === "admin" || role === "super_admin") return routeMatchesPrefix(path, "/dashboard") || routeMatchesPrefix(path, "/admin");
  if (path === "/dashboard") return true;
  return ROLE_ROUTE_PREFIXES[role].some((prefix) => routeMatchesPrefix(path, prefix));
}

export type MsmeLikeRecord = {
  id: string;
  created_by?: string | null;
  association_id?: string | null;
  review_status?: string | null;
};

export function canViewMsme(role: UserRole, userContext: UserContext, msmeRecord: MsmeLikeRecord): boolean {
  if (role === "admin" || role === "super_admin") return true;

  if (role === "msme") {
    return Boolean(userContext.linkedMsmeId && msmeRecord.id === userContext.linkedMsmeId);
  }

  if (role === "association_officer") {
    return Boolean(userContext.linkedAssociationId && msmeRecord.association_id === userContext.linkedAssociationId);
  }

  if (role === "reviewer") {
    return ["pending_review", "submitted", "changes_requested", "approved", "rejected"].includes(msmeRecord.review_status ?? "");
  }

  if (role === "fccpc_officer" || role === "firs_officer" || role === "nrs_officer") {
    return true;
  }

  return false;
}

export function canActOnMsme(role: UserRole, action: string, userContext: UserContext, msmeRecord: MsmeLikeRecord): boolean {
  if (role === "admin" || role === "super_admin") return true;

  if (role === "msme") {
    if (!["edit_onboarding", "view_id_card", "simulate_payment"].includes(action)) return false;
    return Boolean(userContext.linkedMsmeId && msmeRecord.id === userContext.linkedMsmeId);
  }

  if (role === "association_officer") {
    if (!["verify_member", "invite_member", "update_association"].includes(action)) return false;
    return Boolean(userContext.linkedAssociationId && msmeRecord.association_id === userContext.linkedAssociationId);
  }

  if (role === "reviewer") {
    if (!["approve", "reject", "changes", "override_validation"].includes(action)) return false;
    return ["pending_review", "submitted", "changes_requested", "approved", "rejected"].includes(msmeRecord.review_status ?? "");
  }

  if (role === "fccpc_officer") {
    return ["assign_complaint", "update_complaint_status", "flag", "suspend", "reinstate"].includes(action);
  }

  if (role === "firs_officer" || role === "nrs_officer") {
    return ["tax_action", "compliance_notice", "reminder", "under_review", "mark_overdue", "mark_compliant"].includes(action);
  }

  return false;
}

export type NavigationItem = { href: string; label: string };
export type NavigationGroup = { label: string; items: NavigationItem[] };

export const ROLE_NAV_ITEMS: Record<Exclude<UserRole, "public">, NavigationItem[]> = {
  admin: [
    { href: "/dashboard/admin", label: "Admin Dashboard" },
    { href: "/dashboard/admin/msmes", label: "MSME Registry" },
    { href: "/dashboard/admin/verifications", label: "Verifications" },
    { href: "/dashboard/admin/digital-ids", label: "Digital IDs" },
    { href: "/dashboard/admin/associations", label: "Associations" },
    { href: "/dashboard/admin/association-members", label: "Association Members / Approvals" },
    { href: "/dashboard/admin/association-upload", label: "Bulk Upload" },
    { href: "/dashboard/admin/complaints", label: "Complaints" },
    { href: "/dashboard/impact-intelligence", label: "Impact Intelligence" },
    { href: "/dashboard/admin/public-verification", label: "Public Verification" },
  ],
  super_admin: [
    { href: "/dashboard/admin", label: "Admin Dashboard" },
    { href: "/dashboard/admin/msmes", label: "MSME Registry" },
    { href: "/dashboard/admin/verifications", label: "Verifications" },
    { href: "/dashboard/admin/digital-ids", label: "Digital IDs" },
    { href: "/dashboard/admin/associations", label: "Associations" },
    { href: "/dashboard/admin/association-members", label: "Association Members / Approvals" },
    { href: "/dashboard/admin/association-upload", label: "Bulk Upload" },
    { href: "/dashboard/admin/complaints", label: "Complaints" },
    { href: "/dashboard/impact-intelligence", label: "Impact Intelligence" },
    { href: "/dashboard/admin/public-verification", label: "Public Verification" },
  ],
  boi_executive: [
    { href: "/dashboard/impact-intelligence", label: "Overview" },
    { href: "/dashboard/impact-intelligence/programmes", label: "Programmes" },
    { href: "/dashboard/impact-intelligence/interventions", label: "Interventions" },
    { href: "/dashboard/impact-intelligence/assessments", label: "Assessments" },
    { href: "/dashboard/impact-intelligence/monitoring", label: "Monitoring" },
    { href: "/dashboard/impact-intelligence/evidence", label: "Evidence" },
    { href: "/dashboard/impact-intelligence/executive", label: "Executive Dashboard" },
    { href: "/dashboard/impact-intelligence/analytics", label: "Analytics" },
    { href: "/dashboard/impact-intelligence/reports", label: "Reports" },
    { href: "/dashboard/impact-intelligence/intelligence", label: "Intelligence" },
    { href: "/dashboard/impact-intelligence/risk-flags", label: "Risk Flags" },
  ],
  programme_officer: [
    { href: "/dashboard/impact-intelligence", label: "Overview" },
    { href: "/dashboard/impact-intelligence/programmes", label: "Programmes" },
    { href: "/dashboard/impact-intelligence/interventions", label: "Interventions" },
    { href: "/dashboard/impact-intelligence/assessments", label: "Assessments" },
    { href: "/dashboard/impact-intelligence/monitoring", label: "Monitoring" },
    { href: "/dashboard/impact-intelligence/evidence", label: "Evidence" },
    { href: "/dashboard/impact-intelligence/executive", label: "Executive Dashboard" },
    { href: "/dashboard/impact-intelligence/analytics", label: "Analytics" },
    { href: "/dashboard/impact-intelligence/reports", label: "Reports" },
    { href: "/dashboard/impact-intelligence/intelligence", label: "Intelligence" },
    { href: "/dashboard/impact-intelligence/risk-flags", label: "Risk Flags" },
  ],
  assessment_officer: [
    { href: "/dashboard/impact-intelligence", label: "Overview" },
    { href: "/dashboard/impact-intelligence/programmes", label: "Programmes" },
    { href: "/dashboard/impact-intelligence/interventions", label: "Interventions" },
    { href: "/dashboard/impact-intelligence/assessments", label: "Assessments" },
    { href: "/dashboard/impact-intelligence/monitoring", label: "Monitoring" },
    { href: "/dashboard/impact-intelligence/evidence", label: "Evidence" },
    { href: "/dashboard/impact-intelligence/executive", label: "Executive Dashboard" },
    { href: "/dashboard/impact-intelligence/analytics", label: "Analytics" },
    { href: "/dashboard/impact-intelligence/reports", label: "Reports" },
    { href: "/dashboard/impact-intelligence/intelligence", label: "Intelligence" },
    { href: "/dashboard/impact-intelligence/risk-flags", label: "Risk Flags" },
  ],
  field_officer: [
    { href: "/dashboard/impact-intelligence/monitoring", label: "Assigned Monitoring" },
    { href: "/dashboard/impact-intelligence/evidence", label: "Evidence" },
    { href: "/dashboard/impact-intelligence/intelligence", label: "Assigned Alerts" },
    { href: "/dashboard/impact-intelligence/risk-flags", label: "Risk Flags" },
  ],
  auditor: [
    { href: "/dashboard/impact-intelligence", label: "Overview" },
    { href: "/dashboard/impact-intelligence/programmes", label: "Programmes" },
    { href: "/dashboard/impact-intelligence/interventions", label: "Interventions" },
    { href: "/dashboard/impact-intelligence/assessments", label: "Assessments" },
    { href: "/dashboard/impact-intelligence/monitoring", label: "Monitoring" },
    { href: "/dashboard/impact-intelligence/evidence", label: "Evidence" },
    { href: "/dashboard/impact-intelligence/executive", label: "Executive Dashboard" },
    { href: "/dashboard/impact-intelligence/analytics", label: "Analytics" },
    { href: "/dashboard/impact-intelligence/reports", label: "Reports" },
    { href: "/dashboard/impact-intelligence/intelligence", label: "Intelligence" },
    { href: "/dashboard/impact-intelligence/risk-flags", label: "Risk Flags" },
  ],
  msme: [
    { href: "/dashboard/msme", label: "Provider Workspace" },
    { href: "/dashboard/msme/profile", label: "Profile Overview" },
    { href: "/dashboard/msme/public-profile", label: "Public Profile Preview" },
    { href: "/dashboard/msme/services", label: "Service Catalog" },
    { href: "/dashboard/msme/portfolio", label: "Portfolio Gallery" },
    { href: "/dashboard/msme/reviews", label: "Reviews & Replies" },
    { href: "/dashboard/msme/complaints", label: "Complaint Visibility" },
    { href: "/dashboard/msme/quotes", label: "Quote Requests" },
    { href: "/dashboard/msme/invoices", label: "Invoices" },
    { href: "/dashboard/msme/bookkeeping", label: "Bookkeeping" },
    { href: "/dashboard/msme/revenue", label: "Revenue" },
    { href: "/dashboard/msme/settings", label: "Provider Settings" },
    { href: "/dashboard/msme/onboarding", label: "Complete Profile Wizard" },
    { href: "/dashboard/msme/id-card", label: "My Business Identity Credential" },
    { href: "/dashboard/msme/compliance", label: "My KYC Status" },
    { href: "/dashboard/msme/payments", label: "My Tax / VAT" },
    { href: "/verify", label: "Public Verification" },
  ],
  association_officer: [
    { href: "/dashboard/associations", label: "Association Workspace" },
    { href: "/dashboard/associations/complaints", label: "Complaints Desk" },
    { href: "/dashboard/associations/bulk-upload", label: "Bulk Member Onboarding" },
    { href: "/dashboard/reports", label: "Association Exports" },
    { href: "/verify", label: "Public Verification" },
  ],
  reviewer: [
    { href: "/dashboard/reviews", label: "Reviewer Workflow" },
    { href: "/dashboard/reviews/compliance", label: "Compliance Reviews" },
    { href: "/dashboard/compliance", label: "KYC Review" },
    { href: "/verify", label: "Public Verification" },
  ],
  fccpc_officer: [
    { href: "/dashboard/fccpc", label: "FCCPC Workspace" },
    { href: "/dashboard/reviews/compliance", label: "Compliance Reviews" },
    { href: "/verify", label: "Public Verification" },
  ],
  nrs_officer: [
    { href: "/dashboard/nrs", label: "NRS Operations" },
    { href: "/dashboard/nrs/invoices", label: "Invoice Registry" },
    { href: "/dashboard/nrs/vat-monitor", label: "VAT Monitor" },
    { href: "/dashboard/nrs/revenue", label: "Revenue Monitor" },
    { href: "/dashboard/reviews/compliance", label: "Compliance Reviews" },
    { href: "/dashboard/payments", label: "Tax / VAT" },
    { href: "/verify", label: "Public Verification" },
  ],
  firs_officer: [
    { href: "/dashboard/nrs", label: "NRS Operations" },
    { href: "/dashboard/nrs/invoices", label: "Invoice Registry" },
    { href: "/dashboard/nrs/vat-monitor", label: "VAT Monitor" },
    { href: "/dashboard/nrs/revenue", label: "Revenue Monitor" },
    { href: "/dashboard/reviews/compliance", label: "Compliance Reviews" },
    { href: "/dashboard/payments", label: "Tax / VAT" },
    { href: "/verify", label: "Public Verification" },
  ],
};

export const ROLE_NAV_GROUPS: Partial<Record<Exclude<UserRole, "public">, NavigationGroup[]>> = {
  boi_executive: [{ label: "Impact Intelligence", items: ROLE_NAV_ITEMS.boi_executive }],
  programme_officer: [{ label: "Impact Intelligence", items: ROLE_NAV_ITEMS.programme_officer }],
  assessment_officer: [{ label: "Impact Intelligence", items: ROLE_NAV_ITEMS.assessment_officer }],
  field_officer: [{ label: "Impact Intelligence", items: ROLE_NAV_ITEMS.field_officer }],
  auditor: [{ label: "Impact Intelligence", items: ROLE_NAV_ITEMS.auditor }],
  admin: [
    {
      label: "Overview",
      items: [{ href: "/dashboard/admin", label: "Admin Dashboard" }],
    },
    {
      label: "MSME Management",
      items: [
        { href: "/dashboard/admin/msmes", label: "MSME Registry" },
        { href: "/dashboard/admin/verifications", label: "Verifications" },
        { href: "/dashboard/admin/digital-ids", label: "Digital IDs" },
      ],
    },
    {
      label: "Association Management",
      items: [
        { href: "/dashboard/admin/associations", label: "Associations" },
        { href: "/dashboard/admin/association-members", label: "Association Members / Approvals" },
        { href: "/dashboard/admin/association-upload", label: "Bulk Upload" },
      ],
    },
    {
      label: "Operations",
      items: [
        { href: "/dashboard/admin/complaints", label: "Complaints" },
        { href: "/dashboard/impact-intelligence", label: "Impact Intelligence" },
        { href: "/dashboard/admin/public-verification", label: "Public Verification" },
      ],
    },
  ],
  super_admin: [
    {
      label: "Overview",
      items: [{ href: "/dashboard/admin", label: "Admin Dashboard" }],
    },
    {
      label: "MSME Management",
      items: [
        { href: "/dashboard/admin/msmes", label: "MSME Registry" },
        { href: "/dashboard/admin/verifications", label: "Verifications" },
        { href: "/dashboard/admin/digital-ids", label: "Digital IDs" },
      ],
    },
    {
      label: "Association Management",
      items: [
        { href: "/dashboard/admin/associations", label: "Associations" },
        { href: "/dashboard/admin/association-members", label: "Association Members / Approvals" },
        { href: "/dashboard/admin/association-upload", label: "Bulk Upload" },
      ],
    },
    {
      label: "Operations",
      items: [
        { href: "/dashboard/admin/complaints", label: "Complaints" },
        { href: "/dashboard/impact-intelligence", label: "Impact Intelligence" },
        { href: "/dashboard/admin/public-verification", label: "Public Verification" },
      ],
    },
  ],
};
