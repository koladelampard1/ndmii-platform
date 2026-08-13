import type { CorrespondenceStatus } from "@/lib/lcdbo-correspondence/types";

export const CORRESPONDENCE_ALLOWED_TRANSITIONS: Record<CorrespondenceStatus, CorrespondenceStatus[]> = {
  draft: ["in_review", "cancelled"],
  in_review: ["revision_requested", "awaiting_approval", "rejected", "cancelled"],
  revision_requested: ["in_review", "cancelled"],
  awaiting_approval: ["awaiting_signature", "revision_requested", "rejected", "cancelled"],
  awaiting_signature: ["signed", "revision_requested", "cancelled"],
  signed: ["ready_for_dispatch", "revoked", "superseded"],
  ready_for_dispatch: ["sent", "dispatch_failed", "revoked", "superseded"],
  dispatch_failed: ["ready_for_dispatch", "cancelled"],
  sent: ["delivered", "delivery_failed", "acknowledged", "response_received", "closed", "revoked", "superseded"],
  delivery_failed: ["ready_for_dispatch", "closed", "revoked"],
  delivered: ["acknowledged", "response_received", "closed", "revoked", "superseded"],
  acknowledged: ["response_received", "closed", "revoked", "superseded"],
  response_received: ["closed", "superseded"],
  closed: [],
  rejected: [],
  superseded: [],
  revoked: [],
  cancelled: [],
};

export function canTransitionCorrespondence(from: CorrespondenceStatus, to: CorrespondenceStatus) {
  return CORRESPONDENCE_ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertCorrespondenceTransition(from: CorrespondenceStatus, to: CorrespondenceStatus) {
  if (!canTransitionCorrespondence(from, to)) {
    throw new Error(`Invalid LCDBO correspondence transition: ${from} → ${to}`);
  }
}

export function isTerminalCorrespondenceStatus(status: CorrespondenceStatus) {
  return CORRESPONDENCE_ALLOWED_TRANSITIONS[status]?.length === 0;
}
