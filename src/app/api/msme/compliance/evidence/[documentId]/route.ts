import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  COMPLIANCE_EVIDENCE_SIGNED_URL_SECONDS,
  canAccessComplianceEvidence,
  logComplianceDocumentEvent,
  logComplianceEvidenceDiagnostic,
  toSupabaseErrorInfo,
  type ComplianceEvidenceDocument,
} from "@/lib/data/compliance-evidence";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function loadAuthorizedDocument(documentId: string) {
  const ctx = await getCurrentUserContext();
  if (!ctx.appUserId || ctx.role === "public") {
    return { ctx, document: null, response: NextResponse.json({ ok: false, code: "unauthorized", error: "Unauthorized" }, { status: 401 }) };
  }

  const supabase = await createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("compliance_documents")
    .select("id,msme_id,compliance_item_id,regulator_id,requirement_id,document_type,original_filename,storage_bucket,storage_path,mime_type,file_size_bytes,checksum_sha256,uploaded_by,uploaded_at,verified_at,expires_at,is_deleted,deleted_at,metadata,created_at,updated_at")
    .eq("id", documentId)
    .maybeSingle();

  if (error || !data || data.is_deleted) {
    const errorInfo = toSupabaseErrorInfo(error ?? "document_not_found");
    logComplianceEvidenceDiagnostic({
      operation: "document_lookup_failed",
      msmeId: data?.msme_id ?? null,
      complianceItemId: data?.compliance_item_id ?? null,
      supabaseErrorCode: errorInfo.code,
      supabaseErrorMessage: errorInfo.message,
    });
    return { ctx, document: null, response: NextResponse.json({ ok: false, code: "document_not_found", error: "Evidence document was not found." }, { status: 404 }) };
  }

  const document = data as ComplianceEvidenceDocument;
  if (!canAccessComplianceEvidence(ctx, document.msme_id)) {
    logComplianceEvidenceDiagnostic({ operation: "document_access_denied", msmeId: document.msme_id, complianceItemId: document.compliance_item_id });
    return { ctx, document: null, response: NextResponse.json({ ok: false, code: "forbidden", error: "You cannot access this evidence document." }, { status: 403 }) };
  }

  return { ctx, document, supabase, response: null };
}

function safeDownloadName(fileName: string) {
  return fileName.replace(/["\r\n]/g, "_");
}

export async function GET(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const disposition = new URL(request.url).searchParams.get("disposition") === "attachment" ? "attachment" : "inline";
  const loaded = await loadAuthorizedDocument(documentId);
  if (loaded.response) return loaded.response;

  const { ctx, document, supabase } = loaded;
  if (!document || !supabase) {
    return NextResponse.json({ ok: false, code: "document_not_found", error: "Evidence document was not found." }, { status: 404 });
  }

  const { data, error } = await supabase.storage.from(document.storage_bucket).createSignedUrl(
    document.storage_path,
    COMPLIANCE_EVIDENCE_SIGNED_URL_SECONDS,
    {
      download: disposition === "attachment" ? safeDownloadName(document.original_filename) : false,
    },
  );

  const signedUrlGenerated = Boolean(data?.signedUrl && !error);
  if (error || !data?.signedUrl) {
    const errorInfo = toSupabaseErrorInfo(error ?? "signed_url_missing");
    logComplianceEvidenceDiagnostic({
      operation: disposition === "attachment" ? "download_signed_url_failed" : "preview_signed_url_failed",
      msmeId: document.msme_id,
      complianceItemId: document.compliance_item_id,
      mimeType: document.mime_type,
      fileSize: document.file_size_bytes,
      signedUrlGenerated,
      supabaseErrorCode: errorInfo.code,
      supabaseErrorMessage: errorInfo.message,
    });
    return NextResponse.json({ ok: false, code: "signed_url_failed", error: "Secure evidence link could not be generated." }, { status: 500 });
  }

  await logComplianceDocumentEvent(supabase, {
    documentId: document.id,
    msmeId: document.msme_id,
    complianceItemId: document.compliance_item_id,
    regulatorId: document.regulator_id,
    requirementId: document.requirement_id,
    eventType: disposition === "attachment" ? "downloaded" : "previewed",
    actorUserId: ctx.appUserId,
    actorRole: ctx.role,
    summary: disposition === "attachment" ? "Compliance evidence downloaded." : "Compliance evidence previewed.",
    metadata: { disposition, mime_type: document.mime_type },
  });

  logComplianceEvidenceDiagnostic({
    operation: disposition === "attachment" ? "download_signed_url_created" : "preview_signed_url_created",
    msmeId: document.msme_id,
    complianceItemId: document.compliance_item_id,
    mimeType: document.mime_type,
    fileSize: document.file_size_bytes,
    signedUrlGenerated: true,
  });

  return NextResponse.redirect(data.signedUrl, 302);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const loaded = await loadAuthorizedDocument(documentId);
  if (loaded.response) return loaded.response;

  const { ctx, document, supabase } = loaded;
  if (!document || !supabase) {
    return NextResponse.json({ ok: false, code: "document_not_found", error: "Evidence document was not found." }, { status: 404 });
  }

  if (!["msme", "admin"].includes(ctx.role)) {
    logComplianceEvidenceDiagnostic({ operation: "delete_role_denied", msmeId: document.msme_id, complianceItemId: document.compliance_item_id, deleteSucceeded: false });
    return NextResponse.json({ ok: false, code: "forbidden", error: "Only the MSME owner or admin can delete evidence." }, { status: 403 });
  }

  const { error: removeError } = await supabase.storage.from(document.storage_bucket).remove([document.storage_path]);
  if (removeError) {
    const errorInfo = toSupabaseErrorInfo(removeError);
    logComplianceEvidenceDiagnostic({
      operation: "storage_delete_failed",
      msmeId: document.msme_id,
      complianceItemId: document.compliance_item_id,
      mimeType: document.mime_type,
      fileSize: document.file_size_bytes,
      deleteSucceeded: false,
      supabaseErrorCode: errorInfo.code,
      supabaseErrorMessage: errorInfo.message,
    });
    return NextResponse.json({ ok: false, code: "delete_failed", error: "Evidence file could not be deleted from storage." }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from("compliance_documents")
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq("id", document.id)
    .eq("msme_id", document.msme_id);

  if (updateError) {
    const errorInfo = toSupabaseErrorInfo(updateError);
    logComplianceEvidenceDiagnostic({
      operation: "metadata_soft_delete_failed",
      msmeId: document.msme_id,
      complianceItemId: document.compliance_item_id,
      mimeType: document.mime_type,
      fileSize: document.file_size_bytes,
      deleteSucceeded: false,
      supabaseErrorCode: errorInfo.code,
      supabaseErrorMessage: errorInfo.message,
    });
    return NextResponse.json({ ok: false, code: "delete_failed", error: "Evidence metadata could not be marked deleted." }, { status: 500 });
  }

  await logComplianceDocumentEvent(supabase, {
    documentId: document.id,
    msmeId: document.msme_id,
    complianceItemId: document.compliance_item_id,
    regulatorId: document.regulator_id,
    requirementId: document.requirement_id,
    eventType: "deleted",
    actorUserId: ctx.appUserId,
    actorRole: ctx.role,
    summary: "Compliance evidence deleted.",
    metadata: { mime_type: document.mime_type, file_size_bytes: document.file_size_bytes },
  });

  logComplianceEvidenceDiagnostic({
    operation: "delete_success",
    msmeId: document.msme_id,
    complianceItemId: document.compliance_item_id,
    mimeType: document.mime_type,
    fileSize: document.file_size_bytes,
    deleteSucceeded: true,
  });

  revalidatePath("/dashboard/msme/compliance");
  return NextResponse.json({ ok: true });
}
