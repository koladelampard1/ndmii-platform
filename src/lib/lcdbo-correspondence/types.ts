import type { JsonRecord } from "@/types/platform";

export const LCDBO_CORRESPONDENCE_CANONICAL_HOST = "correspondence.dbin.ng";
export const LCDBO_CORRESPONDENCE_BRANDED_HOST = "correspondence.lcdbo.com";
export const LCDBO_CORRESPONDENCE_CANONICAL_ORIGIN = `https://${LCDBO_CORRESPONDENCE_CANONICAL_HOST}`;
export const LCDBO_CORRESPONDENCE_MODULE_KEY = "lcdb_o_workspace" as const;
export const LCDBO_PROGRAMME_SLUG = "local-content-development-beyond-oil";

export const CORRESPONDENCE_ISSUERS = ["JNT", "RMRDC", "RFNL"] as const;
export const CORRESPONDENCE_DIRECTIONS = ["IN", "OUT"] as const;
export const CORRESPONDENCE_SENSITIVITIES = ["public", "internal", "confidential", "restricted"] as const;
export const CORRESPONDENCE_STATUSES = [
  "draft",
  "in_review",
  "revision_requested",
  "awaiting_approval",
  "awaiting_signature",
  "signed",
  "ready_for_dispatch",
  "dispatch_failed",
  "sent",
  "delivery_failed",
  "delivered",
  "acknowledged",
  "response_received",
  "closed",
  "rejected",
  "superseded",
  "revoked",
  "cancelled",
] as const;

export const CORRESPONDENCE_TERMINAL_STATUSES = ["closed", "rejected", "superseded", "revoked", "cancelled"] as const;

export const CORRESPONDENCE_ROLE_GROUPS = {
  view: [
    "programme_officer",
    "institution_admin",
    "correspondence_admin",
    "records_admin",
    "requester",
    "drafter",
    "rmrdc_reviewer",
    "roseate_reviewer",
    "joint_secretariat",
    "rmrdc_signatory",
    "roseate_signatory",
    "signatory_delegate",
    "dispatch_officer",
    "data_analyst",
    "auditor",
    "observer",
    "rmrdc_representative",
    "roseate_representative",
  ],
  create: ["programme_officer", "institution_admin", "correspondence_admin", "records_admin", "requester", "drafter", "joint_secretariat", "rmrdc_representative", "roseate_representative"],
  draft: ["programme_officer", "institution_admin", "correspondence_admin", "records_admin", "drafter", "requester", "joint_secretariat", "rmrdc_representative", "roseate_representative"],
  review: ["programme_officer", "institution_admin", "correspondence_admin", "rmrdc_reviewer", "roseate_reviewer", "joint_secretariat", "rmrdc_representative", "roseate_representative"],
  approve: ["programme_officer", "institution_admin", "correspondence_admin", "rmrdc_reviewer", "roseate_reviewer", "joint_secretariat", "rmrdc_representative", "roseate_representative"],
  sign: ["rmrdc_signatory", "roseate_signatory", "signatory_delegate", "correspondence_admin", "rmrdc_representative", "roseate_representative"],
  dispatch: ["dispatch_officer", "records_admin", "correspondence_admin", "programme_officer", "institution_admin", "rmrdc_representative", "roseate_representative"],
  administer: ["programme_officer", "institution_admin", "correspondence_admin", "records_admin"],
  export: ["programme_officer", "institution_admin", "correspondence_admin", "records_admin", "data_analyst", "auditor"],
} as const;

export type CorrespondenceIssuer = typeof CORRESPONDENCE_ISSUERS[number];
export type CorrespondenceDirection = typeof CORRESPONDENCE_DIRECTIONS[number];
export type CorrespondenceSensitivity = typeof CORRESPONDENCE_SENSITIVITIES[number];
export type CorrespondenceStatus = typeof CORRESPONDENCE_STATUSES[number];
export type CorrespondenceAccessMode = keyof typeof CORRESPONDENCE_ROLE_GROUPS;
export type CorrespondenceRepresentativeRole = "rmrdc_representative" | "roseate_representative";

export type LcdboCorrespondenceRepresentativeAuthority = {
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
  metadata: JsonRecord;
  institution?: { id: string; name: string | null; slug: string | null } | null;
};

export type LcdboCorrespondenceUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
};

export type LcdboCorrespondenceTemplate = {
  id: string;
  programme_id: string;
  template_key: string;
  name: string;
  issuer: CorrespondenceIssuer;
  correspondence_type: string;
  version: string;
  status: "draft" | "pending_approval" | "approved" | "rejected" | "retired";
  body_template: string;
  placeholder_schema: JsonRecord;
  signature_config?: JsonRecord;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
};

export type LcdboCorrespondenceContact = {
  id: string;
  programme_id: string;
  contact_type: string;
  name: string;
  organisation: string | null;
  role_title: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  state: string | null;
  country: string | null;
  status: string;
  is_verified?: boolean;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
};

export type LcdboCorrespondenceDelegation = {
  id: string;
  programme_id: string;
  delegator_id: string;
  delegate_id: string;
  delegation_role: "rmrdc_signatory" | "roseate_signatory" | "joint_signatory";
  organisation: string | null;
  correspondence_scope?: JsonRecord;
  starts_at: string;
  expires_at: string | null;
  status: "active" | "revoked" | "expired";
  reason: string | null;
  created_by: string | null;
  created_at: string;
  delegator?: LcdboCorrespondenceUser | null;
  delegate?: LcdboCorrespondenceUser | null;
};

export type LcdboCorrespondenceRecord = {
  id: string;
  programme_id: string;
  reference: string;
  direction: CorrespondenceDirection;
  issuer: CorrespondenceIssuer;
  correspondence_type: string;
  subject: string;
  summary: string | null;
  sensitivity: CorrespondenceSensitivity;
  status: CorrespondenceStatus;
  owner_id: string | null;
  requester_id: string | null;
  drafter_id: string | null;
  current_assignee_id: string | null;
  initiating_institution_id?: string | null;
  action_institution_id?: string | null;
  simplified_status?: string | null;
  due_at: string | null;
  response_required: boolean;
  response_due_at: string | null;
  received_at: string | null;
  issued_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  closed_at: string | null;
  current_version_id: string | null;
  issued_version_id: string | null;
  verification_record_id: string | null;
  final_pdf_path?: string | null;
  final_pdf_hash?: string | null;
  final_pdf_generated_at?: string | null;
  metadata: JsonRecord;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  owner?: LcdboCorrespondenceUser | null;
  requester?: LcdboCorrespondenceUser | null;
  drafter?: LcdboCorrespondenceUser | null;
  assignee?: LcdboCorrespondenceUser | null;
  versions?: LcdboCorrespondenceDocumentVersion[];
  actions?: LcdboCorrespondenceWorkflowAction[];
  approvals?: LcdboCorrespondenceApproval[];
  signatures?: LcdboCorrespondenceSignatureEvent[];
  dispatches?: LcdboCorrespondenceDispatchEvent[];
  responses?: LcdboCorrespondenceResponse[];
  delivery_evidence?: LcdboCorrespondenceDeliveryEvidence[];
  relationships?: LcdboCorrespondenceRelationship[];
};

export type LcdboCorrespondenceDocumentVersion = {
  id: string;
  record_id: string;
  template_id: string | null;
  version_number: number;
  version_label: string;
  body: string | null;
  content: JsonRecord;
  source_file_path: string | null;
  rendered_pdf_path: string | null;
  document_hash: string | null;
  is_frozen: boolean;
  frozen_at: string | null;
  metadata: JsonRecord;
  created_by: string | null;
  created_at: string;
};

export type LcdboCorrespondenceWorkflowAction = {
  id: string;
  record_id: string;
  document_version_id: string | null;
  action_type: string;
  from_status: string | null;
  to_status: string | null;
  actor_user_id: string | null;
  assigned_to: string | null;
  note: string | null;
  metadata: JsonRecord;
  created_at: string;
};

export type LcdboCorrespondenceApproval = {
  id: string;
  record_id: string;
  document_version_id: string;
  approval_role: string;
  approver_id: string;
  decision: "approved" | "rejected" | "revision_requested";
  decision_note: string | null;
  decided_at: string;
};

export type LcdboCorrespondenceSignatureEvent = {
  id: string;
  record_id: string;
  document_version_id: string;
  signatory_id: string;
  signature_role: string;
  document_hash: string;
  signed_pdf_path: string | null;
  signed_at: string;
  signature_mode: "test_adapter" | "protected_asset" | "external_provider";
};

export type LcdboCorrespondenceDispatchEvent = {
  id: string;
  record_id: string;
  dispatch_channel: string;
  tracking_number: string;
  recipient_name?: string | null;
  recipient_email?: string | null;
  status: string;
  dispatched_by: string;
  dispatched_at: string;
  delivered_at: string | null;
};

export type LcdboCorrespondenceResponse = {
  id: string;
  record_id: string;
  response_reference: string | null;
  response_summary: string;
  response_document_path: string | null;
  received_by: string | null;
  received_at: string;
  metadata: JsonRecord;
  created_at: string;
};

export type LcdboCorrespondenceDeliveryEvidence = {
  id: string;
  dispatch_event_id: string;
  record_id: string;
  evidence_type: string;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  file_hash: string | null;
  receiving_person: string | null;
  delivery_note: string | null;
  captured_by: string;
  captured_at: string;
  supersedes_evidence_id?: string | null;
  status: "active" | "superseded" | "invalidated";
  invalidated_by?: string | null;
  invalidated_at?: string | null;
  invalidation_note?: string | null;
  malware_scan_status: "pending" | "passed" | "failed" | "not_required";
  metadata: JsonRecord;
  created_at: string;
};

export type LcdboCorrespondenceRelationship = {
  id: string;
  source_record_id: string;
  target_record_id: string;
  relationship_type: "reply_to" | "response_to" | "supersedes" | "superseded_by" | "follow_up_to" | "acknowledgement_of" | "related_to";
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type LcdboCorrespondenceNotificationJob = {
  id: string;
  programme_id: string;
  record_id: string | null;
  job_type: string;
  idempotency_key: string;
  recipient_user_id: string | null;
  status: "pending" | "sent" | "skipped" | "failed";
  scheduled_for: string;
  processed_at: string | null;
  attempts: number;
  last_error: string | null;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
};

export type LcdboCorrespondenceSummary = {
  total: number;
  awaitingApproval: number;
  awaitingSignature: number;
  readyForDispatch: number;
  sent: number;
  overdueResponses: number;
  myQueue: number;
};

export type PublicCorrespondenceVerification = {
  reference: string;
  subject: string;
  issuer: CorrespondenceIssuer;
  status: "valid" | "revoked" | "superseded" | "expired";
  issuedAt: string | null;
  documentHash: string;
  verificationUrl: string;
};
