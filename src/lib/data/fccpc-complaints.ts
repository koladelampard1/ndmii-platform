export const FCCPC_STATUS_OPTIONS = [
  "submitted",
  "under_review",
  "regulator_review",
  "escalated",
  "resolved",
  "dismissed",
  "closed",
] as const;

export type FccpcStatus = (typeof FCCPC_STATUS_OPTIONS)[number];

const LEGACY_TO_STATUS: Record<string, FccpcStatus> = {
  open: "submitted",
  new: "submitted",
  submitted: "submitted",
  investigating: "under_review",
  under_review: "under_review",
  regulator_review: "regulator_review",
  enforcement: "escalated",
  escalated: "escalated",
  resolved: "resolved",
  dismissed: "dismissed",
  closed: "closed",
};

export function normalizeFccpcStatus(value: string | null | undefined): FccpcStatus {
  const normalized = String(value ?? "").trim().toLowerCase();
  return LEGACY_TO_STATUS[normalized] ?? "submitted";
}

export function fccpcStatusLabel(value: string | null | undefined) {
  return normalizeFccpcStatus(value).replaceAll("_", " ");
}
