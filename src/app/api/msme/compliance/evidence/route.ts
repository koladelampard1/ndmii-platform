import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getCredentialedCorsHeaders } from "@/lib/http/cors";
import {
  COMPLIANCE_EVIDENCE_BUCKET,
  COMPLIANCE_EVIDENCE_SIGNED_URL_SECONDS,
  canAccessComplianceEvidence,
  computeSha256,
  ensureComplianceEvidenceBucket,
  logComplianceDocumentEvent,
  logComplianceEvidenceDiagnostic,
  sanitizeComplianceEvidenceFileName,
  toSupabaseErrorInfo,
  validateComplianceEvidenceFile,
} from "@/lib/data/compliance-evidence";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ComplianceItemRow = {
  id: string;
  msme_id: string;
  regulator_id: string;
  requirement_id: string;
};

export async function POST(request: Request) {
  const corsHeaders = getCredentialedCorsHeaders(request, ["POST", "OPTIONS"]);
  let msmeId: string | null = null;
  let complianceItemId: string | null = null;
  let mimeType: string | null = null;
  let fileSize: number | null = null;
  let storagePath: string | null = null;

  try {
    const ctx = await getCurrentUserContext();
    if (!ctx.appUserId || !["msme", "admin", "reviewer"].includes(ctx.role)) {
      return NextResponse.json({ ok: false, code: "unauthorized", error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const formData = await request.formData();
    complianceItemId = String(formData.get("compliance_item_id") ?? "").trim();
    const documentType = String(formData.get("document_type") ?? "evidence").trim().replace(/[^a-zA-Z0-9_-]/g, "_") || "evidence";
    const expiresAtValue = String(formData.get("expires_at") ?? "").trim();
    const file = formData.get("evidence");

    if (!complianceItemId) {
      return NextResponse.json({ ok: false, code: "compliance_item_required", error: "Compliance item is required." }, { status: 400, headers: corsHeaders });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, code: "file_required", error: "Choose a compliance evidence file to upload." }, { status: 400, headers: corsHeaders });
    }

    mimeType = file.type || null;
    fileSize = file.size;
    const validation = validateComplianceEvidenceFile(file);
    if (!validation.ok) {
      logComplianceEvidenceDiagnostic({ operation: "upload_validate", complianceItemId, mimeType, fileSize, uploadSucceeded: false });
      return NextResponse.json({ ok: false, code: validation.code, error: validation.message }, { status: 400, headers: corsHeaders });
    }

    const supabase = await createServiceRoleSupabaseClient();
    const { data: item, error: itemError } = await supabase
      .from("msme_compliance_items")
      .select("id,msme_id,regulator_id,requirement_id")
      .eq("id", complianceItemId)
      .maybeSingle();

    if (itemError || !item) {
      const errorInfo = toSupabaseErrorInfo(itemError ?? "compliance_item_not_found");
      logComplianceEvidenceDiagnostic({
        operation: "item_lookup_failed",
        complianceItemId,
        mimeType,
        fileSize,
        uploadSucceeded: false,
        supabaseErrorCode: errorInfo.code,
        supabaseErrorMessage: errorInfo.message,
      });
      return NextResponse.json({ ok: false, code: "compliance_item_not_found", error: "Compliance requirement was not found." }, { status: 404, headers: corsHeaders });
    }

    const complianceItem = item as ComplianceItemRow;
    msmeId = complianceItem.msme_id;

    if (!canAccessComplianceEvidence(ctx, msmeId)) {
      logComplianceEvidenceDiagnostic({ operation: "ownership_denied", msmeId, complianceItemId, mimeType, fileSize, uploadSucceeded: false });
      return NextResponse.json({ ok: false, code: "forbidden", error: "You cannot upload evidence for this MSME." }, { status: 403, headers: corsHeaders });
    }

    const bucketReady = await ensureComplianceEvidenceBucket(supabase);
    if (!bucketReady) {
      return NextResponse.json({ ok: false, code: "bucket_unavailable", error: "Compliance evidence storage is not configured." }, { status: 500, headers: corsHeaders });
    }

    const buffer = await file.arrayBuffer();
    const checksumSha256 = await computeSha256(buffer);
    const safeName = sanitizeComplianceEvidenceFileName(file.name);
    storagePath = `${msmeId}/${complianceItemId}/${Date.now()}-${randomUUID()}-${safeName}`;

    const { error: uploadError } = await supabase.storage.from(COMPLIANCE_EVIDENCE_BUCKET).upload(storagePath, Buffer.from(buffer), {
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      const errorInfo = toSupabaseErrorInfo(uploadError);
      logComplianceEvidenceDiagnostic({
        operation: "storage_upload",
        msmeId,
        complianceItemId,
        mimeType,
        fileSize,
        uploadSucceeded: false,
        supabaseErrorCode: errorInfo.code,
        supabaseErrorMessage: errorInfo.message,
      });
      return NextResponse.json({ ok: false, code: "upload_failed", error: "Evidence upload failed. Please try again." }, { status: 500, headers: corsHeaders });
    }

    const { data: inserted, error: insertError } = await supabase
      .from("compliance_documents")
      .insert({
        msme_id: msmeId,
        compliance_item_id: complianceItem.id,
        regulator_id: complianceItem.regulator_id,
        requirement_id: complianceItem.requirement_id,
        document_type: documentType,
        original_filename: safeName,
        storage_bucket: COMPLIANCE_EVIDENCE_BUCKET,
        storage_path: storagePath,
        mime_type: file.type,
        file_size_bytes: file.size,
        checksum_sha256: checksumSha256,
        uploaded_by: ctx.appUserId,
        expires_at: expiresAtValue ? new Date(expiresAtValue).toISOString() : null,
        metadata: { phase: "phase2", source: "msme_compliance_upload" },
      })
      .select("id")
      .single();

    if (insertError || !inserted?.id) {
      const { error: cleanupError } = await supabase.storage.from(COMPLIANCE_EVIDENCE_BUCKET).remove([storagePath]);
      const errorInfo = toSupabaseErrorInfo(insertError ?? "document_insert_failed");
      const cleanupInfo = cleanupError ? toSupabaseErrorInfo(cleanupError) : null;
      logComplianceEvidenceDiagnostic({
        operation: cleanupError ? "metadata_insert_storage_rollback_failed" : "metadata_insert_storage_rollback",
        msmeId,
        complianceItemId,
        mimeType,
        fileSize,
        uploadSucceeded: true,
        supabaseErrorCode: cleanupInfo?.code ?? errorInfo.code,
        supabaseErrorMessage: cleanupInfo?.message ?? errorInfo.message,
      });
      return NextResponse.json({ ok: false, code: "save_failed", error: "Evidence metadata could not be saved. Please retry." }, { status: 500, headers: corsHeaders });
    }

    await logComplianceDocumentEvent(supabase, {
      documentId: inserted.id,
      msmeId,
      complianceItemId,
      regulatorId: complianceItem.regulator_id,
      requirementId: complianceItem.requirement_id,
      eventType: "uploaded",
      actorUserId: ctx.appUserId,
      actorRole: ctx.role,
      summary: "Compliance evidence uploaded.",
      metadata: { document_type: documentType, mime_type: file.type, file_size_bytes: file.size },
    });

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(COMPLIANCE_EVIDENCE_BUCKET)
      .createSignedUrl(storagePath, COMPLIANCE_EVIDENCE_SIGNED_URL_SECONDS);
    const signedUrlGenerated = Boolean(signedUrlData?.signedUrl && !signedUrlError);
    if (signedUrlError) {
      const errorInfo = toSupabaseErrorInfo(signedUrlError);
      logComplianceEvidenceDiagnostic({
        operation: "signed_url_after_upload",
        msmeId,
        complianceItemId,
        mimeType,
        fileSize,
        uploadSucceeded: true,
        signedUrlGenerated: false,
        supabaseErrorCode: errorInfo.code,
        supabaseErrorMessage: errorInfo.message,
      });
    }

    logComplianceEvidenceDiagnostic({ operation: "upload_success", msmeId, complianceItemId, mimeType, fileSize, uploadSucceeded: true, signedUrlGenerated });

    revalidatePath("/dashboard/msme/compliance");
    return NextResponse.json(
      {
        ok: true,
        documentId: inserted.id,
        signedUrlGenerated,
        signedUrlExpiresIn: COMPLIANCE_EVIDENCE_SIGNED_URL_SECONDS,
        previewUrl: `/api/msme/compliance/evidence/${inserted.id}?disposition=inline`,
        downloadUrl: `/api/msme/compliance/evidence/${inserted.id}?disposition=attachment`,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    const errorInfo = toSupabaseErrorInfo(error);
    logComplianceEvidenceDiagnostic({
      operation: "unexpected_upload_failure",
      msmeId,
      complianceItemId,
      mimeType,
      fileSize,
      uploadSucceeded: false,
      supabaseErrorCode: errorInfo.code,
      supabaseErrorMessage: errorInfo.message,
    });
    if (storagePath) {
      try {
        const supabase = await createServiceRoleSupabaseClient();
        await supabase.storage.from(COMPLIANCE_EVIDENCE_BUCKET).remove([storagePath]);
      } catch {
        // Best-effort rollback only; keep diagnostics free of document contents.
      }
    }
    return NextResponse.json({ ok: false, code: "upload_failed", error: "Unable to upload compliance evidence right now." }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: getCredentialedCorsHeaders(request, ["POST", "OPTIONS"]),
  });
}
