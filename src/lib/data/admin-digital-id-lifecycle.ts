import type { UserRole } from "@/types/roles";

export const ADMIN_DIGITAL_ID_ACTIONS = [
  "activate",
  "suspend",
  "revoke",
  "start_renewal",
  "approve_renewal",
  "reinstate",
  "regenerate_token",
  "save_note",
  "assign",
] as const;

export type AdminDigitalIdAction = (typeof ADMIN_DIGITAL_ID_ACTIONS)[number];
export type DigitalIdLifecycleStatus = "pending" | "active" | "suspended" | "revoked" | "expired" | "renewal_pending";

export const DIGITAL_ID_LIFECYCLE_STATUSES: DigitalIdLifecycleStatus[] = [
  "active",
  "pending",
  "suspended",
  "revoked",
  "expired",
  "renewal_pending",
];

export const ADMIN_DIGITAL_ID_ACTION_TARGET_STATUS: Partial<Record<AdminDigitalIdAction, DigitalIdLifecycleStatus>> = {
  activate: "active",
  suspend: "suspended",
  revoke: "revoked",
  start_renewal: "renewal_pending",
  approve_renewal: "active",
  reinstate: "active",
};

export const ADMIN_DIGITAL_ID_LIFECYCLE_MATRIX: Record<DigitalIdLifecycleStatus, AdminDigitalIdAction[]> = {
  pending: ["activate", "revoke"],
  active: ["suspend", "start_renewal", "regenerate_token"],
  suspended: ["reinstate", "revoke"],
  expired: ["start_renewal"],
  renewal_pending: ["approve_renewal"],
  revoked: [],
};

export const ADMIN_DIGITAL_ID_LIFECYCLE_TRANSITIONS: Array<{ from: DigitalIdLifecycleStatus; actions: AdminDigitalIdAction[] }> = [
  { from: "pending", actions: ADMIN_DIGITAL_ID_LIFECYCLE_MATRIX.pending },
  { from: "active", actions: ADMIN_DIGITAL_ID_LIFECYCLE_MATRIX.active },
  { from: "suspended", actions: ADMIN_DIGITAL_ID_LIFECYCLE_MATRIX.suspended },
  { from: "expired", actions: ADMIN_DIGITAL_ID_LIFECYCLE_MATRIX.expired },
  { from: "renewal_pending", actions: ADMIN_DIGITAL_ID_LIFECYCLE_MATRIX.renewal_pending },
  { from: "revoked", actions: ADMIN_DIGITAL_ID_LIFECYCLE_MATRIX.revoked },
];

export const ADMIN_DIGITAL_ID_LIFECYCLE_ACTIONS = new Set<AdminDigitalIdAction>([
  "activate",
  "suspend",
  "revoke",
  "start_renewal",
  "approve_renewal",
  "reinstate",
  "regenerate_token",
]);

function cleanStatusValue(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function normalizeDigitalIdLifecycleStatus(value: unknown, fallback: DigitalIdLifecycleStatus = "pending"): DigitalIdLifecycleStatus {
  const normalized = cleanStatusValue(value);
  return (DIGITAL_ID_LIFECYCLE_STATUSES as string[]).includes(normalized) ? normalized as DigitalIdLifecycleStatus : fallback;
}

export function getAdminDigitalIdAllowedLifecycleActions(status: unknown) {
  return ADMIN_DIGITAL_ID_LIFECYCLE_MATRIX[normalizeDigitalIdLifecycleStatus(status)];
}

export function canRoleRunAdminDigitalIdAction(role: UserRole, action: AdminDigitalIdAction) {
  if (role === "super_admin" || role === "admin") return true;
  if (role === "reviewer") return ["activate", "start_renewal", "save_note"].includes(action);
  return false;
}

export function adminDigitalIdActionAlreadyAppliedMessage(status: DigitalIdLifecycleStatus) {
  return `Credential is already ${status.replaceAll("_", " ")}.`;
}
