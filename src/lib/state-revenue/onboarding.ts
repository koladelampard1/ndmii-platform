import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserContext } from "@/lib/auth/authorization";
import { isPlatformAdmin } from "@/lib/auth/authorization";
import { approveCredential } from "@/lib/data/credential-trust";
import { generateMsmeId } from "@/lib/data/ndmii";
import { recordTrustedStateRevenueEvent } from "@/lib/data/platform-foundation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import {
  getStateRevenueJurisdiction,
  type StateRevenueJurisdictionConfig,
  type StateRevenueJurisdictionId,
} from "@/lib/state-revenue/jurisdictions";

type Client = SupabaseClient<any>;

export const STATE_REVENUE_APPLICATION_STATUSES = [
  "draft",
  "submitted",
  "contact_verification_required",
  "jurisdiction_unverified",
  "evidence_required",
  "duplicate_review_required",
  "reviewer_assigned",
  "under_review",
  "field_verification_required",
  "field_verification_assigned",
  "field_verification_in_progress",
  "field_verification_submitted",
  "additional_information_required",
  "resubmitted",
  "approved",
  "rejected",
  "withdrawn",
  "suspended",
  "no_longer_operating",
] as const;

export type StateRevenueApplicationStatus = (typeof STATE_REVENUE_APPLICATION_STATUSES)[number];
export type StateRevenueApplicationType = "new_business" | "existing_business";
export type DuplicateStatus =
  | "not_screened"
  | "no_candidate"
  | "possible_match"
  | "strong_match"
  | "confirmed_duplicate"
  | "distinct_business"
  | "manual_review_required"
  | "resolved_existing_identity";

export type StateRevenueApplication = {
  id: string;
  application_reference: string;
  jurisdiction_id: StateRevenueJurisdictionId | string;
  institution_id: string | null;
  applicant_user_id: string | null;
  existing_business_id: string | null;
  resolved_business_id: string | null;
  proposed_business_name: string | null;
  owner_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  application_type: StateRevenueApplicationType;
  current_status: StateRevenueApplicationStatus;
  eligibility_status: string;
  verification_level: number;
  duplicate_status: DuplicateStatus;
  assigned_reviewer_id: string | null;
  assigned_field_officer_id: string | null;
  sector: string | null;
  business_type: string | null;
  formality_status: string;
  cac_number: string | null;
  tin: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason_code: string | null;
  decision_notes: string | null;
  additional_information_request: Record<string, unknown>;
  additional_information_due_at: string | null;
  latest_applicant_response: string | null;
  resubmitted_at: string | null;
  resubmission_count: number;
  classification: string;
  test_data: boolean;
  consent_version: string | null;
  privacy_notice_version: string | null;
  declaration_accepted: boolean;
  location_consent_status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type StateRevenueOperatingLocation = {
  id: string;
  application_id: string | null;
  business_id: string | null;
  jurisdiction_id: string;
  state_code: string;
  lga_name: string;
  town: string;
  community: string | null;
  address: string;
  landmark: string | null;
  location_type: string;
  business_activity: string;
  operation_commenced_on: string | null;
  status: string;
  verification_status: string;
  verification_level: number;
};

export type StateRevenueEvidence = {
  id: string;
  application_id: string;
  evidence_type: string;
  original_filename: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  checksum_sha256: string | null;
  evidence_status: string;
  replacement_for_evidence_id: string | null;
  rejection_reason: string | null;
  classification: string;
  created_at: string;
};

export type StateRevenueVerificationTask = {
  id: string;
  application_id: string;
  verification_type: string;
  assigned_officer_id: string | null;
  assigned_supervisor_id: string | null;
  status: string;
  outcome: string | null;
  review_status: string;
  due_date: string | null;
  created_at: string;
};

export type StateRevenueApplicationDetail = StateRevenueApplication & {
  location: StateRevenueOperatingLocation | null;
  evidence: StateRevenueEvidence[];
  tasks: StateRevenueVerificationTask[];
  identityCandidates: Array<{
    id: string;
    candidate_business_id: string | null;
    match_signals: string[];
    confidence_category: string;
    resolution_status: string;
    reason: string | null;
  }>;
  history: Array<{ id: string; previous_status: string | null; new_status: string; notes: string | null; created_at: string }>;
  business: { id: string; msme_id: string | null; business_name: string | null; state: string | null; sector: string | null } | null;
};

export type StateRevenueApplicationInput = {
  jurisdictionId: StateRevenueJurisdictionId;
  applicationType: StateRevenueApplicationType;
  existingBusinessId?: string | null;
  businessName: string;
  ownerName?: string | null;
  contactEmail: string;
  contactPhone?: string | null;
  sector: string;
  businessType?: string | null;
  formalityStatus: "formal" | "informal" | "transitioning";
  cacNumber?: string | null;
  tin?: string | null;
  lgaName: string;
  town: string;
  community?: string | null;
  address: string;
  landmark?: string | null;
  locationType: string;
  businessActivity: string;
  operationCommencedOn?: string | null;
  evidenceTypes: string[];
  consentVersion: string;
  privacyNoticeVersion: string;
  declarationAccepted: boolean;
  locationConsentStatus: "not_requested" | "granted" | "denied" | "withdrawn";
};

export type OwnedStateRevenueBusiness = {
  id: string;
  msme_id: string | null;
  business_name: string | null;
  business_type: string | null;
  state: string | null;
  lga: string | null;
  sector: string | null;
  verification_status: string | null;
  state_revenue_jurisdiction_relationships?: Array<{ id: string; relationship_status: string | null; eligibility_status: string | null; jurisdiction_id: string | null }>;
};

export type StateRevenueDecisionAction =
  | "start_review"
  | "request_evidence"
  | "request_additional_information"
  | "flag_duplicate"
  | "request_field_verification"
  | "submit_field_verification"
  | "approve"
  | "reject"
  | "assign_reviewer"
  | "assign_field_officer";

const FINAL_STATUSES = new Set<StateRevenueApplicationStatus>(["approved", "rejected", "withdrawn", "no_longer_operating"]);
const REVIEW_ROLES = new Set(["state_revenue_executive", "state_revenue_admin", "registration_reviewer", "field_supervisor", "taxpayer_support_officer"]);
const READ_ROLES = new Set([...REVIEW_ROLES, "data_analyst", "auditor", "observer"]);
const FIELD_ROLES = new Set(["field_supervisor", "field_officer"]);
const APPROVAL_ROLES = new Set(["state_revenue_executive", "state_revenue_admin", "registration_reviewer"]);
export const STATE_REVENUE_EVIDENCE_BUCKET = "state-revenue-evidence";
export const STATE_REVENUE_EVIDENCE_MAX_FILE_SIZE = 10 * 1024 * 1024;
export const STATE_REVENUE_EVIDENCE_SIGNED_URL_SECONDS = 60 * 5;
export const STATE_REVENUE_EVIDENCE_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
export const STATE_REVENUE_EVIDENCE_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "webp"]);
const APPLICANT_EDITABLE_STATUSES = new Set<StateRevenueApplicationStatus>(["draft", "evidence_required", "additional_information_required"]);

const TRANSITIONS: Record<StateRevenueApplicationStatus, StateRevenueApplicationStatus[]> = {
  draft: ["submitted", "withdrawn"],
  submitted: ["under_review", "evidence_required", "duplicate_review_required", "field_verification_required", "approved", "rejected", "withdrawn"],
  contact_verification_required: ["submitted", "withdrawn"],
  jurisdiction_unverified: ["submitted", "evidence_required", "rejected", "withdrawn"],
  evidence_required: ["resubmitted", "rejected", "withdrawn"],
  duplicate_review_required: ["under_review", "approved", "rejected"],
  reviewer_assigned: ["under_review", "evidence_required", "field_verification_required", "approved", "rejected"],
  under_review: ["evidence_required", "duplicate_review_required", "field_verification_required", "approved", "rejected", "suspended"],
  field_verification_required: ["field_verification_assigned", "evidence_required", "rejected"],
  field_verification_assigned: ["field_verification_in_progress", "field_verification_submitted", "rejected"],
  field_verification_in_progress: ["field_verification_submitted", "field_verification_required"],
  field_verification_submitted: ["under_review", "approved", "rejected", "additional_information_required"],
  additional_information_required: ["resubmitted", "rejected", "withdrawn"],
  resubmitted: ["under_review", "evidence_required", "approved", "rejected"],
  approved: ["suspended"],
  rejected: [],
  withdrawn: [],
  suspended: ["under_review", "no_longer_operating"],
  no_longer_operating: [],
};

function clean(value: unknown, max = 240) {
  return String(value ?? "").normalize("NFKC").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function optional(value: unknown, max = 240) {
  const next = clean(value, max);
  return next || null;
}

function normalizeIdentifier(value: unknown) {
  return clean(value, 80).toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

function normalizeEmail(value: unknown) {
  return clean(value, 160).toLowerCase();
}

function extractExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function sanitizeEvidenceFileName(fileName: string) {
  return clean(fileName, 160).replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-") || "state-revenue-evidence";
}

function validateEvidenceFile(file: File | null) {
  if (!file || file.size <= 0) return { ok: false as const, message: "Choose an evidence file to upload." };
  if (file.size > STATE_REVENUE_EVIDENCE_MAX_FILE_SIZE) return { ok: false as const, message: "Evidence file must be 10MB or smaller." };
  const extension = extractExtension(file.name);
  const mimeType = (file.type || "").toLowerCase();
  if (!STATE_REVENUE_EVIDENCE_EXTENSIONS.has(extension) || !STATE_REVENUE_EVIDENCE_MIME_TYPES.has(mimeType)) {
    return { ok: false as const, message: "Evidence must be a PDF, JPG, JPEG, PNG, or WebP file." };
  }
  return { ok: true as const };
}

function normalizeBusinessName(value: string) {
  return clean(value, 160).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function cleanPostgrestSearch(value: unknown, max = 80) {
  return clean(value, max).replace(/[,%*_(){}[\]<>`"\\]/g, " ").replace(/\s+/g, " ").trim();
}

function ensureJurisdiction(jurisdictionId: StateRevenueJurisdictionId) {
  const jurisdiction = getStateRevenueJurisdiction(jurisdictionId);
  if (!jurisdiction) throw new Error("Unsupported state revenue jurisdiction.");
  return jurisdiction;
}

function nowIso() {
  return new Date().toISOString();
}

export function generateStateRevenueApplicationReference(jurisdiction: StateRevenueJurisdictionConfig) {
  return `${jurisdiction.acronym}-APP-${new Date().getUTCFullYear()}-${randomBytes(5).toString("hex").toUpperCase()}`;
}

function assertLga(jurisdiction: StateRevenueJurisdictionConfig, lgaName: string) {
  if (!jurisdiction.geography.constitutionalLgas.includes(lgaName)) {
    throw new Error("The selected LGA is not configured for this jurisdiction.");
  }
}

export function resolveEligibility(input: StateRevenueApplicationInput, jurisdiction: StateRevenueJurisdictionConfig) {
  const failures: string[] = [];
  if (!input.lgaName || !jurisdiction.geography.constitutionalLgas.includes(input.lgaName)) failures.push("configured_lga_required");
  if (!clean(input.address, 500)) failures.push("operating_address_required");
  if (!clean(input.town)) failures.push("town_or_community_required");
  if (!clean(input.businessActivity, 500)) failures.push("business_activity_required");
  if (!input.declarationAccepted) failures.push("declaration_required");
  if (!input.consentVersion || !input.privacyNoticeVersion) failures.push("consent_notice_required");
  if (input.evidenceTypes.length === 0) failures.push("supporting_evidence_required");
  return {
    eligible: failures.length === 0,
    status: failures.length === 0 ? "pending_review" : "incomplete",
    failures,
    verificationLevel: failures.length === 0 ? 1 : 0,
  };
}

async function getInstitutionId(client: Client, jurisdiction: StateRevenueJurisdictionConfig) {
  const { data, error } = await client.from("institutions").select("id").eq("slug", jurisdiction.institutionSlug).maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("State revenue institution is not configured.");
  return data.id as string;
}

async function assertOwnedExistingBusiness(client: Client, existingBusinessId: string | null | undefined, appUserId: string) {
  if (!existingBusinessId) return;
  const { data, error } = await client
    .from("msmes")
    .select("id,created_by")
    .eq("id", existingBusinessId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id || data.created_by !== appUserId) throw new Error("Selected business is not linked to your account.");
}

async function insertStatusHistory(client: Client, params: {
  applicationId: string;
  previousStatus?: string | null;
  newStatus: string;
  actorUserId?: string | null;
  reasonCode?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await client.from("state_revenue_application_status_history").insert({
    application_id: params.applicationId,
    previous_status: params.previousStatus ?? null,
    new_status: params.newStatus,
    actor_user_id: params.actorUserId ?? null,
    reason_code: params.reasonCode ?? null,
    notes: params.notes ?? null,
    metadata: params.metadata ?? {},
  });
  if (error) throw error;
}

async function insertNotification(client: Client, params: {
  applicationId: string;
  jurisdictionId: string;
  recipientUserId?: string | null;
  notificationType: string;
  title: string;
  body?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await client.from("state_revenue_notifications").insert({
    application_id: params.applicationId,
    jurisdiction_id: params.jurisdictionId,
    recipient_user_id: params.recipientUserId ?? null,
    notification_type: params.notificationType,
    title: params.title,
    body: params.body ?? null,
    metadata: { delivery_provider: "not_configured", ...(params.metadata ?? {}) },
  });
  if (error) throw error;
}

async function findIdentityCandidates(client: Client, input: StateRevenueApplicationInput) {
  const businessName = clean(input.businessName, 160);
  const normalizedName = normalizeBusinessName(businessName);
  const cac = normalizeIdentifier(input.cacNumber);
  const tin = normalizeIdentifier(input.tin);
  const email = normalizeEmail(input.contactEmail);
  const results = new Map<string, { row: any; signals: string[]; confidence: "low" | "medium" | "high" | "exact" }>();
  const register = (rows: any[] | null | undefined, signal: string, confidence: "low" | "medium" | "high" | "exact") => {
    for (const row of rows ?? []) {
      if (!row?.id) continue;
      const existing = results.get(row.id);
      if (existing) {
        existing.signals.push(signal);
        if (["exact", "high", "medium", "low"].indexOf(confidence) < ["exact", "high", "medium", "low"].indexOf(existing.confidence)) existing.confidence = confidence;
      } else {
        results.set(row.id, { row, signals: [signal], confidence });
      }
    }
  };

  if (input.existingBusinessId) {
    const { data } = await client.from("msmes").select("id,msme_id,business_name,cac_number,tin,contact_email,state,sector").eq("id", input.existingBusinessId).maybeSingle();
    if (data?.id) register([data], "selected_existing_business", "exact");
  }
  if (cac) {
    const { data } = await client.from("msmes").select("id,msme_id,business_name,cac_number,tin,contact_email,state,sector").eq("cac_number", cac).limit(5);
    register(data, "cac_number", "exact");
  }
  if (tin) {
    const { data } = await client.from("msmes").select("id,msme_id,business_name,cac_number,tin,contact_email,state,sector").eq("tin", tin).limit(5);
    register(data, "tin", "exact");
  }
  if (email) {
    const { data } = await client.from("msmes").select("id,msme_id,business_name,cac_number,tin,contact_email,state,sector").eq("contact_email", email).limit(5);
    register(data, "contact_email", "high");
  }
  if (normalizedName) {
    const { data } = await client.from("msmes").select("id,msme_id,business_name,cac_number,tin,contact_email,state,sector").ilike("business_name", `%${businessName.replace(/[%_]/g, "")}%`).limit(10);
    register(data, "business_name", "medium");
  }
  return [...results.values()];
}

function duplicateStatusForCandidates(candidates: Awaited<ReturnType<typeof findIdentityCandidates>>, applicationType: StateRevenueApplicationType): DuplicateStatus {
  if (!candidates.length) return "no_candidate";
  if (applicationType === "existing_business" && candidates.some((candidate) => candidate.signals.includes("selected_existing_business"))) return "resolved_existing_identity";
  if (candidates.some((candidate) => candidate.confidence === "exact")) return "strong_match";
  if (candidates.some((candidate) => candidate.confidence === "high")) return "possible_match";
  return "manual_review_required";
}

function assertTransition(from: StateRevenueApplicationStatus, to: StateRevenueApplicationStatus, override = false) {
  if (from === to) return;
  if (FINAL_STATUSES.has(from) && !override) throw new Error(`Application status ${from} is terminal.`);
  if (!TRANSITIONS[from]?.includes(to)) throw new Error(`Invalid state revenue transition ${from} to ${to}.`);
}

async function getReviewerRoles(input: { ctx: UserContext; client: Client; jurisdiction: StateRevenueJurisdictionConfig }) {
  if (!input.ctx.appUserId) return [];
  if (isPlatformAdmin(input.ctx.role)) return [input.ctx.role];
  const institutionId = await getInstitutionId(input.client, input.jurisdiction);
  const { data, error } = await input.client
    .from("role_assignments")
    .select("role,scope_type,scope_id,institution_id,status,expires_at")
    .eq("user_id", input.ctx.appUserId)
    .eq("status", "active");
  if (error) throw error;
  return (data ?? [])
    .filter((row) => !row.expires_at || new Date(row.expires_at).getTime() > Date.now())
    .filter((row) => row.scope_type === "global" || row.institution_id === institutionId || (row.scope_type === "institution" && row.institution_id === institutionId))
    .map((row) => row.role as string);
}

export async function requireStateRevenueApplicationAccess(input: {
  applicationId: string;
  ctx: UserContext;
  client: Client;
  mode?: "view" | "operate" | "approve" | "field";
}) {
  if (!input.ctx.appUserId) throw new Error("Authentication is required.");
  const detail = await getStateRevenueApplicationDetail(input.applicationId, input.client);
  if (!detail) throw new Error("Application not found.");
  const jurisdiction = ensureJurisdiction(detail.jurisdiction_id as StateRevenueJurisdictionId);
  const roles = await getReviewerRoles({ ctx: input.ctx, client: input.client, jurisdiction });
  const isOwner = detail.applicant_user_id === input.ctx.appUserId;
  const isAssignedReviewer = detail.assigned_reviewer_id === input.ctx.appUserId;
  const isAssignedFieldOfficer = detail.assigned_field_officer_id === input.ctx.appUserId || detail.tasks.some((task) => task.assigned_officer_id === input.ctx.appUserId);
  const canReadByRole = isPlatformAdmin(input.ctx.role) || roles.some((role) => READ_ROLES.has(role));
  const canOperateByRole = isPlatformAdmin(input.ctx.role) || roles.some((role) => REVIEW_ROLES.has(role));
  const canApproveByRole = isPlatformAdmin(input.ctx.role) || roles.some((role) => APPROVAL_ROLES.has(role));
  const canField = isPlatformAdmin(input.ctx.role) || roles.some((role) => FIELD_ROLES.has(role)) || isAssignedFieldOfficer;

  const mode = input.mode ?? "view";
  const allowed = mode === "view"
    ? isOwner || isAssignedReviewer || isAssignedFieldOfficer || canReadByRole
    : mode === "field"
      ? canField
      : mode === "approve"
        ? canApproveByRole
        : canOperateByRole || isAssignedReviewer;
  if (!allowed) throw new Error("You are not authorised for this application.");
  return { detail, roles, jurisdiction };
}

export async function createStateRevenueApplication(input: {
  data: StateRevenueApplicationInput;
  ctx?: UserContext | null;
  client?: Client;
  mode?: "draft" | "submit";
}) {
  const client = input.client ?? await createServiceRoleSupabaseClient();
  if (!input.ctx?.appUserId) throw new Error("Sign in is required to save or submit an application.");
  const appUserId = input.ctx.appUserId;
  const jurisdiction = ensureJurisdiction(input.data.jurisdictionId);
  await assertOwnedExistingBusiness(client, input.data.existingBusinessId, appUserId);
  const submitMode = input.mode !== "draft";
  if (submitMode) assertLga(jurisdiction, input.data.lgaName);
  const eligibility = resolveEligibility(input.data, jurisdiction);
  const candidates = submitMode ? await findIdentityCandidates(client, input.data) : [];
  const duplicateStatus = submitMode ? duplicateStatusForCandidates(candidates, input.data.applicationType) : "not_screened";
  const institutionId = await getInstitutionId(client, jurisdiction);
  const reference = generateStateRevenueApplicationReference(jurisdiction);
  const submitReady = submitMode && eligibility.eligible && duplicateStatus !== "strong_match";
  const status: StateRevenueApplicationStatus = !submitMode ? "draft" : submitReady ? "submitted" : duplicateStatus === "strong_match" ? "duplicate_review_required" : "evidence_required";
  const timestamp = nowIso();

  const { data: app, error } = await client
    .from("state_revenue_applications")
    .insert({
      application_reference: reference,
      jurisdiction_id: jurisdiction.jurisdictionId,
      institution_id: institutionId,
      applicant_user_id: appUserId,
      existing_business_id: input.data.existingBusinessId ?? null,
      proposed_business_name: clean(input.data.businessName, 160),
      owner_name: optional(input.data.ownerName, 160),
      contact_email: normalizeEmail(input.data.contactEmail),
      contact_phone: optional(input.data.contactPhone, 40),
      application_type: input.data.applicationType,
      current_status: status,
      eligibility_status: eligibility.status,
      verification_level: eligibility.verificationLevel,
      duplicate_status: duplicateStatus,
      sector: clean(input.data.sector, 120),
      business_type: optional(input.data.businessType, 120),
      formality_status: input.data.formalityStatus,
      cac_number: normalizeIdentifier(input.data.cacNumber) || null,
      tin: normalizeIdentifier(input.data.tin) || null,
      submitted_at: submitMode && (status === "submitted" || status === "duplicate_review_required" || status === "evidence_required") ? timestamp : null,
      classification: "uat",
      test_data: true,
      consent_version: input.data.consentVersion,
      privacy_notice_version: input.data.privacyNoticeVersion,
      declaration_accepted: input.data.declarationAccepted,
      location_consent_status: input.data.locationConsentStatus,
      metadata: { eligibility_failures: eligibility.failures, entrypoint: input.data.applicationType },
      created_by: appUserId,
      updated_by: appUserId,
    })
    .select("*")
    .single<StateRevenueApplication>();
  if (error || !app) throw error ?? new Error("Unable to create application.");

  const hasLocation = clean(input.data.lgaName) && clean(input.data.town) && clean(input.data.address, 500) && clean(input.data.businessActivity, 500);
  if (hasLocation) {
    assertLga(jurisdiction, input.data.lgaName);
    const { error: locationError } = await client.from("state_revenue_operating_locations").insert({
    application_id: app.id,
    business_id: input.data.existingBusinessId ?? null,
    jurisdiction_id: jurisdiction.jurisdictionId,
    state_code: jurisdiction.geography.stateCode,
    lga_name: input.data.lgaName,
    town: clean(input.data.town),
    community: optional(input.data.community),
    address: clean(input.data.address, 500),
    landmark: optional(input.data.landmark, 240),
    gps_consent_status: input.data.locationConsentStatus,
    location_type: input.data.locationType,
    business_activity: clean(input.data.businessActivity, 500),
    operation_commenced_on: optional(input.data.operationCommencedOn, 20),
    is_primary: true,
    status: submitMode ? "pending_review" : "pending_review",
    verification_status: input.data.evidenceTypes.length ? "evidence_submitted" : "self_declared",
    verification_level: eligibility.verificationLevel,
    classification: "uat",
    created_by: appUserId,
    updated_by: appUserId,
  });
    if (locationError) throw locationError;
  }

  if (input.data.evidenceTypes.length) {
    const { error: evidenceError } = await client.from("state_revenue_application_evidence").insert(input.data.evidenceTypes.slice(0, 6).map((evidenceType) => ({
      application_id: app.id,
      evidence_type: evidenceType,
      original_filename: `${evidenceType.replace(/_/g, "-")}-metadata`,
      evidence_status: "submitted",
      uploaded_by: appUserId,
      classification: "uat",
      metadata: { intake_mode: "metadata_only", secure_upload_required_before_live_operations: true },
    })));
    if (evidenceError) throw evidenceError;
  }

  for (const candidate of candidates) {
    const { error: resolutionError } = await client.from("state_revenue_identity_resolution_records").insert({
      application_id: app.id,
      candidate_business_id: candidate.row.id,
      match_signals: candidate.signals,
      confidence_category: candidate.confidence,
      resolution_status: duplicateStatus === "resolved_existing_identity" ? "resolved_existing_identity" : duplicateStatus === "strong_match" ? "strong_match" : "possible_match",
      resolved_business_id: duplicateStatus === "resolved_existing_identity" ? candidate.row.id : null,
      reason: "Server-side duplicate screening result.",
    });
    if (resolutionError) throw resolutionError;
  }

  await insertStatusHistory(client, {
    applicationId: app.id,
    newStatus: status,
    actorUserId: appUserId,
    reasonCode: "application_created",
    notes: "Application created through state revenue onboarding.",
    metadata: { duplicateStatus, eligibilityStatus: eligibility.status },
  });
  await insertNotification(client, {
    applicationId: app.id,
    jurisdictionId: jurisdiction.jurisdictionId,
    recipientUserId: appUserId,
    notificationType: submitMode ? "application_submitted" : "application_draft_saved",
    title: submitMode ? "Application received" : "Application draft saved",
    body: "Your application has been recorded. Notification delivery is not configured in Sprint 1.",
  });
  await recordTrustedStateRevenueEvent({
    actorUserId: appUserId,
    eventType: submitMode ? "state_revenue.application.submitted" : "state_revenue.application.draft_saved",
    entityType: "state_revenue_application",
    entityId: app.id,
    metadata: { jurisdictionId: jurisdiction.jurisdictionId, applicationReference: app.application_reference, status },
  });
  return app;
}

export async function listStateRevenueApplications(input: {
  jurisdictionId: StateRevenueJurisdictionId;
  ctx?: UserContext | null;
  filters?: { status?: string | null; lga?: string | null; q?: string | null };
  client?: Client;
}) {
  const client = input.client ?? await createServiceRoleSupabaseClient();
  const jurisdiction = ensureJurisdiction(input.jurisdictionId);
  let query = client
    .from("state_revenue_applications")
    .select("*,state_revenue_operating_locations(id,lga_name,town,address,location_type,business_activity,verification_status)")
    .eq("jurisdiction_id", jurisdiction.jurisdictionId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (input.ctx?.appUserId && input.ctx.role === "msme") query = query.eq("applicant_user_id", input.ctx.appUserId);
  if (input.filters?.status) query = query.eq("current_status", input.filters.status);
  if (input.filters?.q) {
    const q = cleanPostgrestSearch(input.filters.q, 80);
    if (q) query = query.or(`application_reference.ilike.%${q}%,proposed_business_name.ilike.%${q}%`);
  }
  const { data, error } = await query;
  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }
  let rows = (data ?? []) as Array<StateRevenueApplication & { state_revenue_operating_locations?: StateRevenueOperatingLocation[] }>;
  if (input.filters?.lga) {
    rows = rows.filter((row) => row.state_revenue_operating_locations?.some((location) => location.lga_name === input.filters?.lga));
  }
  return rows;
}

export async function getStateRevenueApplicationDetail(applicationId: string, client?: Client): Promise<StateRevenueApplicationDetail | null> {
  const supabase = client ?? await createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("state_revenue_applications")
    .select("*,state_revenue_operating_locations(*),state_revenue_application_evidence(*),state_revenue_verification_tasks(*),state_revenue_identity_resolution_records(*),state_revenue_application_status_history(*),msmes!state_revenue_applications_resolved_business_id_fkey(id,msme_id,business_name,state,sector)")
    .eq("id", applicationId)
    .maybeSingle();
  if (error) {
    if (error.code === "42P01") return null;
    throw error;
  }
  if (!data) return null;
  const row = data as any;
  return {
    ...(row as StateRevenueApplication),
    location: row.state_revenue_operating_locations?.[0] ?? null,
    evidence: row.state_revenue_application_evidence ?? [],
    tasks: row.state_revenue_verification_tasks ?? [],
    identityCandidates: row.state_revenue_identity_resolution_records ?? [],
    history: row.state_revenue_application_status_history ?? [],
    business: Array.isArray(row.msmes) ? row.msmes[0] ?? null : row.msmes ?? null,
  };
}

export async function getOwnedStateRevenueApplicationByReference(input: {
  reference: string;
  ctx: UserContext;
  client?: Client;
}) {
  if (!input.ctx.appUserId) throw new Error("Authentication is required.");
  const supabase = input.client ?? await createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("state_revenue_applications")
    .select("id")
    .eq("application_reference", normalizeIdentifier(input.reference))
    .eq("applicant_user_id", input.ctx.appUserId)
    .maybeSingle();
  if (error) {
    if (error.code === "42P01") return null;
    throw error;
  }
  return data?.id ? getStateRevenueApplicationDetail(data.id, supabase) : null;
}

export async function listOwnedStateRevenueBusinesses(input: {
  ctx: UserContext;
  jurisdictionId: StateRevenueJurisdictionId;
  client?: Client;
}) {
  if (!input.ctx.appUserId) return [];
  const supabase = input.client ?? await createServiceRoleSupabaseClient();
  const jurisdiction = ensureJurisdiction(input.jurisdictionId);
  const { data, error } = await supabase
    .from("msmes")
    .select("id,msme_id,business_name,business_type,state,lga,sector,verification_status,state_revenue_jurisdiction_relationships(id,jurisdiction_id,relationship_status,eligibility_status)")
    .eq("created_by", input.ctx.appUserId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    if (error.code === "42P01" || error.code === "42703" || error.code === "PGRST200") return [];
    throw error;
  }
  return ((data ?? []) as OwnedStateRevenueBusiness[]).map((business) => ({
    ...business,
    state_revenue_jurisdiction_relationships: business.state_revenue_jurisdiction_relationships?.filter((relationship) => relationship.jurisdiction_id === jurisdiction.jurisdictionId) ?? [],
  }));
}

async function upsertApplicationLocation(client: Client, detail: StateRevenueApplicationDetail, data: StateRevenueApplicationInput, actorUserId: string) {
  const jurisdiction = ensureJurisdiction(data.jurisdictionId);
  const hasLocation = clean(data.lgaName) && clean(data.town) && clean(data.address, 500) && clean(data.businessActivity, 500);
  if (!hasLocation) return;
  assertLga(jurisdiction, data.lgaName);
  const payload = {
    application_id: detail.id,
    business_id: data.existingBusinessId ?? detail.existing_business_id ?? null,
    jurisdiction_id: jurisdiction.jurisdictionId,
    state_code: jurisdiction.geography.stateCode,
    lga_name: data.lgaName,
    town: clean(data.town),
    community: optional(data.community),
    address: clean(data.address, 500),
    landmark: optional(data.landmark, 240),
    gps_consent_status: data.locationConsentStatus,
    location_type: data.locationType || "shop",
    business_activity: clean(data.businessActivity, 500),
    operation_commenced_on: optional(data.operationCommencedOn, 20),
    is_primary: true,
    status: "pending_review",
    verification_status: data.evidenceTypes.length ? "evidence_submitted" : "self_declared",
    verification_level: detail.verification_level,
    classification: detail.classification,
    updated_by: actorUserId,
  };
  const { error } = detail.location?.id
    ? await client.from("state_revenue_operating_locations").update(payload).eq("id", detail.location.id)
    : await client.from("state_revenue_operating_locations").insert({ ...payload, created_by: actorUserId });
  if (error) throw error;
}

export async function saveStateRevenueApplicationDraft(input: {
  applicationId?: string | null;
  data: StateRevenueApplicationInput;
  ctx: UserContext;
  client?: Client;
  submit?: boolean;
  applicantResponse?: string | null;
}) {
  if (!input.ctx.appUserId) throw new Error("Authentication is required.");
  const client = input.client ?? await createServiceRoleSupabaseClient();
  if (!input.applicationId) {
    return createStateRevenueApplication({ data: input.data, ctx: input.ctx, client, mode: input.submit ? "submit" : "draft" });
  }

  const detail = await getStateRevenueApplicationDetail(input.applicationId, client);
  if (!detail) throw new Error("Application not found.");
  if (detail.applicant_user_id !== input.ctx.appUserId) throw new Error("You cannot edit this application.");
  if (!APPLICANT_EDITABLE_STATUSES.has(detail.current_status)) throw new Error("This application can no longer be edited.");
  const jurisdiction = ensureJurisdiction(input.data.jurisdictionId);
  await assertOwnedExistingBusiness(client, input.data.existingBusinessId, input.ctx.appUserId);
  const candidates = input.submit ? await findIdentityCandidates(client, input.data) : [];
  const duplicateStatus = input.submit ? duplicateStatusForCandidates(candidates, input.data.applicationType) : detail.duplicate_status;
  const eligibility = resolveEligibility(input.data, jurisdiction);
  const nextStatus: StateRevenueApplicationStatus = input.submit
    ? detail.current_status === "additional_information_required" || detail.current_status === "evidence_required"
      ? "resubmitted"
      : eligibility.eligible && duplicateStatus !== "strong_match"
        ? "submitted"
        : duplicateStatus === "strong_match"
          ? "duplicate_review_required"
          : "evidence_required"
    : detail.current_status === "draft"
      ? "draft"
      : detail.current_status;
  assertTransition(detail.current_status, nextStatus, false);
  if (input.submit) assertLga(jurisdiction, input.data.lgaName);

  const timestamp = nowIso();
  const { data: updated, error } = await client
    .from("state_revenue_applications")
    .update({
      existing_business_id: input.data.existingBusinessId ?? null,
      proposed_business_name: clean(input.data.businessName, 160),
      owner_name: optional(input.data.ownerName, 160),
      contact_email: normalizeEmail(input.data.contactEmail),
      contact_phone: optional(input.data.contactPhone, 40),
      application_type: input.data.applicationType,
      current_status: nextStatus,
      eligibility_status: input.submit ? eligibility.status : "not_started",
      verification_level: eligibility.verificationLevel,
      duplicate_status: duplicateStatus,
      sector: clean(input.data.sector, 120),
      business_type: optional(input.data.businessType, 120),
      formality_status: input.data.formalityStatus,
      cac_number: normalizeIdentifier(input.data.cacNumber) || null,
      tin: normalizeIdentifier(input.data.tin) || null,
      submitted_at: input.submit ? timestamp : detail.submitted_at,
      latest_applicant_response: input.applicantResponse ? clean(input.applicantResponse, 2000) : detail.latest_applicant_response,
      resubmitted_at: nextStatus === "resubmitted" ? timestamp : detail.resubmitted_at,
      resubmission_count: nextStatus === "resubmitted" ? detail.resubmission_count + 1 : detail.resubmission_count,
      declaration_accepted: input.data.declarationAccepted,
      location_consent_status: input.data.locationConsentStatus,
      metadata: { ...(detail.metadata ?? {}), eligibility_failures: eligibility.failures, last_applicant_save_mode: input.submit ? "submit" : "draft" },
      updated_by: input.ctx.appUserId,
    })
    .eq("id", detail.id)
    .select("*")
    .single<StateRevenueApplication>();
  if (error || !updated) throw error ?? new Error("Unable to save application.");
  await upsertApplicationLocation(client, detail, input.data, input.ctx.appUserId);
  if (input.submit) {
    for (const candidate of candidates) {
      const { error: resolutionError } = await client.from("state_revenue_identity_resolution_records").insert({
        application_id: detail.id,
        candidate_business_id: candidate.row.id,
        match_signals: candidate.signals,
        confidence_category: candidate.confidence,
        resolution_status: duplicateStatus === "resolved_existing_identity" ? "resolved_existing_identity" : duplicateStatus === "strong_match" ? "strong_match" : "possible_match",
        resolved_business_id: duplicateStatus === "resolved_existing_identity" ? candidate.row.id : null,
        reason: "Server-side duplicate screening result during applicant resubmission.",
      });
      if (resolutionError && resolutionError.code !== "23505") throw resolutionError;
    }
  }
  await insertStatusHistory(client, {
    applicationId: detail.id,
    previousStatus: detail.current_status,
    newStatus: nextStatus,
    actorUserId: input.ctx.appUserId,
    reasonCode: input.submit ? "applicant_submitted" : "draft_saved",
    notes: input.applicantResponse ?? (input.submit ? "Applicant submitted application." : "Applicant saved draft."),
    metadata: { duplicateStatus, eligibilityStatus: eligibility.status },
  });
  await recordTrustedStateRevenueEvent({
    actorUserId: input.ctx.appUserId,
    eventType: input.submit ? "state_revenue.application.resubmitted" : "state_revenue.application.draft_saved",
    entityType: "state_revenue_application",
    entityId: detail.id,
    metadata: { jurisdictionId: jurisdiction.jurisdictionId, applicationReference: detail.application_reference, status: nextStatus },
  });
  return updated;
}

export async function uploadStateRevenueApplicationEvidence(input: {
  applicationId: string;
  evidenceType: string;
  file: File;
  ctx: UserContext;
  replacementForEvidenceId?: string | null;
  client?: Client;
}) {
  if (!input.ctx.appUserId) throw new Error("Authentication is required.");
  const validation = validateEvidenceFile(input.file);
  if (!validation.ok) throw new Error(validation.message);
  const client = input.client ?? await createServiceRoleSupabaseClient();
  const detail = await getStateRevenueApplicationDetail(input.applicationId, client);
  if (!detail) throw new Error("Application not found.");
  if (detail.applicant_user_id !== input.ctx.appUserId) throw new Error("You cannot upload evidence for this application.");
  if (!APPLICANT_EDITABLE_STATUSES.has(detail.current_status)) throw new Error("Evidence can only be changed while the application is editable.");
  if (input.replacementForEvidenceId) {
    const { data: replacementTarget, error: replacementError } = await client
      .from("state_revenue_application_evidence")
      .select("id,evidence_status")
      .eq("id", input.replacementForEvidenceId)
      .eq("application_id", detail.id)
      .maybeSingle<{ id: string; evidence_status: string }>();
    if (replacementError) throw replacementError;
    if (!replacementTarget || replacementTarget.evidence_status !== "replacement_requested") {
      throw new Error("Evidence replacement is available only after a reviewer requests replacement.");
    }
  }
  const jurisdiction = ensureJurisdiction(detail.jurisdiction_id as StateRevenueJurisdictionId);
  const extension = extractExtension(input.file.name);
  const safeName = sanitizeEvidenceFileName(input.file.name);
  const evidenceId = randomUUID();
  const storagePath = `${jurisdiction.jurisdictionId}/${detail.id}/${evidenceId}.${extension}`;
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const { error: uploadError } = await client.storage
    .from(STATE_REVENUE_EVIDENCE_BUCKET)
    .upload(storagePath, buffer, { contentType: input.file.type, upsert: false });
  if (uploadError) throw uploadError;
  const { data, error } = await client
    .from("state_revenue_application_evidence")
    .insert({
      id: evidenceId,
      application_id: detail.id,
      evidence_type: clean(input.evidenceType, 80),
      storage_bucket: STATE_REVENUE_EVIDENCE_BUCKET,
      storage_path: storagePath,
      original_filename: input.file.name,
      safe_filename: safeName,
      mime_type: input.file.type,
      file_size_bytes: input.file.size,
      checksum_sha256: checksum,
      evidence_status: "submitted",
      replacement_for_evidence_id: input.replacementForEvidenceId ?? null,
      uploaded_by: input.ctx.appUserId,
      classification: detail.classification,
      metadata: { upload_mode: "server_action", malware_scan_status: "not_configured" },
    })
    .select("*")
    .single<StateRevenueEvidence>();
  if (error || !data) {
    await client.storage.from(STATE_REVENUE_EVIDENCE_BUCKET).remove([storagePath]);
    throw error ?? new Error("Unable to record evidence metadata.");
  }
  if (input.replacementForEvidenceId) {
    await client.from("state_revenue_application_evidence").update({ evidence_status: "superseded" }).eq("id", input.replacementForEvidenceId).eq("application_id", detail.id);
  }
  await insertStatusHistory(client, {
    applicationId: detail.id,
    previousStatus: detail.current_status,
    newStatus: detail.current_status,
    actorUserId: input.ctx.appUserId,
    reasonCode: "evidence_uploaded",
    notes: "Applicant uploaded evidence.",
    metadata: { evidenceType: input.evidenceType, evidenceId },
  });
  await recordTrustedStateRevenueEvent({
    actorUserId: input.ctx.appUserId,
    eventType: "state_revenue.evidence.uploaded",
    entityType: "state_revenue_application_evidence",
    entityId: evidenceId,
    metadata: { jurisdictionId: jurisdiction.jurisdictionId, applicationReference: detail.application_reference, evidenceType: input.evidenceType, mimeType: input.file.type, fileSizeBytes: input.file.size },
  });
  return data;
}

export async function getStateRevenueEvidenceForAccess(input: {
  evidenceId: string;
  ctx: UserContext;
  client?: Client;
}) {
  if (!input.ctx.appUserId) throw new Error("Authentication is required.");
  const client = input.client ?? await createServiceRoleSupabaseClient();
  const { data, error } = await client
    .from("state_revenue_application_evidence")
    .select("*,state_revenue_applications(id,jurisdiction_id,applicant_user_id,assigned_reviewer_id,assigned_field_officer_id)")
    .eq("id", input.evidenceId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const app = (data as any).state_revenue_applications;
  if (!app?.id) return null;
  await requireStateRevenueApplicationAccess({ applicationId: app.id, ctx: input.ctx, client, mode: "view" });
  return data as StateRevenueEvidence & { state_revenue_applications?: { id: string; jurisdiction_id: string } };
}

export async function reviewStateRevenueApplicationEvidence(input: {
  evidenceId: string;
  status: "under_review" | "accepted" | "rejected" | "replacement_requested";
  note?: string | null;
  ctx: UserContext;
  client?: Client;
}) {
  if (!input.ctx.appUserId) throw new Error("Authentication is required.");
  const client = input.client ?? await createServiceRoleSupabaseClient();
  const evidence = await getStateRevenueEvidenceForAccess({ evidenceId: input.evidenceId, ctx: input.ctx, client });
  if (!evidence?.application_id) throw new Error("Evidence was not found.");
  const { detail, jurisdiction } = await requireStateRevenueApplicationAccess({ applicationId: evidence.application_id, ctx: input.ctx, client, mode: "operate" });
  if (!["submitted", "under_review", "replacement_requested"].includes(evidence.evidence_status)) {
    throw new Error("This evidence is not in a reviewable state.");
  }
  if (input.status === "accepted" && !evidence.storage_path) {
    throw new Error("Uploaded evidence is required before evidence can be accepted.");
  }
  const { data, error } = await client
    .from("state_revenue_application_evidence")
    .update({
      evidence_status: input.status,
      reviewed_by: input.ctx.appUserId,
      reviewed_at: nowIso(),
      rejection_reason: input.status === "rejected" || input.status === "replacement_requested" ? input.note ?? null : null,
    })
    .eq("id", input.evidenceId)
    .eq("application_id", evidence.application_id)
    .select("*")
    .single<StateRevenueEvidence>();
  if (error || !data) throw error ?? new Error("Unable to review evidence.");
  await insertStatusHistory(client, {
    applicationId: detail.id,
    previousStatus: detail.current_status,
    newStatus: detail.current_status,
    actorUserId: input.ctx.appUserId,
    reasonCode: `evidence_${input.status}`,
    notes: input.note,
    metadata: { evidenceId: input.evidenceId, evidenceStatus: input.status },
  });
  await recordTrustedStateRevenueEvent({
    actorUserId: input.ctx.appUserId,
    eventType: `state_revenue.evidence.${input.status}`,
    entityType: "state_revenue_application_evidence",
    entityId: input.evidenceId,
    metadata: { jurisdictionId: jurisdiction.jurisdictionId, applicationReference: detail.application_reference, status: input.status },
  });
  return data;
}

export async function lookupStateRevenueApplicationStatus(input: {
  reference: string;
  email: string;
  jurisdictionId: StateRevenueJurisdictionId;
  client?: Client;
}) {
  const client = input.client ?? await createServiceRoleSupabaseClient();
  const jurisdiction = ensureJurisdiction(input.jurisdictionId);
  const { data, error } = await client
    .from("state_revenue_applications")
    .select("id,application_reference,current_status,eligibility_status,duplicate_status,verification_level,proposed_business_name,submitted_at,approved_at,rejected_at,decision_notes")
    .eq("jurisdiction_id", jurisdiction.jurisdictionId)
    .eq("application_reference", normalizeIdentifier(input.reference))
    .eq("contact_email", normalizeEmail(input.email))
    .maybeSingle();
  if (error) {
    if (error.code === "42P01") return null;
    throw error;
  }
  return data;
}

function patchForDecision(action: StateRevenueDecisionAction, detail: StateRevenueApplicationDetail, actorUserId: string, form: Record<string, string | null>) {
  const timestamp = nowIso();
  const patch: Record<string, unknown> = { updated_by: actorUserId };
  let target: StateRevenueApplicationStatus | null = null;
  if (action === "start_review") target = "under_review";
  if (action === "request_evidence") target = "evidence_required";
  if (action === "request_additional_information") target = "additional_information_required";
  if (action === "flag_duplicate") target = "duplicate_review_required";
  if (action === "request_field_verification") target = "field_verification_required";
  if (action === "submit_field_verification") target = "field_verification_submitted";
  if (action === "approve") target = "approved";
  if (action === "reject") target = "rejected";
  if (action === "assign_reviewer") {
    patch.assigned_reviewer_id = form.assignedReviewerId;
    target = detail.current_status === "submitted" ? "reviewer_assigned" : detail.current_status;
  }
  if (action === "assign_field_officer") {
    patch.assigned_field_officer_id = form.assignedFieldOfficerId;
    target = detail.current_status === "field_verification_required" ? "field_verification_assigned" : detail.current_status;
  }
  if (!target) throw new Error("Unsupported decision action.");
  assertTransition(detail.current_status, target, action === "approve" || action === "reject");
  patch.current_status = target;
  patch.reviewed_at = timestamp;
  patch.decision_notes = form.notes;
  if (target === "approved") patch.approved_at = timestamp;
  if (target === "rejected") {
    patch.rejected_at = timestamp;
    patch.rejection_reason_code = form.reasonCode ?? "not_eligible";
  }
  if (target === "evidence_required") patch.eligibility_status = "incomplete";
  if (target === "additional_information_required") {
    patch.eligibility_status = "incomplete";
    patch.additional_information_request = {
      requested_at: timestamp,
      requested_by: actorUserId,
      sections: form.sections ?? null,
      evidence_ids: form.evidenceIds ?? null,
      notes: form.notes ?? null,
      reason_code: form.reasonCode ?? "additional_information_required",
    };
    patch.additional_information_due_at = form.dueAt;
  }
  if (target === "duplicate_review_required") patch.duplicate_status = "manual_review_required";
  if (target === "field_verification_required") patch.eligibility_status = "requires_field_verification";
  return { patch, target };
}

async function createOrLinkIdentity(input: {
  client: Client;
  detail: StateRevenueApplicationDetail;
  jurisdiction: StateRevenueJurisdictionConfig;
  actor: Pick<UserContext, "appUserId" | "role">;
}) {
  if (input.detail.resolved_business_id) return input.detail.resolved_business_id;
  const selectedCandidate = input.detail.identityCandidates.find((candidate) => candidate.resolution_status === "resolved_existing_identity" && candidate.candidate_business_id);
  const existingBusinessId = input.detail.existing_business_id ?? selectedCandidate?.candidate_business_id ?? null;
  if (existingBusinessId) return existingBusinessId;

  if (input.detail.duplicate_status === "strong_match" || input.detail.duplicate_status === "manual_review_required") {
    throw new Error("Duplicate review must be resolved before approval.");
  }

  const generated = generateMsmeId(input.jurisdiction.geography.stateCode);
  const { data, error } = await input.client
    .from("msmes")
    .insert({
      msme_id: generated,
      business_name: input.detail.proposed_business_name,
      owner_name: input.detail.owner_name ?? input.detail.proposed_business_name ?? "Business owner",
      state: input.jurisdiction.geography.state,
      lga: input.detail.location?.lga_name ?? null,
      address: input.detail.location?.address ?? null,
      sector: input.detail.sector ?? "Services",
      business_type: input.detail.business_type ?? input.detail.formality_status,
      cac_number: input.detail.cac_number,
      tin: input.detail.tin,
      contact_email: input.detail.contact_email,
      contact_phone: input.detail.contact_phone,
      verification_status: "verified",
      review_status: "approved",
      created_by: input.detail.applicant_user_id,
    })
    .select("id,msme_id")
    .single();
  if (error || !data?.id) throw error ?? new Error("Unable to create canonical business identity.");
  await approveCredential(input.client, {
    msmeId: data.id,
    ndmiiId: data.msme_id,
    validationSnapshot: {
      source: "state_revenue_sprint1",
      jurisdiction: input.jurisdiction.jurisdictionId,
      applicationReference: input.detail.application_reference,
      verificationLevel: 2,
    },
    actor: input.actor,
  });
  return data.id as string;
}

export async function reviewStateRevenueApplication(input: {
  applicationId: string;
  action: StateRevenueDecisionAction;
  ctx: UserContext;
  form?: Record<string, string | null>;
  client?: Client;
}) {
  const client = input.client ?? await createServiceRoleSupabaseClient();
  const mode = input.action === "approve" || input.action === "reject" ? "approve" : input.action === "assign_field_officer" || input.action === "submit_field_verification" ? "field" : "operate";
  const { detail, jurisdiction } = await requireStateRevenueApplicationAccess({ applicationId: input.applicationId, ctx: input.ctx, client, mode });
  if (!input.ctx.appUserId) throw new Error("Authentication is required.");
  if ((input.action === "approve" || input.action === "reject") && detail.applicant_user_id === input.ctx.appUserId) {
    throw new Error("Applicants cannot review their own applications.");
  }
  if (input.action === "approve" && detail.current_status === "approved") {
    throw new Error("Application is already approved.");
  }
  const form = input.form ?? {};
  const { patch, target } = patchForDecision(input.action, detail, input.ctx.appUserId, form);

  let resolvedBusinessId = detail.resolved_business_id;
  if (input.action === "approve") {
    if (!detail.declaration_accepted) throw new Error("Applicant declaration is required before approval.");
    if (!detail.location || !jurisdiction.geography.constitutionalLgas.includes(detail.location.lga_name)) {
      throw new Error("A configured operating location is required before approval.");
    }
    if (!detail.evidence.some((evidence) => evidence.evidence_status === "accepted" && evidence.storage_path)) {
      throw new Error("Accepted uploaded operating-presence evidence is required before approval.");
    }
    resolvedBusinessId = await createOrLinkIdentity({ client, detail, jurisdiction, actor: { appUserId: input.ctx.appUserId, role: input.ctx.role } });
    patch.resolved_business_id = resolvedBusinessId;
    patch.eligibility_status = "eligible";
    patch.verification_level = Math.max(detail.verification_level, 2);
    patch.duplicate_status = detail.existing_business_id ? "resolved_existing_identity" : detail.duplicate_status === "not_screened" ? "no_candidate" : detail.duplicate_status;
  }

  const { data: updated, error } = await client
    .from("state_revenue_applications")
    .update(patch)
    .eq("id", detail.id)
    .select("*")
    .single<StateRevenueApplication>();
  if (error || !updated) throw error ?? new Error("Unable to update state revenue application.");

  if (input.action === "assign_field_officer" && form.assignedFieldOfficerId) {
    const { error: taskError } = await client.from("state_revenue_verification_tasks").insert({
      application_id: detail.id,
      operating_location_id: detail.location?.id ?? null,
      verification_type: "operating_location",
      assigned_officer_id: form.assignedFieldOfficerId,
      assigned_supervisor_id: input.ctx.appUserId,
      status: "assigned",
      created_by: input.ctx.appUserId,
      updated_by: input.ctx.appUserId,
      metadata: { assignment_notes: form.notes ?? null },
    });
    if (taskError) throw taskError;
  }

  if (input.action === "submit_field_verification") {
    const task = detail.tasks.find((candidate) => candidate.assigned_officer_id === input.ctx.appUserId && ["assigned", "in_progress"].includes(candidate.status))
      ?? detail.tasks.find((candidate) => candidate.assigned_officer_id === input.ctx.appUserId);
    if (!task && !isPlatformAdmin(input.ctx.role)) throw new Error("No assigned field-verification task was found for the current officer.");
    if (task) {
      const { error: taskError } = await client.from("state_revenue_verification_tasks").update({
        status: "submitted",
        outcome: form.reasonCode ?? "operating_location_confirmed",
        completed_at: nowIso(),
        updated_by: input.ctx.appUserId,
        notes: form.notes,
        metadata: { field_submission_mode: "workspace", submitted_by: input.ctx.appUserId },
      }).eq("id", task.id);
      if (taskError) throw taskError;
    }
  }

  if (input.action === "approve" && resolvedBusinessId) {
    const { data: location } = await client
      .from("state_revenue_operating_locations")
      .update({
        business_id: resolvedBusinessId,
        status: "active",
        verification_status: "field_verified",
        verification_level: 2,
        verified_at: nowIso(),
        verified_by: input.ctx.appUserId,
        updated_by: input.ctx.appUserId,
      })
      .eq("application_id", detail.id)
      .select("id")
      .limit(1)
      .maybeSingle();
    const relationshipPayload = {
      jurisdiction_id: jurisdiction.jurisdictionId,
      institution_id: detail.institution_id,
      business_id: resolvedBusinessId,
      operating_location_id: location?.id ?? null,
      application_id: detail.id,
      relationship_status: "active",
      entry_pathway: detail.application_type,
      eligibility_status: "eligible",
      approved_at: nowIso(),
      approved_by: input.ctx.appUserId,
      compliance_readiness_status: "not_started",
      programme_status: "active",
      classification: "uat",
    };
    let relationshipQuery = client
      .from("state_revenue_jurisdiction_relationships")
      .select("id")
      .eq("jurisdiction_id", jurisdiction.jurisdictionId)
      .eq("business_id", resolvedBusinessId);
    relationshipQuery = location?.id ? relationshipQuery.eq("operating_location_id", location.id) : relationshipQuery.is("operating_location_id", null);
    const { data: existingRelationship, error: existingRelationshipError } = await relationshipQuery.maybeSingle();
    if (existingRelationshipError) throw existingRelationshipError;
    const { error: relationshipError } = existingRelationship?.id
      ? await client.from("state_revenue_jurisdiction_relationships").update(relationshipPayload).eq("id", existingRelationship.id)
      : await client.from("state_revenue_jurisdiction_relationships").insert(relationshipPayload);
    if (relationshipError) throw relationshipError;
  }

  await insertStatusHistory(client, {
    applicationId: detail.id,
    previousStatus: detail.current_status,
    newStatus: target,
    actorUserId: input.ctx.appUserId,
    reasonCode: form.reasonCode ?? input.action,
    notes: form.notes,
  });
  await insertNotification(client, {
    applicationId: detail.id,
    jurisdictionId: jurisdiction.jurisdictionId,
    recipientUserId: detail.applicant_user_id,
    notificationType: `application_${target}`,
    title: `Application ${target.replace(/_/g, " ")}`,
    body: "A state revenue application status changed. Delivery channels remain not configured in Sprint 1.",
  });
  await recordTrustedStateRevenueEvent({
    actorUserId: input.ctx.appUserId,
    eventType: input.action === "approve" ? "state_revenue.application.approved" : input.action === "reject" ? "state_revenue.application.rejected" : `state_revenue.review.${input.action}`,
    entityType: "state_revenue_application",
    entityId: detail.id,
    metadata: { jurisdictionId: jurisdiction.jurisdictionId, previousStatus: detail.current_status, newStatus: target },
  });
  return updated;
}

export function getApplicationMetrics(rows: Array<StateRevenueApplication & { state_revenue_operating_locations?: StateRevenueOperatingLocation[] }>) {
  const byStatus = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.current_status] = (acc[row.current_status] ?? 0) + 1;
    return acc;
  }, {});
  return {
    total: rows.length,
    submitted: byStatus.submitted ?? 0,
    underReview: (byStatus.under_review ?? 0) + (byStatus.reviewer_assigned ?? 0),
    evidenceRequired: (byStatus.evidence_required ?? 0) + (byStatus.additional_information_required ?? 0),
    duplicateReview: byStatus.duplicate_review_required ?? 0,
    fieldVerification: (byStatus.field_verification_required ?? 0) + (byStatus.field_verification_assigned ?? 0) + (byStatus.field_verification_in_progress ?? 0),
    approved: byStatus.approved ?? 0,
    rejected: byStatus.rejected ?? 0,
    withdrawn: byStatus.withdrawn ?? 0,
  };
}
