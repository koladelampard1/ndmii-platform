import type { UserRole } from "@/types/roles";

export type UserContext = {
  authUserId: string | null;
  appUserId: string | null;
  role: UserRole;
  email: string | null;
  fullName: string | null;
  linkedMsmeId: string | null;
  linkedAssociationId: string | null;
};

const ROLE_HOME: Record<Exclude<UserRole, "public">, string> = {
  admin: "/dashboard/executive",
  reviewer: "/dashboard/reviews",
  fccpc_officer: "/dashboard/fccpc",
  firs_officer: "/dashboard/nrs",
  association_officer: "/dashboard/associations",
  msme: "/dashboard/msme",
};

export const ROLE_ROUTE_PREFIXES: Record<Exclude<UserRole, "public">, string[]> = {
  admin: ["/dashboard"],
  msme: ["/dashboard/msme", "/dashboard/compliance", "/dashboard/payments"],
  association_officer: ["/dashboard/associations", "/dashboard/reports"],
  reviewer: ["/dashboard/reviews", "/dashboard/compliance"],
  fccpc_officer: ["/dashboard/fccpc"],
  firs_officer: ["/dashboard/nrs", "/dashboard/firs", "/dashboard/payments"],
};

export function isPublicPath(path: string): boolean {
  return path === "/" || path === "/login" || path.startsWith("/register") || path.startsWith("/verify") || path === "/access-denied";
}

export function getDefaultDashboardRoute(role: UserRole): string {
  if (role === "public") return "/login";
  return ROLE_HOME[role];
}

export function canAccessRoute(role: UserRole, path: string): boolean {
  if (isPublicPath(path)) return true;
  if (role === "public") return false;
  if (role === "admin") return path.startsWith("/dashboard");
  return ROLE_ROUTE_PREFIXES[role].some((prefix) => path.startsWith(prefix));
}

export type MsmeLikeRecord = {
  id: string;
  created_by?: string | null;
  association_id?: string | null;
  review_status?: string | null;
};

export function canViewMsme(role: UserRole, userContext: UserContext, msmeRecord: MsmeLikeRecord): boolean {
  if (role === "admin") return true;

  if (role === "msme") {
    return Boolean(userContext.linkedMsmeId && msmeRecord.id === userContext.linkedMsmeId);
  }

  if (role === "association_officer") {
    return Boolean(userContext.linkedAssociationId && msmeRecord.association_id === userContext.linkedAssociationId);
  }

  if (role === "reviewer") {
    return ["pending_review", "submitted", "changes_requested", "approved", "rejected"].includes(msmeRecord.review_status ?? "");
  }

  if (role === "fccpc_officer" || role === "firs_officer") {
    return true;
  }

  return false;
}

export function canActOnMsme(role: UserRole, action: string, userContext: UserContext, msmeRecord: MsmeLikeRecord): boolean {
  if (role === "admin") return true;

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

  if (role === "firs_officer") {
    return ["tax_action", "compliance_notice", "reminder", "under_review", "mark_overdue", "mark_compliant"].includes(action);
  }

  return false;
}

export const ROLE_NAV_ITEMS: Record<Exclude<UserRole, "public">, Array<{ href: string; label: string }>> = {
  admin: [
    { href: "/dashboard/executive", label: "Executive Dashboard" },
    { href: "/dashboard/msme", label: "MSME Registry" },
    { href: "/dashboard/msme/onboarding", label: "Onboarding Wizard" },
    { href: "/dashboard/msme/id-registry", label: "Digital ID Registry" },
    { href: "/dashboard/reviews", label: "Reviewer Workflow" },
    { href: "/dashboard/compliance", label: "KYC Simulation" },
    { href: "/dashboard/fccpc", label: "FCCPC Workspace" },
    { href: "/dashboard/nrs", label: "NRS Operations" },
    { href: "/dashboard/associations", label: "Associations" },
    { href: "/dashboard/manufacturers", label: "Manufacturers" },
    { href: "/dashboard/reports", label: "Reports & Export" },
    { href: "/dashboard/audit", label: "Audit Trail" },
    { href: "/dashboard/payments", label: "Tax / VAT" },
    { href: "/verify", label: "Public Verification" },
  ],
  msme: [
    { href: "/dashboard/msme", label: "My MSME Profile" },
    { href: "/dashboard/msme/onboarding", label: "My Onboarding" },
    { href: "/dashboard/msme/id-card", label: "My Digital ID Card" },
    { href: "/dashboard/compliance", label: "My KYC Status" },
    { href: "/dashboard/payments", label: "My Tax / VAT" },
    { href: "/verify", label: "Public Verification" },
  ],
  association_officer: [
    { href: "/dashboard/associations", label: "Association Workspace" },
    { href: "/dashboard/reports", label: "Association Exports" },
    { href: "/verify", label: "Public Verification" },
  ],
  reviewer: [
    { href: "/dashboard/reviews", label: "Reviewer Workflow" },
    { href: "/dashboard/compliance", label: "KYC Review" },
    { href: "/verify", label: "Public Verification" },
  ],
  fccpc_officer: [
    { href: "/dashboard/fccpc", label: "FCCPC Workspace" },
    { href: "/verify", label: "Public Verification" },
  ],
  firs_officer: [
    { href: "/dashboard/nrs", label: "NRS Operations" },
    { href: "/dashboard/payments", label: "Tax / VAT" },
    { href: "/verify", label: "Public Verification" },
  ],
};
