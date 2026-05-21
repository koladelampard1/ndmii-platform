import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { resolveProviderPublicContext } from "@/lib/data/provider-profile-resolver";
import { createComplaintStatusHistory, generateComplaintReference } from "@/lib/data/complaints";
import { normalizeFccpcStatus } from "@/lib/data/fccpc-complaints";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_EVIDENCE_FILE_BYTES = 10 * 1024 * 1024;
const DEFAULT_EVIDENCE_BUCKET = "complaint-evidence";
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 8;
const ALLOWED_EVIDENCE_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg", "doc", "docx"]);
const ALLOWED_EVIDENCE_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpg",
  "image/jpeg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const ALLOWED_SEVERITIES = new Set(["low", "medium", "high", "critical"]);

type ComplaintFormValidationResult =
  | {
      ok: true;
      fields: {
        providerPathSegment: string;
        complainant_name: string;
        complainant_email: string;
        complainant_phone: string;
        preferred_contact_method: string;
        complaint_type: string;
        summary: string;
        description: string;
        related_reference: string;
        consent_confirmation: string;
        providerProfileId: string;
        providerMsmePublicId: string;
        formProviderSlug: string;
        evidenceAttachment: FormDataEntryValue | null;
        severity: string;
      };
    }
  | {
      ok: false;
      response: NextResponse;
    };

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function resolveClientRateLimitKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || "unknown";
}

function checkPublicComplaintRateLimit(request: Request) {
  const key = resolveClientRateLimitKey(request);
  const now = Date.now();
  const existing = rateLimitStore.get(key);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { limited: false, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { limited: true, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  rateLimitStore.set(key, existing);
  return { limited: false, remaining: RATE_LIMIT_MAX_REQUESTS - existing.count, resetAt: existing.resetAt };
}

function extractFileExtension(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();
  return extension ?? "";
}

function resolveEvidenceBucketName() {
  return (
    process.env.SUPABASE_COMPLAINT_EVIDENCE_BUCKET ||
    process.env.NEXT_PUBLIC_SUPABASE_COMPLAINT_EVIDENCE_BUCKET ||
    DEFAULT_EVIDENCE_BUCKET
  );
}

function sanitizeEvidenceFileName(filename: string) {
  const sanitized = filename.replace(/[^a-zA-Z0-9_.-]/g, "_").replace(/_+/g, "_");
  const trimmed = sanitized.replace(/^[_./-]+/, "");
  return trimmed || "evidence-file";
}

function toStorageErrorLog(error: {
  message: string;
  name: string;
  statusCode?: string | number;
}) {
  const storageError = error as {
    message: string;
    name: string;
    statusCode?: string | number;
    details?: string;
    hint?: string;
    error?: string;
  };

  return {
    message: storageError.message,
    name: storageError.name ?? null,
    statusCode: storageError.statusCode ?? null,
    details: storageError.details ?? null,
    hint: storageError.hint ?? null,
    error: storageError.error ?? null,
  };
}

function isEvidenceFileAllowed(file: File) {
  const extension = extractFileExtension(file.name);
  const mimeType = (file.type || "").toLowerCase();
  if (!ALLOWED_EVIDENCE_EXTENSIONS.has(extension)) {
    return false;
  }

  if (!mimeType) {
    return true;
  }

  if (ALLOWED_EVIDENCE_MIME_TYPES.has(mimeType)) {
    return true;
  }

  if ((extension === "jpg" || extension === "jpeg") && mimeType === "image/pjpeg") {
    return true;
  }

  return false;
}

function safeComplaintLog(message: string, payload: Record<string, unknown>) {
  console.info(`[complaint-submit] ${message}`, payload);
}

function safeComplaintError(message: string, payload: Record<string, unknown>) {
  console.error(`[complaint-submit] ${message}`, payload);
}

function resolveSeverity(formData: FormData) {
  const rawPriority = String(formData.get("severity") ?? formData.get("priority") ?? formData.get("urgency") ?? "")
    .trim()
    .toLowerCase();

  if (!rawPriority) {
    return "medium";
  }

  if (rawPriority === "critical") {
    return "critical";
  }

  if (["high", "urgent"].includes(rawPriority)) {
    return "high";
  }

  if (["low", "minor"].includes(rawPriority)) {
    return "low";
  }

  if (["medium", "normal", "moderate"].includes(rawPriority)) {
    return "medium";
  }

  return "medium";
}

function isSeverityAllowed(value: string) {
  return ALLOWED_SEVERITIES.has(value);
}

function validateComplaintForm(formData: FormData): ComplaintFormValidationResult {
  const providerPathSegment = String(formData.get("provider_path_segment") ?? "").trim();

  if (!providerPathSegment) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, code: "missing_provider", message: "Provider route segment is required." },
        { status: 400 }
      ),
    };
  }

  const complainant_name = String(formData.get("full_name") ?? "").trim();
  const complainant_email = String(formData.get("email") ?? "").trim();
  const complainant_phone = String(formData.get("phone") ?? "").trim();
  const preferred_contact_method = String(formData.get("preferred_contact_method") ?? "email").trim() || "email";
  const complaint_type = String(formData.get("complaint_type") ?? "").trim();
  const summary = String(formData.get("short_summary") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const related_reference = String(formData.get("related_reference") ?? "").trim();
  const consent_confirmation = String(formData.get("consent_confirmation") ?? "").trim();
  const providerProfileId = String(formData.get("provider_profile_id") ?? "").trim();
  const providerMsmePublicId = String(formData.get("provider_msme_public_id") ?? "").trim();
  const formProviderSlug = String(formData.get("provider_slug") ?? "").trim();
  const evidenceAttachment = formData.get("evidence_attachment");
  const severity = resolveSeverity(formData);

  if (!complainant_name || !description || !summary || !consent_confirmation || !complaint_type) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, code: "missing_fields", message: "Please complete all required complaint fields." },
        { status: 400 }
      ),
    };
  }

  if (!isSeverityAllowed(severity)) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, code: "invalid_severity", message: "Complaint severity must be low, medium, high, or critical." },
        { status: 400 }
      ),
    };
  }

  if (evidenceAttachment instanceof File && evidenceAttachment.size > 0) {
    if (evidenceAttachment.size > MAX_EVIDENCE_FILE_BYTES) {
      return {
        ok: false,
        response: NextResponse.json(
          { ok: false, code: "file_too_large", message: "Evidence file is too large. Maximum allowed size is 10 MB." },
          { status: 400 }
        ),
      };
    }
    if (!isEvidenceFileAllowed(evidenceAttachment)) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            ok: false,
            code: "unsupported_file_type",
            message: "Unsupported evidence file type. Allowed formats: PDF, PNG, JPG, JPEG, DOC, DOCX.",
          },
          { status: 400 }
        ),
      };
    }
  }

  return {
    ok: true,
    fields: {
      providerPathSegment,
      complainant_name,
      complainant_email,
      complainant_phone,
      preferred_contact_method,
      complaint_type,
      summary,
      description,
      related_reference,
      consent_confirmation,
      providerProfileId,
      providerMsmePublicId,
      formProviderSlug,
      evidenceAttachment,
      severity,
    },
  };
}

export async function POST(request: Request) {
  const rateLimit = checkPublicComplaintRateLimit(request);
  if (rateLimit.limited) {
    return NextResponse.json(
      {
        ok: false,
        code: "rate_limited",
        message: "Too many complaint submissions. Please wait before retrying.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))),
          "X-RateLimit-Limit": String(RATE_LIMIT_MAX_REQUESTS),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const formData = await request.formData();
  const validation = validateComplaintForm(formData);

  if (!validation.ok) {
    return validation.response;
  }

  const {
    providerPathSegment,
    complainant_name,
    complainant_email,
    complainant_phone,
    preferred_contact_method,
    complaint_type,
    summary,
    description,
    related_reference,
    providerProfileId,
    providerMsmePublicId,
    evidenceAttachment,
    severity,
  } = validation.fields;

  safeComplaintLog("request_received", {
    operation: "public_complaint_submit",
    providerId: providerProfileId || null,
    status: "received",
    hasEvidenceAttachment: evidenceAttachment instanceof File && evidenceAttachment.size > 0,
  });

  const supabase = await createServiceRoleSupabaseClient();

  try {
    const providerContext = await resolveProviderPublicContext({
      providerRouteParam: providerPathSegment,
    });

    safeComplaintLog("provider_resolution", {
      operation: "resolve_provider",
      found: Boolean(providerContext.provider),
      providerId: providerContext.provider_profile_id ?? null,
      status: providerContext.provider_profile_id ? "resolved" : "not_found",
    });

    if (!providerContext.provider_profile_id) {
      return NextResponse.json(
        { ok: false, code: "provider_not_found", message: "Provider profile could not be resolved." },
        { status: 404 }
      );
    }

    const resolvedProviderId = providerContext.provider_profile_id;
    const canonicalSlug = providerContext.provider?.public_slug ?? providerPathSegment;
    const providerPublicMsmeId = providerMsmePublicId || providerContext.provider?.msme_id || null;

    let resolvedInternalMsmeUuid = UUID_PATTERN.test(providerContext.provider_profile_msme_id ?? "")
      ? providerContext.provider_profile_msme_id
      : null;

    if (!resolvedInternalMsmeUuid) {
      const { data: providerProfileRow, error: providerProfileLookupError } = await supabase
        .from("provider_profiles")
        .select("msme_id")
        .eq("id", resolvedProviderId)
        .maybeSingle();

      if (providerProfileLookupError) {
        safeComplaintError("provider_profile_lookup_error", {
          operation: "resolve_provider_msme",
          providerId: resolvedProviderId,
          status: "error",
          message: providerProfileLookupError.message,
        });
      }

      const providerProfileMsmeId = providerProfileRow?.msme_id ?? null;
      if (UUID_PATTERN.test(providerProfileMsmeId ?? "")) {
        resolvedInternalMsmeUuid = providerProfileMsmeId;
      }
    }

    if (!resolvedInternalMsmeUuid && providerPublicMsmeId) {
      if (UUID_PATTERN.test(providerPublicMsmeId)) {
        resolvedInternalMsmeUuid = providerPublicMsmeId;
      } else {
        const { data: resolvedMsme, error: msmeResolveError } = await supabase
          .from("msmes")
          .select("id")
          .eq("msme_id", providerPublicMsmeId.toUpperCase())
          .maybeSingle();

        if (msmeResolveError) {
          safeComplaintError("msme_resolution_error", {
            operation: "resolve_provider_msme",
            providerId: resolvedProviderId,
            status: "error",
            message: msmeResolveError.message,
          });
        }
        resolvedInternalMsmeUuid = resolvedMsme?.id ?? null;
      }
    }

    let resolvedAssociationId = providerContext.association_id ?? null;
    if (!resolvedAssociationId && resolvedInternalMsmeUuid) {
      const { data: msmeAssociation, error: associationLookupError } = await supabase
        .from("msmes")
        .select("association_id")
        .eq("id", resolvedInternalMsmeUuid)
        .maybeSingle();

      if (associationLookupError) {
        safeComplaintError("association_lookup_error", {
          operation: "resolve_association",
          providerId: resolvedProviderId,
          status: "error",
          message: associationLookupError.message,
        });
      }

      resolvedAssociationId = msmeAssociation?.association_id ?? null;
    }

    safeComplaintLog("resolved_identifiers", {
      operation: "resolve_complaint_linkage",
      providerId: resolvedProviderId,
      status: resolvedInternalMsmeUuid ? "resolved" : "missing_msme",
      associationLinked: Boolean(resolvedAssociationId),
    });

    if (!resolvedInternalMsmeUuid || !UUID_PATTERN.test(resolvedInternalMsmeUuid)) {
      throw new Error(
        "[complaint-submit] internal_msme_uuid_resolution_failed"
      );
    }

    let evidenceAttachmentRecord: {
      bucket: string;
      storagePath: string;
      originalName: string;
      sizeBytes: number;
      mimeType: string | null;
    } | null = null;
    let warningMessage: string | null = null;
    const complaintReference = generateComplaintReference();
    const complaintInsertPayload = {
      msme_id: resolvedInternalMsmeUuid,
      provider_msme_id: resolvedInternalMsmeUuid,
      association_id: resolvedAssociationId,
      provider_id: resolvedProviderId,
      provider_profile_id: resolvedProviderId,
      provider_business_name: providerContext.provider?.display_name ?? null,
      complainant_name,
      complainant_email,
      complainant_phone,
      preferred_contact_method,
      complaint_type,
      complaint_category: complaint_type,
      category: complaint_type,
      title: summary,
      summary,
      description,
      severity,
      priority: severity,
      complaint_reference: complaintReference,
      source_channel: "marketplace_public_profile",
      regulator_target: "fccpc",
      reporter_name: complainant_name,
      reporter_email: complainant_email,
      related_reference: related_reference || null,
      created_by_role: "public",
      created_at: new Date().toISOString(),
      status: normalizeFccpcStatus("submitted"),
    };

    const postInsertSelectClause = "id,msme_id,association_id,status,complaint_type";

    const { data: complaintRow, error: complaintInsertError } = await supabase
      .from("complaints")
      .insert(complaintInsertPayload)
      .select(postInsertSelectClause)
      .single();

    safeComplaintLog("insert_result", {
      operation: "insert_complaint",
      providerId: resolvedProviderId,
      status: complaintInsertError ? "error" : "created",
      ok: !complaintInsertError && Boolean(complaintRow),
      complaintId: complaintRow?.id ?? null,
      error: complaintInsertError
        ? {
            message: complaintInsertError.message,
          }
        : null,
    });

    if (complaintInsertError || !complaintRow) {
      throw new Error(
        `[complaint-submit] complaint_insert_failed: ${complaintInsertError?.message ?? "Unknown insert error"}`
      );
    }

    await createComplaintStatusHistory({
      complaintId: complaintRow.id,
      fromStatus: null,
      toStatus: normalizeFccpcStatus(complaintInsertPayload.status),
      changedByUserId: null,
      changedByRole: "public",
      note: "Public complaint submitted.",
      metadata: {
        source: "public_complaint_form",
        preferred_contact_method: preferred_contact_method || null,
        related_reference: related_reference || null,
      },
    });

    safeComplaintLog("inserted_row_linkage", {
      operation: "insert_complaint",
      id: complaintRow?.id ?? null,
      complaintId: complaintRow.id,
      providerId: resolvedProviderId,
      status: complaintRow?.status ?? "created",
      associationLinked: Boolean(complaintRow?.association_id),
    });

    if (evidenceAttachment instanceof File && evidenceAttachment.size > 0) {
      try {
        const evidenceBucket = resolveEvidenceBucketName();
        const safeFileName = sanitizeEvidenceFileName(evidenceAttachment.name);
        const storagePath = `${resolvedInternalMsmeUuid}/${resolvedProviderId}/${Date.now()}-${safeFileName}`;
        const contentType = evidenceAttachment.type || "application/octet-stream";
        const fileBytes = new Uint8Array(await evidenceAttachment.arrayBuffer());

        const { data: existingBucket, error: bucketLookupError } = await supabase.storage.getBucket(evidenceBucket);
        if (bucketLookupError) {
          safeComplaintError("evidence_bucket_lookup_error", {
            operation: "upload_evidence",
            complaintId: complaintRow.id,
            providerId: resolvedProviderId,
            status: "error",
            bucket: evidenceBucket,
            error: toStorageErrorLog(bucketLookupError),
          });
        }

        if (!existingBucket) {
          const { error: createBucketError } = await supabase.storage.createBucket(evidenceBucket, {
            public: false,
            fileSizeLimit: `${MAX_EVIDENCE_FILE_BYTES}`,
            allowedMimeTypes: Array.from(ALLOWED_EVIDENCE_MIME_TYPES),
          });

          if (createBucketError) {
            throw new Error(`[complaint-submit] evidence_bucket_prepare_failed: ${createBucketError.message}`);
          }

          safeComplaintLog("evidence_bucket_created", {
            operation: "prepare_evidence_bucket",
            complaintId: complaintRow.id,
            providerId: resolvedProviderId,
            status: "created",
            bucket: evidenceBucket,
          });
        } else {
          safeComplaintLog("evidence_bucket_ready", {
            operation: "prepare_evidence_bucket",
            complaintId: complaintRow.id,
            providerId: resolvedProviderId,
            status: "ready",
            bucket: evidenceBucket,
          });
        }

        const { error: uploadError } = await supabase.storage.from(evidenceBucket).upload(storagePath, fileBytes, {
          contentType,
          upsert: false,
        });

        if (uploadError) {
          throw new Error(`[complaint-submit] evidence_upload_failed: ${uploadError.message}`);
        }

        evidenceAttachmentRecord = {
          originalName: evidenceAttachment.name,
          sizeBytes: evidenceAttachment.size,
          mimeType: evidenceAttachment.type || null,
          bucket: evidenceBucket,
          storagePath,
        };
      } catch (evidenceError) {
        warningMessage = "Complaint saved, but evidence upload failed.";
        safeComplaintError("evidence_non_blocking_error", {
          operation: "upload_evidence",
          complaintId: complaintRow.id,
          providerId: resolvedProviderId,
          status: "error",
          message: evidenceError instanceof Error ? evidenceError.message : "evidence_upload_failed",
        });
      }
    }

    if (evidenceAttachmentRecord) {
      const attachmentUrl = `supabase://${evidenceAttachmentRecord.bucket}/${evidenceAttachmentRecord.storagePath}`;
      const { error: attachmentInsertError } = await supabase.from("complaint_attachments").insert({
        complaint_id: complaintRow.id,
        file_url: attachmentUrl,
        file_name: evidenceAttachmentRecord.originalName,
        visibility: "shared",
        uploaded_by_role: "public",
      });

      safeComplaintLog("attachment_insert_result", {
        operation: "link_evidence_attachment",
        ok: !attachmentInsertError,
        complaintId: complaintRow.id,
        providerId: resolvedProviderId,
        status: attachmentInsertError ? "error" : "linked",
        error: attachmentInsertError
          ? {
              message: attachmentInsertError.message,
            }
          : null,
      });

      if (attachmentInsertError) {
        warningMessage = "Complaint saved, but evidence attachment could not be linked.";
      }
    }

    revalidatePath(`/providers/${providerPathSegment}`);
    if (canonicalSlug !== providerPathSegment) {
      revalidatePath(`/providers/${canonicalSlug}`);
    }

    return NextResponse.json({
      ok: true,
      redirectPath: `/providers/${canonicalSlug}/complaints/success?ref=${encodeURIComponent(complaintReference)}`,
      warning: warningMessage,
    });
  } catch (error) {
    safeComplaintError("submit_pipeline_error", {
      operation: "public_complaint_submit",
      providerId: null,
      status: "error",
      message: error instanceof Error ? error.message : "submit_failed",
    });
    return NextResponse.json(
      { ok: false, code: "submit_failed", message: "We could not submit your complaint right now. Please retry." },
      { status: 500 }
    );
  }
}
