import { createHash, randomUUID } from "crypto";
import type { UserContext } from "@/lib/auth/authorization";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const IMPACT_EVIDENCE_BUCKET = "impact-evidence";
export const IMPACT_EVIDENCE_MAX_FILE_SIZE = 10 * 1024 * 1024;
export const IMPACT_EVIDENCE_SIGNED_URL_SECONDS = 60 * 5;
export const IMPACT_EVIDENCE_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
export const IMPACT_EVIDENCE_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "webp"]);
export const IMPACT_EVIDENCE_STATUSES = ["draft", "uploaded", "submitted", "under_review", "verified", "rejected", "returned", "archived"] as const;
export const IMPACT_EVIDENCE_CREATE_ROLES = ["admin", "super_admin", "programme_officer", "assessment_officer", "field_officer"] as const;
export const IMPACT_EVIDENCE_REVIEW_ROLES = ["admin", "super_admin", "assessment_officer"] as const;
export const IMPACT_EVIDENCE_READ_ROLES = ["admin", "super_admin", "boi_executive", "programme_officer", "assessment_officer", "field_officer", "auditor"] as const;

export type ImpactEvidenceStatus = (typeof IMPACT_EVIDENCE_STATUSES)[number];

export type ImpactEvidenceRecord = {
  id: string;
  programme_id: string | null;
  cohort_id: string | null;
  cohort_member_id: string | null;
  intervention_id: string | null;
  assessment_id: string | null;
  field_visit_id: string | null;
  msme_id: string | null;
  file_name: string;
  file_url: string | null;
  file_type: string | null;
  evidence_type: string;
  evidence_category: string | null;
  verification_status: string;
  status: ImpactEvidenceStatus | string;
  description: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  original_filename: string | null;
  stored_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  checksum_sha256: string | null;
  captured_at: string | null;
  uploaded_at: string | null;
  uploaded_by_user_id: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by_user_id: string | null;
  review_decision: string | null;
  review_note: string | null;
  returned_at: string | null;
  returned_by_user_id: string | null;
  return_reason: string | null;
  archived_at: string | null;
  archived_by_user_id: string | null;
  created_at: string | null;
  metadata: Record<string, unknown> | null;
  impact_programmes?: { id: string; name: string | null; programme_code: string | null } | null;
  impact_beneficiary_cohorts?: { id: string; name: string | null; programme_id: string } | null;
  impact_cohort_members?: { id: string; member_status: string; msme_id: string } | null;
  impact_interventions?: { id: string; title: string | null } | null;
  impact_assessments?: { id: string; title: string | null; assessment_type: string | null } | null;
  impact_field_visits?: { id: string; title: string | null; status: string | null } | null;
  msmes?: { id: string; business_name: string | null; msme_id: string | null; state: string | null; sector: string | null } | null;
  uploaded_by?: { id: string; full_name: string | null; email: string | null; role: string | null } | null;
  reviewed_by?: { id: string; full_name: string | null; email: string | null; role: string | null } | null;
};

export type ImpactEvidenceEvent = {
  id: string;
  evidence_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  actor_user_id: string | null;
  actor_role: string | null;
  note: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type EvidenceQueryOptions = {
  limit?: number;
  programmeId?: string | null;
  cohortId?: string | null;
  cohortMemberId?: string | null;
  interventionId?: string | null;
  assessmentId?: string | null;
  fieldVisitId?: string | null;
};

export type ImpactEvidenceUploadOptions = {
  programmes: Array<{ id: string; name: string; programme_code: string | null }>;
  cohorts: Array<{ id: string; programme_id: string; name: string; current_beneficiaries: number }>;
  members: Array<{
    id: string;
    cohort_id: string;
    programme_id: string;
    msme_id: string;
    member_status: string;
    msmes: { id: string; business_name: string | null; msme_id: string | null } | null;
  }>;
  interventions: Array<{ id: string; programme_id: string; cohort_id: string; cohort_member_id: string; msme_id: string; title: string }>;
  assessments: Array<{ id: string; programme_id: string; cohort_id: string; cohort_member_id: string; intervention_id: string | null; msme_id: string; title: string | null; assessment_type: string | null }>;
  visits: Array<{ id: string; programme_id: string; cohort_id: string; cohort_member_id: string; intervention_id: string | null; assessment_id: string | null; msme_id: string; title: string | null; status: string | null }>;
};

type EvidenceContext = {
  programmeId: string;
  cohortId: string;
  cohortMemberId: string;
  msmeId: string;
  interventionId: string | null;
  assessmentId: string | null;
  fieldVisitId: string | null;
};

export const IMPACT_EVIDENCE_SELECT =
  "id,programme_id,cohort_id,cohort_member_id,intervention_id,assessment_id,field_visit_id,msme_id,file_name,file_url,file_type,evidence_type,evidence_category,verification_status,status,description,storage_bucket,storage_path,original_filename,stored_filename,mime_type,file_size_bytes,checksum_sha256,captured_at,uploaded_at,uploaded_by_user_id,submitted_at,reviewed_at,reviewed_by_user_id,review_decision,review_note,returned_at,returned_by_user_id,return_reason,archived_at,archived_by_user_id,created_at,metadata,impact_programmes(id,name,programme_code),impact_beneficiary_cohorts(id,name,programme_id),impact_cohort_members(id,member_status,msme_id),impact_interventions(id,title),impact_assessments(id,title,assessment_type),impact_field_visits(id,title,status),msmes(id,business_name,msme_id,state,sector),uploaded_by:users!impact_evidence_files_uploaded_by_user_id_fkey(id,full_name,email,role),reviewed_by:users!impact_evidence_files_reviewed_by_user_id_fkey(id,full_name,email,role)";

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

export function mapImpactEvidenceRow(row: unknown): ImpactEvidenceRecord {
  const value = (row ?? {}) as Record<string, unknown>;
  return {
    ...(value as unknown as ImpactEvidenceRecord),
    original_filename: nullableString(value.original_filename),
    storage_bucket: nullableString(value.storage_bucket),
    storage_path: nullableString(value.storage_path),
    mime_type: nullableString(value.mime_type),
    file_size_bytes: typeof value.file_size_bytes === "number" ? value.file_size_bytes : null,
    checksum_sha256: nullableString(value.checksum_sha256),
    uploaded_at: nullableString(value.uploaded_at),
    submitted_at: nullableString(value.submitted_at),
    reviewed_at: nullableString(value.reviewed_at),
    archived_at: nullableString(value.archived_at),
  };
}

export function mapImpactEvidenceRows(rows: unknown[] | null | undefined) {
  return (rows ?? []).map(mapImpactEvidenceRow);
}

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeError(error: unknown) {
  if (!error || typeof error !== "object") return { code: null, message: String(error ?? "unknown_error") };
  const value = error as { code?: unknown; message?: unknown; name?: unknown };
  return {
    code: typeof value.code === "string" ? value.code : typeof value.name === "string" ? value.name : null,
    message: typeof value.message === "string" ? value.message : "unknown_error",
  };
}

export function logImpactEvidenceDiagnostic(payload: {
  operation: string;
  evidenceId?: string | null;
  programmeId?: string | null;
  cohortId?: string | null;
  fieldVisitId?: string | null;
  actorRole?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  success?: boolean;
  errorCode?: string | null;
  errorMessage?: string | null;
}) {
  console.info("[impact-evidence]", payload);
}

function requireRole(ctx: UserContext, roles: readonly string[], message: string) {
  if (!ctx.appUserId || !roles.includes(ctx.role)) throw new Error(message);
}

function extractExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function sanitizeImpactEvidenceFileName(fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 140);
  return safeName || "impact-evidence";
}

export function validateImpactEvidenceFile(file: File | null) {
  if (!file || file.size <= 0) return { ok: false as const, message: "Choose an evidence file to upload." };
  if (file.size > IMPACT_EVIDENCE_MAX_FILE_SIZE) return { ok: false as const, message: "Evidence file must be 10MB or smaller." };
  const extension = extractExtension(file.name);
  const mimeType = (file.type || "").toLowerCase();
  if (!IMPACT_EVIDENCE_EXTENSIONS.has(extension) || !IMPACT_EVIDENCE_MIME_TYPES.has(mimeType)) {
    return { ok: false as const, message: "Evidence must be a PDF, JPG, JPEG, PNG, or WebP file." };
  }
  return { ok: true as const };
}

async function ensureImpactEvidenceBucket() {
  const supabase = await createServiceRoleSupabaseClient();
  const { data } = await supabase.storage.getBucket(IMPACT_EVIDENCE_BUCKET);
  if (data) return supabase;
  const { error } = await supabase.storage.createBucket(IMPACT_EVIDENCE_BUCKET, {
    public: false,
    fileSizeLimit: `${IMPACT_EVIDENCE_MAX_FILE_SIZE}`,
    allowedMimeTypes: Array.from(IMPACT_EVIDENCE_MIME_TYPES),
  });
  if (error) throw new Error("Impact evidence storage is unavailable.");
  return supabase;
}

async function getFieldOfficerScope(ctx: UserContext) {
  if (ctx.role !== "field_officer" || !ctx.appUserId) return { visitIds: [] as string[], memberIds: [] as string[] };
  const supabase = await createServiceRoleSupabaseClient();
  const [{ data: visits, error: visitError }, { data: members, error: memberError }] = await Promise.all([
    supabase.from("impact_field_visits").select("id").eq("assigned_to_user_id", ctx.appUserId),
    supabase.from("impact_cohort_members").select("id").eq("assigned_to_user_id", ctx.appUserId),
  ]);
  if (visitError || memberError) throw new Error("Assigned evidence scope is temporarily unavailable.");
  return {
    visitIds: (visits ?? []).map((row) => String(row.id)),
    memberIds: (members ?? []).map((row) => String(row.id)),
  };
}

async function validateEvidenceContext(ctx: UserContext, formData: FormData): Promise<EvidenceContext> {
  const programmeId = textValue(formData, "programme_id");
  const cohortId = textValue(formData, "cohort_id");
  const cohortMemberId = textValue(formData, "cohort_member_id");
  const interventionId = textValue(formData, "intervention_id");
  const assessmentId = textValue(formData, "assessment_id");
  const fieldVisitId = textValue(formData, "field_visit_id");
  if (!programmeId) throw new Error("Select a programme for this evidence.");
  if (!cohortId) throw new Error("Select a beneficiary cohort for this evidence.");
  if (!cohortMemberId) throw new Error("Select a cohort beneficiary for this evidence.");

  const supabase = await createServiceRoleSupabaseClient();
  const { data: member, error: memberError } = await supabase
    .from("impact_cohort_members")
    .select("id,programme_id,cohort_id,msme_id,assigned_to_user_id")
    .eq("id", cohortMemberId)
    .maybeSingle();
  if (memberError) throw new Error("The selected beneficiary could not be validated.");
  if (!member) throw new Error("Selected evidence cohort beneficiary does not exist.");
  if (member.programme_id !== programmeId) throw new Error("Selected evidence beneficiary does not belong to the selected programme.");
  if (member.cohort_id !== cohortId) throw new Error("Selected evidence beneficiary does not belong to the selected cohort.");

  const [interventionResult, assessmentResult, visitResult] = await Promise.all([
    interventionId
      ? supabase.from("impact_interventions").select("id,programme_id,cohort_id,cohort_member_id,msme_id").eq("id", interventionId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    assessmentId
      ? supabase.from("impact_assessments").select("id,programme_id,cohort_id,cohort_member_id,msme_id,intervention_id").eq("id", assessmentId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    fieldVisitId
      ? supabase.from("impact_field_visits").select("id,programme_id,cohort_id,cohort_member_id,msme_id,intervention_id,assessment_id,assigned_to_user_id").eq("id", fieldVisitId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (interventionResult.error) throw new Error("The selected intervention could not be validated.");
  if (interventionId && !interventionResult.data) throw new Error("Selected evidence intervention does not exist.");
  if (interventionResult.data && (
    interventionResult.data.programme_id !== programmeId
    || interventionResult.data.cohort_id !== cohortId
    || interventionResult.data.cohort_member_id !== cohortMemberId
    || interventionResult.data.msme_id !== member.msme_id
  )) throw new Error("Selected evidence intervention does not match the programme beneficiary context.");

  if (assessmentResult.error) throw new Error("The selected assessment could not be validated.");
  if (assessmentId && !assessmentResult.data) throw new Error("Selected evidence assessment does not exist.");
  if (assessmentResult.data && (
    assessmentResult.data.programme_id !== programmeId
    || assessmentResult.data.cohort_id !== cohortId
    || assessmentResult.data.cohort_member_id !== cohortMemberId
    || assessmentResult.data.msme_id !== member.msme_id
  )) throw new Error("Selected evidence assessment does not match the programme beneficiary context.");
  if (assessmentResult.data && interventionId && assessmentResult.data.intervention_id && assessmentResult.data.intervention_id !== interventionId) {
    throw new Error("Selected evidence assessment does not match the selected intervention.");
  }

  if (visitResult.error) throw new Error("The selected field visit could not be validated.");
  if (fieldVisitId && !visitResult.data) throw new Error("Selected evidence field visit does not exist.");
  if (visitResult.data && (
    visitResult.data.programme_id !== programmeId
    || visitResult.data.cohort_id !== cohortId
    || visitResult.data.cohort_member_id !== cohortMemberId
    || visitResult.data.msme_id !== member.msme_id
  )) throw new Error("Selected evidence field visit does not match the programme beneficiary context.");
  if (visitResult.data && interventionId && visitResult.data.intervention_id !== interventionId) {
    throw new Error("Selected evidence field visit does not match the selected intervention.");
  }
  if (visitResult.data && assessmentId && visitResult.data.assessment_id !== assessmentId) {
    throw new Error("Selected evidence field visit does not match the selected assessment.");
  }

  if (ctx.role === "field_officer") {
    const ownsMember = member.assigned_to_user_id === ctx.appUserId;
    const ownsVisit = Boolean(visitResult.data && visitResult.data.assigned_to_user_id === ctx.appUserId);
    if (!ownsMember && !ownsVisit) throw new Error("You can only upload evidence for assigned visits or beneficiaries.");
  }

  return {
    programmeId,
    cohortId,
    cohortMemberId,
    msmeId: String(member.msme_id),
    interventionId,
    assessmentId,
    fieldVisitId,
  };
}

async function insertEvidenceEvent(params: {
  evidence: Pick<ImpactEvidenceRecord, "id" | "programme_id" | "cohort_id" | "cohort_member_id" | "msme_id">;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  ctx: UserContext;
  note?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = await createServiceRoleSupabaseClient();
  const { error } = await supabase.from("impact_evidence_events").insert({
    evidence_id: params.evidence.id,
    programme_id: params.evidence.programme_id,
    cohort_id: params.evidence.cohort_id,
    cohort_member_id: params.evidence.cohort_member_id,
    msme_id: params.evidence.msme_id,
    event_type: params.eventType,
    from_status: params.fromStatus ?? null,
    to_status: params.toStatus ?? null,
    actor_user_id: params.ctx.appUserId,
    actor_role: params.ctx.role,
    note: params.note ?? null,
    metadata: params.metadata ?? {},
  });
  if (error) logImpactEvidenceDiagnostic({ operation: "event_insert_failed", evidenceId: params.evidence.id, actorRole: params.ctx.role, errorMessage: error.message, success: false });
}

export async function uploadImpactEvidence(ctx: UserContext, formData: FormData) {
  requireRole(ctx, IMPACT_EVIDENCE_CREATE_ROLES, "You do not have permission to upload impact evidence.");
  const context = await validateEvidenceContext(ctx, formData);
  const fileValue = formData.get("evidence_file");
  const file = fileValue instanceof File ? fileValue : null;
  const validation = validateImpactEvidenceFile(file);
  if (!validation.ok || !file) throw new Error(validation.message);

  const buffer = await file.arrayBuffer();
  const sha256Hash = createHash("sha256").update(Buffer.from(buffer)).digest("hex");
  const safeOriginalName = sanitizeImpactEvidenceFileName(file.name);
  const extension = extractExtension(safeOriginalName);
  const evidenceId = randomUUID();
  const storedFilename = `${randomUUID()}.${extension}`;
  const storagePath = `${context.programmeId}/${context.cohortId}/${evidenceId}/${storedFilename}`;
  const supabase = await ensureImpactEvidenceBucket();

  const { data: duplicate, error: duplicateError } = await supabase
    .from("impact_evidence_files")
    .select("id")
    .eq("cohort_member_id", context.cohortMemberId)
    .eq("checksum_sha256", sha256Hash)
    .neq("status", "archived")
    .limit(1)
    .maybeSingle();
  if (duplicateError) throw new Error("Evidence duplicate validation is temporarily unavailable.");
  if (duplicate) throw new Error("This evidence file is already uploaded for the selected beneficiary.");

  const { error: uploadError } = await supabase.storage.from(IMPACT_EVIDENCE_BUCKET).upload(storagePath, Buffer.from(buffer), {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) {
    const info = safeError(uploadError);
    logImpactEvidenceDiagnostic({ operation: "storage_upload_failed", programmeId: context.programmeId, cohortId: context.cohortId, fieldVisitId: context.fieldVisitId, actorRole: ctx.role, fileSize: file.size, mimeType: file.type, errorCode: info.code, errorMessage: info.message, success: false });
    throw new Error("Evidence upload failed. Please try again.");
  }

  const now = new Date().toISOString();
  const payload = {
    id: evidenceId,
    programme_id: context.programmeId,
    cohort_id: context.cohortId,
    cohort_member_id: context.cohortMemberId,
    intervention_id: context.interventionId,
    assessment_id: context.assessmentId,
    field_visit_id: context.fieldVisitId,
    msme_id: context.msmeId,
    file_name: safeOriginalName,
    file_url: null,
    file_type: file.type,
    evidence_type: file.type.startsWith("image/") ? "image" : "pdf",
    evidence_category: textValue(formData, "evidence_category") ?? "other",
    verification_status: "pending",
    status: "uploaded",
    description: textValue(formData, "description"),
    storage_bucket: IMPACT_EVIDENCE_BUCKET,
    storage_path: storagePath,
    original_filename: safeOriginalName,
    stored_filename: storedFilename,
    mime_type: file.type,
    file_size_bytes: file.size,
    checksum_sha256: sha256Hash,
    captured_at: textValue(formData, "captured_at"),
    uploaded_at: now,
    uploaded_by_user_id: ctx.appUserId,
    metadata: { source: "impact_evidence_phase1", legacy_placeholder: false },
  };

  const { data: inserted, error: insertError } = await supabase
    .from("impact_evidence_files")
    .insert(payload)
    .select("id,programme_id,cohort_id,cohort_member_id,msme_id")
    .single();
  if (insertError || !inserted) {
    const { error: cleanupError } = await supabase.storage.from(IMPACT_EVIDENCE_BUCKET).remove([storagePath]);
    logImpactEvidenceDiagnostic({
      operation: cleanupError ? "metadata_insert_rollback_failed" : "metadata_insert_rolled_back",
      evidenceId,
      programmeId: context.programmeId,
      cohortId: context.cohortId,
      actorRole: ctx.role,
      fileSize: file.size,
      mimeType: file.type,
      errorMessage: cleanupError?.message ?? insertError?.message ?? "metadata_insert_failed",
      success: false,
    });
    throw new Error("Evidence metadata could not be saved. The upload was rolled back.");
  }

  const linkPayload = {
    evidence_id: evidenceId,
    programme_id: context.programmeId,
    intervention_id: context.interventionId,
    assessment_id: context.assessmentId,
    field_visit_id: context.fieldVisitId,
    msme_id: context.msmeId,
    link_type: "supporting_evidence",
    created_by_user_id: ctx.appUserId,
    metadata: { cohort_id: context.cohortId, cohort_member_id: context.cohortMemberId },
  };
  const { error: linkError } = await supabase.from("impact_evidence_links").insert(linkPayload);
  if (linkError) {
    const [{ error: rowCleanupError }, { error: fileCleanupError }] = await Promise.all([
      supabase.from("impact_evidence_files").delete().eq("id", evidenceId),
      supabase.storage.from(IMPACT_EVIDENCE_BUCKET).remove([storagePath]),
    ]);
    if (rowCleanupError || fileCleanupError) {
      await supabase.from("impact_evidence_files").update({
        verification_status: "needs_review",
        metadata: { source: "impact_evidence_phase1", incomplete_upload: true, link_error: linkError.message },
      }).eq("id", evidenceId);
    }
    throw new Error("Evidence links could not be saved. The upload was rolled back.");
  }

  await insertEvidenceEvent({
    evidence: inserted as ImpactEvidenceRecord,
    eventType: "uploaded",
    fromStatus: "draft",
    toStatus: "uploaded",
    ctx,
    note: textValue(formData, "description"),
    metadata: { mime_type: file.type, file_size_bytes: file.size },
  });
  logImpactEvidenceDiagnostic({ operation: "upload_success", evidenceId, programmeId: context.programmeId, cohortId: context.cohortId, fieldVisitId: context.fieldVisitId, actorRole: ctx.role, fileSize: file.size, mimeType: file.type, success: true });
  return evidenceId;
}

export async function listImpactEvidence(ctx: UserContext, options: EvidenceQueryOptions = {}) {
  requireRole(ctx, IMPACT_EVIDENCE_READ_ROLES, "You do not have permission to read impact evidence.");
  const supabase = await createServiceRoleSupabaseClient();
  let query = supabase.from("impact_evidence_files").select(IMPACT_EVIDENCE_SELECT).order("created_at", { ascending: false }).limit(options.limit ?? 100);
  if (options.programmeId) query = query.eq("programme_id", options.programmeId);
  if (options.cohortId) query = query.eq("cohort_id", options.cohortId);
  if (options.cohortMemberId) query = query.eq("cohort_member_id", options.cohortMemberId);
  if (options.interventionId) query = query.eq("intervention_id", options.interventionId);
  if (options.assessmentId) query = query.eq("assessment_id", options.assessmentId);
  if (options.fieldVisitId) query = query.eq("field_visit_id", options.fieldVisitId);

  if (ctx.role === "field_officer") {
    const scope = await getFieldOfficerScope(ctx);
    if (scope.visitIds.length === 0 && scope.memberIds.length === 0) return [];
    const filters: string[] = [];
    if (scope.visitIds.length > 0) filters.push(`field_visit_id.in.(${scope.visitIds.join(",")})`);
    if (scope.memberIds.length > 0) filters.push(`cohort_member_id.in.(${scope.memberIds.join(",")})`);
    query = query.or(filters.join(","));
  }

  const { data, error } = await query;
  if (error) throw new Error(`Impact evidence source unavailable: ${error.message}`);
  return mapImpactEvidenceRows(data);
}

export async function getImpactEvidenceUploadOptions(
  ctx: UserContext,
  filters: { programmeId?: string | null; cohortId?: string | null } = {},
): Promise<ImpactEvidenceUploadOptions> {
  requireRole(ctx, IMPACT_EVIDENCE_CREATE_ROLES, "You do not have permission to upload impact evidence.");
  const supabase = await createServiceRoleSupabaseClient();
  const scope = ctx.role === "field_officer" ? await getFieldOfficerScope(ctx) : null;

  let memberQuery = supabase
    .from("impact_cohort_members")
    .select("id,cohort_id,programme_id,msme_id,member_status,msmes(id,business_name,msme_id)")
    .order("enrolled_at", { ascending: false })
    .limit(250);
  if (filters.programmeId) memberQuery = memberQuery.eq("programme_id", filters.programmeId);
  if (filters.cohortId) memberQuery = memberQuery.eq("cohort_id", filters.cohortId);

  if (scope) {
    const memberIds = new Set(scope.memberIds);
    if (scope.visitIds.length > 0) {
      const { data: visitMembers, error } = await supabase.from("impact_field_visits").select("cohort_member_id").in("id", scope.visitIds);
      if (error) throw new Error("Assigned evidence scope is temporarily unavailable.");
      for (const row of visitMembers ?? []) if (row.cohort_member_id) memberIds.add(String(row.cohort_member_id));
    }
    if (memberIds.size === 0) return { programmes: [], cohorts: [], members: [], interventions: [], assessments: [], visits: [] };
    memberQuery = memberQuery.in("id", Array.from(memberIds));
  }

  const { data: members, error: memberError } = await memberQuery;
  if (memberError) throw new Error(`Evidence beneficiary options unavailable: ${memberError.message}`);
  const memberRows = (members ?? []) as unknown as ImpactEvidenceUploadOptions["members"];
  const programmeIds = Array.from(new Set(memberRows.map((row) => row.programme_id)));
  const cohortIds = Array.from(new Set(memberRows.map((row) => row.cohort_id)));
  const memberIds = memberRows.map((row) => row.id);

  if (programmeIds.length === 0) return { programmes: [], cohorts: [], members: [], interventions: [], assessments: [], visits: [] };

  const [programmeResult, cohortResult, interventionResult, assessmentResult, visitResult] = await Promise.all([
    supabase.from("impact_programmes").select("id,name,programme_code").in("id", programmeIds).order("name"),
    cohortIds.length > 0
      ? supabase.from("impact_beneficiary_cohorts").select("id,programme_id,name,current_beneficiaries").in("id", cohortIds).order("name")
      : Promise.resolve({ data: [], error: null }),
    memberIds.length > 0
      ? supabase.from("impact_interventions").select("id,programme_id,cohort_id,cohort_member_id,msme_id,title").in("cohort_member_id", memberIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    memberIds.length > 0
      ? supabase.from("impact_assessments").select("id,programme_id,cohort_id,cohort_member_id,intervention_id,msme_id,title,assessment_type").in("cohort_member_id", memberIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    memberIds.length > 0
      ? supabase.from("impact_field_visits").select("id,programme_id,cohort_id,cohort_member_id,intervention_id,assessment_id,msme_id,title,status").in("cohort_member_id", memberIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const firstError = programmeResult.error || cohortResult.error || interventionResult.error || assessmentResult.error || visitResult.error;
  if (firstError) throw new Error(`Evidence upload options unavailable: ${firstError.message}`);

  let visits = (visitResult.data ?? []) as ImpactEvidenceUploadOptions["visits"];
  if (scope) {
    const allowedVisits = new Set(scope.visitIds);
    visits = visits.filter((visit) => allowedVisits.has(visit.id) || scope.memberIds.includes(visit.cohort_member_id));
  }

  return {
    programmes: (programmeResult.data ?? []) as ImpactEvidenceUploadOptions["programmes"],
    cohorts: (cohortResult.data ?? []) as ImpactEvidenceUploadOptions["cohorts"],
    members: memberRows,
    interventions: (interventionResult.data ?? []) as ImpactEvidenceUploadOptions["interventions"],
    assessments: (assessmentResult.data ?? []) as ImpactEvidenceUploadOptions["assessments"],
    visits,
  };
}

export async function canAccessImpactEvidence(ctx: UserContext, evidence: Pick<ImpactEvidenceRecord, "field_visit_id" | "cohort_member_id">) {
  if (!(IMPACT_EVIDENCE_READ_ROLES as readonly string[]).includes(ctx.role)) return false;
  if (ctx.role !== "field_officer") return true;
  const scope = await getFieldOfficerScope(ctx);
  return Boolean(
    (evidence.field_visit_id && scope.visitIds.includes(evidence.field_visit_id))
    || (evidence.cohort_member_id && scope.memberIds.includes(evidence.cohort_member_id))
  );
}

export async function getImpactEvidence(ctx: UserContext, evidenceId: string) {
  requireRole(ctx, IMPACT_EVIDENCE_READ_ROLES, "You do not have permission to read impact evidence.");
  const supabase = await createServiceRoleSupabaseClient();
  const [{ data: evidence, error }, { data: events, error: eventError }] = await Promise.all([
    supabase.from("impact_evidence_files").select(IMPACT_EVIDENCE_SELECT).eq("id", evidenceId).maybeSingle(),
    supabase.from("impact_evidence_events").select("id,evidence_id,event_type,from_status,to_status,actor_user_id,actor_role,note,metadata,created_at").eq("evidence_id", evidenceId).order("created_at", { ascending: false }),
  ]);
  if (error) throw new Error(`Impact evidence source unavailable: ${error.message}`);
  if (eventError) throw new Error(`Impact evidence history unavailable: ${eventError.message}`);
  const record = evidence ? mapImpactEvidenceRow(evidence) : null;
  if (record && !(await canAccessImpactEvidence(ctx, record))) throw new Error("You can only access evidence for assigned visits or beneficiaries.");
  return { evidence: record, events: (events ?? []) as ImpactEvidenceEvent[] };
}

export async function transitionImpactEvidence(ctx: UserContext, evidenceId: string, action: string, formData: FormData) {
  const supabase = await createServiceRoleSupabaseClient();
  const { evidence } = await getImpactEvidence(ctx, evidenceId);
  if (!evidence) throw new Error("Evidence record was not found.");
  const now = new Date().toISOString();
  let nextStatus: ImpactEvidenceStatus;
  let eventType: string;
  const patch: Record<string, unknown> = {};

  if (action === "submit") {
    requireRole(ctx, IMPACT_EVIDENCE_CREATE_ROLES, "You do not have permission to submit impact evidence.");
    if (!["uploaded", "returned"].includes(evidence.status)) throw new Error("Only uploaded or returned evidence can be submitted.");
    if (ctx.role === "field_officer" && !(await canAccessImpactEvidence(ctx, evidence))) throw new Error("You can only submit evidence for assigned visits or beneficiaries.");
    nextStatus = "submitted";
    eventType = evidence.status === "returned" ? "resubmitted" : "submitted";
    patch.submitted_at = now;
    patch.returned_at = null;
    patch.returned_by_user_id = null;
    patch.return_reason = null;
    patch.reviewed_at = null;
    patch.reviewed_by_user_id = null;
    patch.review_decision = null;
    patch.review_note = null;
    patch.verified_by_user_id = null;
    patch.verified_at = null;
    patch.verification_status = "pending";
  } else if (action === "archive") {
    requireRole(ctx, IMPACT_EVIDENCE_REVIEW_ROLES, "You do not have permission to archive impact evidence.");
    if (evidence.status === "archived") throw new Error("Evidence is already archived.");
    nextStatus = "archived";
    eventType = "archived";
    patch.archived_at = now;
    patch.archived_by_user_id = ctx.appUserId;
    patch.verification_status = "archived";
  } else {
    requireRole(ctx, IMPACT_EVIDENCE_REVIEW_ROLES, "You do not have permission to review impact evidence.");
    if (action === "start_review") {
      if (evidence.status !== "submitted") throw new Error("Only submitted evidence can enter review.");
      nextStatus = "under_review";
      eventType = "review_started";
      patch.verification_status = "needs_review";
    } else {
      if (evidence.status !== "under_review") throw new Error("Evidence must be under review before a decision.");
      if (!["verified", "rejected", "returned"].includes(action)) throw new Error("Select a valid evidence review decision.");
      nextStatus = action as ImpactEvidenceStatus;
      eventType = action;
      const reviewNote = textValue(formData, "review_note");
      if (["rejected", "returned"].includes(action) && !reviewNote) throw new Error("A review note is required when rejecting or returning evidence.");
      if (action === "verified") {
        if (!evidence.storage_bucket || !evidence.storage_path || !evidence.stored_filename) {
          throw new Error("Verified evidence requires a stored file.");
        }
        const folder = evidence.storage_path.slice(0, Math.max(0, evidence.storage_path.lastIndexOf("/")));
        const { data: objects, error: objectError } = await supabase.storage.from(evidence.storage_bucket).list(folder, {
          search: evidence.stored_filename,
          limit: 10,
        });
        if (objectError || !(objects ?? []).some((object) => object.name === evidence.stored_filename)) {
          throw new Error("The stored evidence file could not be confirmed. Verification is blocked.");
        }
      }
      patch.reviewed_at = now;
      patch.reviewed_by_user_id = ctx.appUserId;
      patch.review_decision = action;
      patch.review_note = reviewNote;
      patch.verification_status = action === "verified" ? "verified" : action === "rejected" ? "rejected" : "returned";
      patch.verified_by_user_id = action === "verified" ? ctx.appUserId : null;
      patch.verified_at = action === "verified" ? now : null;
      if (action === "returned") {
        patch.returned_at = now;
        patch.returned_by_user_id = ctx.appUserId;
        patch.return_reason = reviewNote;
      }
    }
  }

  const { data: updated, error } = await supabase
    .from("impact_evidence_files")
    .update({ ...patch, status: nextStatus })
    .eq("id", evidenceId)
    .eq("status", evidence.status)
    .select("id,programme_id,cohort_id,cohort_member_id,msme_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) throw new Error("Evidence status changed before this action completed. Reload and try again.");
  await insertEvidenceEvent({
    evidence: updated as ImpactEvidenceRecord,
    eventType,
    fromStatus: evidence.status,
    toStatus: nextStatus,
    ctx,
    note: textValue(formData, "review_note"),
  });
}

export async function recordImpactEvidenceAccess(ctx: UserContext, evidence: ImpactEvidenceRecord, disposition: "inline" | "attachment") {
  await insertEvidenceEvent({
    evidence,
    eventType: disposition === "attachment" ? "downloaded" : "previewed",
    fromStatus: evidence.status,
    toStatus: evidence.status,
    ctx,
    metadata: { disposition, mime_type: evidence.mime_type },
  });
}
