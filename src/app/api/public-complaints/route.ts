import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { resolveProviderPublicContext } from "@/lib/data/provider-profile-resolver";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_EVIDENCE_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EVIDENCE_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg", "doc", "docx"]);
const ALLOWED_EVIDENCE_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpg",
  "image/jpeg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function buildProviderRedirect(request: Request, providerSlug: string, status: string, key = "reported_error") {
  const redirectUrl = new URL(`/providers/${providerSlug}`, request.url);
  redirectUrl.searchParams.set(key, status);
  return NextResponse.redirect(redirectUrl);
}

function extractFileExtension(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();
  return extension ?? "";
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
    return NextResponse.redirect(new URL("/search?complaint=missing_provider", request.url));
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
    return buildProviderRedirect(request, providerPathSegment, "missing_fields");
  }

  if (evidenceAttachment instanceof File && evidenceAttachment.size > 0) {
    if (evidenceAttachment.size > MAX_EVIDENCE_FILE_BYTES) {
      return buildProviderRedirect(request, providerPathSegment, "file_too_large");
    }
    if (!isEvidenceFileAllowed(evidenceAttachment)) {
      return buildProviderRedirect(request, providerPathSegment, "unsupported_file_type");
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
      return buildProviderRedirect(request, providerPathSegment, "provider_not_found");
    }

    const resolvedProviderId = providerContext.provider_profile_id;
    const canonicalSlug = providerContext.provider?.public_slug ?? providerPathSegment;
    const providerPublicSlug = providerContext.provider?.public_slug ?? formProviderSlug ?? providerPathSegment;
    const providerPublicMsmeId = providerMsmePublicId || providerContext.provider?.msme_id || null;

    let resolvedInternalMsmeUuid = providerContext.provider_profile_msme_id;

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

    let evidenceAttachmentMetadata: Record<string, unknown> | null = null;

    if (evidenceAttachment instanceof File && evidenceAttachment.size > 0) {
      const evidenceBucket = process.env.SUPABASE_COMPLAINT_EVIDENCE_BUCKET || "complaint-evidence";
      const safeFileName = evidenceAttachment.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const storagePath = `${resolvedInternalMsmeUuid}/${resolvedProviderId}/${Date.now()}-${safeFileName}`;
      const fileBuffer = Buffer.from(await evidenceAttachment.arrayBuffer());

      console.info("[complaint-submit][file_metadata]", {
        name: evidenceAttachment.name,
        size: evidenceAttachment.size,
        type: evidenceAttachment.type,
        bucket: evidenceBucket,
        storagePath,
      });

      const { error: uploadError } = await supabase.storage.from(evidenceBucket).upload(storagePath, fileBuffer, {
        contentType: evidenceAttachment.type || "application/octet-stream",
        upsert: false,
      });

      console.info("[complaint-submit][storage_upload_result]", {
        ok: !uploadError,
        bucket: evidenceBucket,
        storagePath,
        error: uploadError
          ? {
              message: uploadError.message,
              name: uploadError.name,
            }
          : null,
      });

      if (uploadError) {
        throw new Error(`[complaint-submit] evidence_upload_failed: ${uploadError.message}`);
      }

      evidenceAttachmentMetadata = {
        original_name: evidenceAttachment.name,
        size_bytes: evidenceAttachment.size,
        mime_type: evidenceAttachment.type || null,
        bucket: evidenceBucket,
        storage_path: storagePath,
        upload_status: "uploaded",
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
      metadata: {
        provider_public_slug: providerPublicSlug,
        provider_public_msme_code: providerPublicMsmeId,
        quote_invoice_order_reference: related_reference || null,
        complaint_contact: {
          full_name: complainant_name,
          email: complainant_email || null,
          phone: complainant_phone || null,
          preferred_contact_method,
        },
        evidence_attachment: evidenceAttachmentMetadata,
      },
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

    revalidatePath(`/providers/${providerPathSegment}`);
    if (canonicalSlug !== providerPathSegment) {
      revalidatePath(`/providers/${canonicalSlug}`);
    }

    const redirectUrl = new URL(`/providers/${canonicalSlug}`, request.url);
    redirectUrl.searchParams.set("notice", "complaint_submitted");
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("[complaint-submit][submit_pipeline_error]", {
      providerPathSegment,
      error,
    });
    return buildProviderRedirect(request, providerPathSegment, "submit_failed");
  }
}
