export const SUPPORT_ITEM_TYPES = ["milestone", "touchpoint", "issue", "referral"] as const;
export type SupportItemType = (typeof SUPPORT_ITEM_TYPES)[number];

export function supportPathwayForOutcome(outcome: string) {
  if (outcome === "facility_approved") return "post_finance";
  if (["declined", "deferred"].includes(outcome)) return "development_return";
  if (outcome === "additional_information") return "continuing_support";
  if (outcome === "withdrawn") return "closed";
  return null;
}

export function isOverdue(input: { status: string; dueAt: string | null | undefined }, now = Date.now()) {
  if (!input.dueAt || ["completed", "cancelled", "converted", "declined", "closed", "resolved"].includes(input.status)) return false;
  const due = Date.parse(input.dueAt);
  return Number.isFinite(due) && due < now;
}

export function validSupportPlanStatusTransition(from: string, to: string) {
  const transitions: Record<string, string[]> = {
    planned: ["active", "closed"], active: ["on_hold", "completed", "closed"],
    on_hold: ["active", "completed", "closed"], completed: ["active", "closed"], closed: [],
  };
  return Boolean(transitions[from]?.includes(to));
}

export function validItemStatus(type: SupportItemType, status: unknown) {
  const allowed: Record<SupportItemType, string[]> = {
    milestone: ["pending", "in_progress", "completed", "cancelled"],
    touchpoint: ["scheduled", "completed", "missed", "cancelled"],
    issue: ["open", "monitoring", "resolved", "closed"],
    referral: ["proposed", "introduced", "engaged", "converted", "declined", "closed"],
  };
  return typeof status === "string" && allowed[type].includes(status);
}

export function validItemStatusTransition(type: SupportItemType, from: string, to: string) {
  const transitions: Record<SupportItemType, Record<string, string[]>> = {
    milestone: { pending: ["in_progress", "completed", "cancelled"], in_progress: ["completed", "cancelled"], completed: ["in_progress"], cancelled: ["pending"] },
    touchpoint: { scheduled: ["completed", "missed", "cancelled"], missed: ["scheduled", "cancelled"], completed: [], cancelled: ["scheduled"] },
    issue: { open: ["monitoring", "resolved", "closed"], monitoring: ["open", "resolved", "closed"], resolved: ["monitoring", "closed"], closed: [] },
    referral: { proposed: ["introduced", "declined", "closed"], introduced: ["engaged", "declined", "closed"], engaged: ["converted", "declined", "closed"], converted: ["closed"], declined: ["closed"], closed: [] },
  };
  return Boolean(transitions[type][from]?.includes(to));
}

export function completionRequiresNote(type: SupportItemType, status: string, note: string) {
  const needsNote = (type === "milestone" && status === "completed") ||
    (type === "touchpoint" && status === "completed") ||
    (type === "issue" && ["resolved", "closed"].includes(status));
  return !needsNote || note.trim().length >= 3;
}
