import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { resolveProviderPublicContext } from "@/lib/data/provider-profile-resolver";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_EVIDENCE_FILE_BYTES = 10 * 1024 * 1024;
const DEFAULT_EVIDENCE_BUCKET = "complaint-evidence";
const ALLOWED_EVIDENCE_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg", "doc", "docx"]);
const ALLOWED_EVIDENCE_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpg",
  "image/jpeg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

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

export async function POST(request: Request) {
  const formData = await request.formData();
  const providerPathSegment = String(formData.get("provider_path_segment") ?? "").trim();

  if (!providerPathSegment) {
    return NextResponse.json(
      { ok: false, code: "missing_provider", message: "Provider route segment is required." },
      { status: 400 }
    );
  }

  const complainant_name = String(formData.get("full_name") ?? "").trim();
  const complainant_email = String(formData.get("email") ?? "").trim();
  const complainant_phone = String(formData.get("phone") ?? "").trim();
  const preferred_contact_method = String(formData.get("preferred_contact_method") ?? "email").trim() || "email";
  const complaint_type = String(formData.get("complaint_type") ?? "").trim();
  const priority = String(formData.get("priority") ?? "").trim();
  const normalizedPriority = priority || "medium";
  const summary = String(formData.get("short_summary") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const related_reference = String(formData.get("related_reference") ?? "").trim();
  const consent_confirmation = String(formData.get("consent_confirmation") ?? "").trim();
  const providerProfileId = String(formData.get("provider_profile_id") ?? "").trim();
  const providerMsmePublicId = String(formData.get("provider_msme_public_id") ?? "").trim();
  const formProviderSlug = String(formData.get("provider_slug") ?? "").trim();
  const evidenceAttachment = formData.get("evidence_attachment");

  console.info("[complaint-submit][payload]", {
    providerPathSegment,
    complainant_name,
    complainant_email,
    complainant_phone,
    preferred_contact_method,
    complaint_type,
    priority: normalizedPriority,
    summary,
    description,
    related_reference,
    consent_confirmation,
    hidden_provider_profile_id: providerProfileId,
    hidden_provider_msme_public_id: providerMsmePublicId,
    hidden_provider_slug: formProviderSlug,
    hasEvidenceAttachment: evidenceAttachment instanceof File && evidenceAttachment.size > 0,
  });

  if (!complainant_name || !description || !summary || !consent_confirmation || !complaint_type) {
    return NextResponse.json(
      { ok: false, code: "missing_fields", message: "Please complete all required complaint fields." },
      { status: 400 }
    );
  }

  if (evidenceAttachment instanceof File && evidenceAttachment.size > 0) {
    if (evidenceAttachment.size > MAX_EVIDENCE_FILE_BYTES) {
      return NextResponse.json(
        { ok: false, code: "file_too_large", message: "Evidence file is too large. Maximum allowed size is 10 MB." },
        { status: 400 }
      );
    }
    if (!isEvidenceFileAllowed(evidenceAttachment)) {
      return NextResponse.json(
        {
          ok: false,
          code: "unsupported_file_type",
          message: "Unsupported evidence file type. Allowed formats: PDF, PNG, JPG, JPEG, DOC, DOCX.",
        },
        { status: 400 }
      );
    }
  }

  const supabase = await createServiceRoleSupabaseClient();

  try {
    const providerContext = await resolveProviderPublicContext({
      providerRouteParam: providerPathSegment,
    });

    console.info("[complaint-submit][provider_resolution]", {
      providerPathSegment,
      found: Boolean(providerContext.provider),
      providerProfile: providerContext.provider,
      resolvedProviderProfileId: providerContext.provider_profile_id,
      resolvedProviderMsmeId: providerContext.provider_profile_msme_id,
      resolvedAssociationId: providerContext.association_id,
    });

    if (!providerContext.provider_profile_id) {
      return NextResponse.json(
        { ok: false, code: "provider_not_found", message: "Provider profile could not be resolved." },
        { status: 404 }
      );
    }

    const resolvedProviderId = providerContext.provider_profile_id;
    const canonicalSlug = providerContext.provider?.public_slug ?? providerPathSegment;
    const providerPublicSlug = providerContext.provider?.public_slug ?? formProviderSlug ?? providerPathSegment;
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
        console.error("[complaint-submit][provider_profile_lookup_error]", {
          providerPathSegment,
          resolvedProviderId,
          message: providerProfileLookupError.message,
          details: providerProfileLookupError.details,
          hint: providerProfileLookupError.hint,
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
          console.error("[complaint-submit][msme_resolution_error]", {
            providerPathSegment,
            providerPublicMsmeId,
            message: msmeResolveError.message,
            details: msmeResolveError.details,
            hint: msmeResolveError.hint,
          });
        }
        resolvedInternalMsmeUuid = resolvedMsme?.id ?? null;
      }
    }

    console.info("[complaint-submit][resolved_identifiers]", {
      providerPathSegment,
      providerPublicSlug,
      providerPublicMsmeId,
      resolvedProviderId,
      resolvedInternalMsmeUuid,
    });

    if (!resolvedInternalMsmeUuid || !UUID_PATTERN.test(resolvedInternalMsmeUuid)) {
      throw new Error(
        `[complaint-submit] internal_msme_uuid_resolution_failed provider=${providerPathSegment} publicMsmeId=${providerPublicMsmeId ?? "n/a"}`
      );
    }

    let evidenceAttachmentRecord: {
      bucket: string;
      storagePath: string;
      originalName: string;
      sizeBytes: number;
      mimeType: string | null;
    } | null = null;

    if (evidenceAttachment instanceof File && evidenceAttachment.size > 0) {
      const evidenceBucket = resolveEvidenceBucketName();
      const safeFileName = sanitizeEvidenceFileName(evidenceAttachment.name);
      const storagePath = `${resolvedInternalMsmeUuid}/${resolvedProviderId}/${Date.now()}-${safeFileName}`;
      const contentType = evidenceAttachment.type || "application/octet-stream";
      const fileBytes = new Uint8Array(await evidenceAttachment.arrayBuffer());

      const { data: existingBucket, error: bucketLookupError } = await supabase.storage.getBucket(evidenceBucket);
      if (bucketLookupError) {
        console.error("[complaint-submit][evidence_bucket_lookup_error]", {
          bucket: evidenceBucket,
          error: toStorageErrorLog(bucketLookupError),
        });
      }

      if (!existingBucket) {
        const { data: createdBucket, error: createBucketError } = await supabase.storage.createBucket(evidenceBucket, {
          public: false,
          fileSizeLimit: `${MAX_EVIDENCE_FILE_BYTES}`,
          allowedMimeTypes: Array.from(ALLOWED_EVIDENCE_MIME_TYPES),
        });

        if (createBucketError) {
          console.error("[complaint-submit][evidence_bucket_create_error]", {
            bucket: evidenceBucket,
            error: toStorageErrorLog(createBucketError),
          });
          throw new Error(`[complaint-submit] evidence_bucket_prepare_failed: ${createBucketError.message}`);
        }

        console.info("[complaint-submit][evidence_bucket_created]", {
          bucket: evidenceBucket,
          id: createdBucket?.name ?? null,
        });
      } else {
        console.info("[complaint-submit][evidence_bucket_ready]", {
          bucket: evidenceBucket,
          id: existingBucket.name,
        });
      }

      console.info("[complaint-submit][file_metadata]", {
        originalName: evidenceAttachment.name,
        sanitizedFileName: safeFileName,
        mimeType: evidenceAttachment.type || null,
        contentType,
        fileSizeBytes: evidenceAttachment.size,
        bucket: evidenceBucket,
        storagePath,
      });

      const { error: uploadError } = await supabase.storage.from(evidenceBucket).upload(storagePath, fileBytes, {
        contentType,
        upsert: false,
      });

      console.info("[complaint-submit][storage_upload_result]", {
        ok: !uploadError,
        bucket: evidenceBucket,
        storagePath,
        contentType,
        error: uploadError
          ? toStorageErrorLog(uploadError)
          : null,
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
    }

    const payload = {
      msme_id: resolvedInternalMsmeUuid,
      provider_profile_id: resolvedProviderId,
      complaint_type,
      description,
      status: "open",
      complainant_name,
      complainant_email: complainant_email || null,
      complainant_phone: complainant_phone || null,
      preferred_contact_method,
      related_reference: related_reference || null,
      title: summary,
      summary,
      priority: normalizedPriority,
      severity: normalizedPriority,
      state: null,
      sector: null,
    };

    const { data: complaintRow, error: complaintInsertError } = await supabase
      .from("complaints")
      .insert(payload)
      .select()
      .single();

    console.info("[complaint-submit][insert_result]", {
      ok: !complaintInsertError && Boolean(complaintRow),
      complaintId: complaintRow?.id ?? null,
      error: complaintInsertError
        ? {
            message: complaintInsertError.message,
            details: complaintInsertError.details,
            hint: complaintInsertError.hint,
          }
        : null,
    });

    if (complaintInsertError || !complaintRow) {
      throw new Error(
        `[complaint-submit] complaint_insert_failed: ${complaintInsertError?.message ?? "Unknown insert error"}`
      );
    }

    if (evidenceAttachmentRecord) {
      const attachmentUrl = `supabase://${evidenceAttachmentRecord.bucket}/${evidenceAttachmentRecord.storagePath}`;
      const { error: attachmentInsertError } = await supabase.from("complaint_attachments").insert({
        complaint_id: complaintRow.id,
        file_url: attachmentUrl,
        file_name: evidenceAttachmentRecord.originalName,
        visibility: "shared",
      });

      console.info("[complaint-submit][attachment_insert_result]", {
        ok: !attachmentInsertError,
        complaintId: complaintRow.id,
        attachmentUrl,
        fileName: evidenceAttachmentRecord.originalName,
        fileSizeBytes: evidenceAttachmentRecord.sizeBytes,
        mimeType: evidenceAttachmentRecord.mimeType,
        error: attachmentInsertError
          ? {
              message: attachmentInsertError.message,
              details: attachmentInsertError.details,
              hint: attachmentInsertError.hint,
            }
          : null,
      });
    }

    revalidatePath(`/providers/${providerPathSegment}`);
    if (canonicalSlug !== providerPathSegment) {
      revalidatePath(`/providers/${canonicalSlug}`);
    }

    return NextResponse.json({
      ok: true,
      redirectPath: `/providers/${canonicalSlug}?notice=complaint_submitted`,
    });
  } catch (error) {
    console.error("[complaint-submit][submit_pipeline_error]", {
      providerPathSegment,
      error,
    });
    return NextResponse.json(
      { ok: false, code: "submit_failed", message: "We could not submit your complaint right now. Please retry." },
      { status: 500 }
    );
  }
}
