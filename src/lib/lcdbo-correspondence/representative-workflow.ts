import type {
  CorrespondenceIssuer,
  CorrespondenceRepresentativeRole,
  CorrespondenceStatus,
  LcdboCorrespondenceRecord,
} from "@/lib/lcdbo-correspondence/types";

export const REPRESENTATIVE_ROLES = ["rmrdc_representative", "roseate_representative"] as const;

export const SIMPLIFIED_CORRESPONDENCE_STATUSES = [
  "draft",
  "awaiting_roseate",
  "awaiting_rmrdc",
  "returned_for_correction",
  "rejected",
  "ready_to_send",
  "sent",
  "delivery_failed",
  "response_received",
  "closed",
  "cancelled",
  "revoked",
  "superseded",
] as const;

export type SimplifiedCorrespondenceStatus = typeof SIMPLIFIED_CORRESPONDENCE_STATUSES[number];

export type RepresentativeInstitution = "rmrdc" | "roseate";

export type RepresentativeAuthority = {
  id: string;
  user_id: string;
  programme_id: string;
  institution_id: string;
  representative_role: CorrespondenceRepresentativeRole;
  authority_status: "active" | "inactive" | "revoked" | "expired";
  authority_starts_at: string;
  authority_ends_at: string | null;
  can_apply_signature: boolean;
  can_dispatch: boolean;
  is_primary: boolean;
  signature_asset_ref: string | null;
  institution?: { id: string; name: string | null; slug: string | null } | null;
};

export function representativeInstitutionFromRole(role: string | null | undefined): RepresentativeInstitution | null {
  if (role === "rmrdc_representative") return "rmrdc";
  if (role === "roseate_representative") return "roseate";
  return null;
}

export function issuerForRepresentativeInstitution(institution: RepresentativeInstitution): CorrespondenceIssuer {
  return institution === "rmrdc" ? "RMRDC" : "RFNL";
}

export function signatureRoleForRepresentative(role: CorrespondenceRepresentativeRole) {
  return role === "rmrdc_representative" ? "rmrdc_signatory" : "roseate_signatory";
}

export function approvalRoleForRepresentative(role: CorrespondenceRepresentativeRole) {
  return role === "rmrdc_representative" ? "rmrdc_reviewer" : "roseate_reviewer";
}

export function counterpartyRoleForRepresentative(role: CorrespondenceRepresentativeRole): CorrespondenceRepresentativeRole {
  return role === "rmrdc_representative" ? "roseate_representative" : "rmrdc_representative";
}

export function counterpartyStatusForRepresentative(role: CorrespondenceRepresentativeRole): SimplifiedCorrespondenceStatus {
  return role === "rmrdc_representative" ? "awaiting_roseate" : "awaiting_rmrdc";
}

export function counterpartyLabelForRepresentative(role: CorrespondenceRepresentativeRole) {
  return role === "rmrdc_representative" ? "Roseate Forte" : "RMRDC";
}

export function institutionLabelForRepresentative(role: CorrespondenceRepresentativeRole) {
  return role === "rmrdc_representative" ? "RMRDC" : "Roseate Forte";
}

export function isRepresentativeRole(role: string | null | undefined): role is CorrespondenceRepresentativeRole {
  return REPRESENTATIVE_ROLES.includes(role as CorrespondenceRepresentativeRole);
}

export function simplifiedStatusForRecord(record: Pick<LcdboCorrespondenceRecord, "status" | "metadata"> & { simplified_status?: string | null }): SimplifiedCorrespondenceStatus {
  const explicit = record.simplified_status ?? (typeof record.metadata?.simplified_status === "string" ? record.metadata.simplified_status : null);
  if (SIMPLIFIED_CORRESPONDENCE_STATUSES.includes(explicit as SimplifiedCorrespondenceStatus)) return explicit as SimplifiedCorrespondenceStatus;

  const mapped: Partial<Record<CorrespondenceStatus, SimplifiedCorrespondenceStatus>> = {
    draft: "draft",
    in_review: "awaiting_rmrdc",
    revision_requested: "returned_for_correction",
    awaiting_approval: "awaiting_rmrdc",
    awaiting_signature: "awaiting_rmrdc",
    signed: "ready_to_send",
    ready_for_dispatch: "ready_to_send",
    dispatch_failed: "delivery_failed",
    sent: "sent",
    delivery_failed: "delivery_failed",
    delivered: "sent",
    acknowledged: "sent",
    response_received: "response_received",
    closed: "closed",
    rejected: "rejected",
    superseded: "superseded",
    revoked: "revoked",
    cancelled: "cancelled",
  };
  return mapped[record.status] ?? "draft";
}

export function simplifiedStatusLabel(status: SimplifiedCorrespondenceStatus) {
  const labels: Record<SimplifiedCorrespondenceStatus, string> = {
    draft: "Draft",
    awaiting_roseate: "Awaiting Roseate",
    awaiting_rmrdc: "Awaiting RMRDC",
    returned_for_correction: "Returned for correction",
    rejected: "Rejected",
    ready_to_send: "Ready to send",
    sent: "Sent",
    delivery_failed: "Delivery failed",
    response_received: "Response received",
    closed: "Closed",
    cancelled: "Cancelled",
    revoked: "Revoked",
    superseded: "Superseded",
  };
  return labels[status];
}

export function isInitiatorAction(record: LcdboCorrespondenceRecord, authority: RepresentativeAuthority | null | undefined) {
  return Boolean(authority?.institution_id && record.initiating_institution_id === authority.institution_id);
}

export function isCounterpartyAction(record: LcdboCorrespondenceRecord, authority: RepresentativeAuthority | null | undefined) {
  return Boolean(authority?.institution_id && record.action_institution_id === authority.institution_id);
}

export function representativeBuckets(records: LcdboCorrespondenceRecord[], authority: RepresentativeAuthority | null | undefined) {
  return {
    needsMyAction: records.filter((record) => isCounterpartyAction(record, authority) && ["awaiting_roseate", "awaiting_rmrdc"].includes(simplifiedStatusForRecord(record))),
    drafts: records.filter((record) => isInitiatorAction(record, authority) && ["draft", "returned_for_correction"].includes(simplifiedStatusForRecord(record))),
    waitingForOtherParty: records.filter((record) => isInitiatorAction(record, authority) && ["awaiting_roseate", "awaiting_rmrdc"].includes(simplifiedStatusForRecord(record))),
    readyToSend: records.filter((record) => isInitiatorAction(record, authority) && simplifiedStatusForRecord(record) === "ready_to_send"),
    sent: records.filter((record) => isInitiatorAction(record, authority) && ["sent", "delivery_failed", "response_received", "closed"].includes(simplifiedStatusForRecord(record))),
  };
}
