import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserContext } from "@/lib/auth/authorization";

export const COMPLIANCE_EVIDENCE_BUCKET = "compliance-evidence";
export const COMPLIANCE_EVIDENCE_MAX_FILE_SIZE = 10 * 1024 * 1024;
export const COMPLIANCE_EVIDENCE_SIGNED_URL_SECONDS = 60 * 5;
export const COMPLIANCE_EVIDENCE_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
export const COMPLIANCE_EVIDENCE_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "webp"]);

export type ComplianceEvidenceDocument = {
  id: string;
  msme_id: string;
  compliance_item_id: string;
  regulator_id: string;
  requirement_id: string;
  document_type: string;
  original_filename: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
  checksum_sha256: string;
  uploaded_by: string | null;
  uploaded_at: string;
  verified_at: string | null;
  expires_at: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ComplianceEvidenceDiagnostic = {
  operation: string;
  msmeId?: string | null;
  complianceItemId?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  uploadSucceeded?: boolean;
  signedUrlGenerated?: boolean;
  deleteSucceeded?: boolean;
  supabaseErrorCode?: string | null;
  supabaseErrorMessage?: string | null;
};

export function logComplianceEvidenceDiagnostic(payload: ComplianceEvidenceDiagnostic) {
  console.info("[compliance-evidence]", payload);
}

export function toSupabaseErrorInfo(error: unknown) {
  if (!error || typeof error !== "object") {
    return { code: null, message: String(error ?? "unknown_error") };
  }
  const maybeError = error as { code?: unknown; message?: unknown; name?: unknown };
  return {
    code: typeof maybeError.code === "string" ? maybeError.code : typeof maybeError.name === "string" ? maybeError.name : null,
    message: typeof maybeError.message === "string" ? maybeError.message : "unknown_error",
  };
}

function extractExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function sanitizeComplianceEvidenceFileName(fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 140);
  return safeName || "compliance-evidence";
}

export function validateComplianceEvidenceFile(file: File | null) {
  if (!file || file.size <= 0) {
    return { ok: false as const, code: "file_required", message: "Choose a compliance evidence file to upload." };
  }

  if (file.size > COMPLIANCE_EVIDENCE_MAX_FILE_SIZE) {
    return { ok: false as const, code: "file_too_large", message: "Evidence file must be 10MB or smaller." };
  }

  const extension = extractExtension(file.name);
  const mimeType = (file.type || "").toLowerCase();

  if (!COMPLIANCE_EVIDENCE_EXTENSIONS.has(extension) || extension === "svg") {
    return { ok: false as const, code: "unsupported_file_type", message: "Evidence must be a PDF, JPG, JPEG, PNG, or WEBP file." };
  }

  if (!mimeType || !COMPLIANCE_EVIDENCE_MIME_TYPES.has(mimeType) || mimeType === "image/svg+xml") {
    return { ok: false as const, code: "unsupported_mime_type", message: "Unsupported file type. SVG and executable files are not allowed." };
  }

  return { ok: true as const };
}

export function canAccessComplianceEvidence(ctx: Pick<UserContext, "role" | "linkedMsmeId">, msmeId: string) {
  if (["admin", "reviewer", "fccpc_officer", "firs_officer", "nrs_officer"].includes(ctx.role)) return true;
  return ctx.role === "msme" && ctx.linkedMsmeId === msmeId;
}

export async function ensureComplianceEvidenceBucket(supabase: SupabaseClient<any>) {
  const { data: existingBucket, error: lookupError } = await supabase.storage.getBucket(COMPLIANCE_EVIDENCE_BUCKET);
  if (lookupError) {
    logComplianceEvidenceDiagnostic({
      operation: "bucket_lookup",
      supabaseErrorCode: toSupabaseErrorInfo(lookupError).code,
      supabaseErrorMessage: toSupabaseErrorInfo(lookupError).message,
    });
  }

  if (existingBucket) return true;

  const { error: createError } = await supabase.storage.createBucket(COMPLIANCE_EVIDENCE_BUCKET, {
    public: false,
    fileSizeLimit: `${COMPLIANCE_EVIDENCE_MAX_FILE_SIZE}`,
    allowedMimeTypes: Array.from(COMPLIANCE_EVIDENCE_MIME_TYPES),
  });

  if (createError) {
    const errorInfo = toSupabaseErrorInfo(createError);
    logComplianceEvidenceDiagnostic({
      operation: "bucket_create",
      supabaseErrorCode: errorInfo.code,
      supabaseErrorMessage: errorInfo.message,
    });
    return false;
  }

  return true;
}

export async function computeSha256(buffer: ArrayBuffer) {
  return createHash("sha256").update(Buffer.from(buffer)).digest("hex");
}

export async function logComplianceDocumentEvent(
  supabase: SupabaseClient<any>,
  params: {
    documentId?: string | null;
    msmeId: string;
    complianceItemId?: string | null;
    regulatorId?: string | null;
    requirementId?: string | null;
    eventType: "uploaded" | "previewed" | "downloaded" | "deleted" | "verification_requested";
    actorUserId?: string | null;
    actorRole?: string | null;
    summary: string;
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await supabase.from("compliance_document_events").insert({
    document_id: params.documentId ?? null,
    msme_id: params.msmeId,
    compliance_item_id: params.complianceItemId ?? null,
    regulator_id: params.regulatorId ?? null,
    requirement_id: params.requirementId ?? null,
    event_type: params.eventType,
    actor_user_id: params.actorUserId ?? null,
    actor_role: params.actorRole ?? null,
    summary: params.summary,
    metadata: params.metadata ?? {},
  });

  if (error) {
    const errorInfo = toSupabaseErrorInfo(error);
    logComplianceEvidenceDiagnostic({
      operation: "event_insert_failed",
      msmeId: params.msmeId,
      complianceItemId: params.complianceItemId ?? null,
      supabaseErrorCode: errorInfo.code,
      supabaseErrorMessage: errorInfo.message,
    });
  }
}
