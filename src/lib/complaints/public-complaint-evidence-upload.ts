import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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

const EVIDENCE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_COMPLAINT_EVIDENCE_BUCKET || "complaint-evidence";

function extractFileExtension(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();
  return extension ?? "";
}

function isAllowedEvidenceFile(file: File) {
  const extension = extractFileExtension(file.name);
  const mimeType = (file.type || "").toLowerCase();
  return ALLOWED_EVIDENCE_EXTENSIONS.has(extension) && ALLOWED_EVIDENCE_MIME_TYPES.has(mimeType);
}

export function validatePublicComplaintEvidenceFile(file: File) {
  if (file.size > MAX_EVIDENCE_FILE_BYTES) {
    return { ok: false as const, error: "file_too_large" as const };
  }

  if (!isAllowedEvidenceFile(file)) {
    return { ok: false as const, error: "unsupported_file_type" as const };
  }

  return { ok: true as const };
}

export async function uploadPublicComplaintEvidence(params: {
  file: File;
  providerProfileId: string;
  providerMsmePublicId: string;
}) {
  const validationResult = validatePublicComplaintEvidenceFile(params.file);
  if (!validationResult.ok) {
    throw new Error(validationResult.error);
  }

  const supabase = createSupabaseBrowserClient();
  const safeFileName = params.file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const storagePath = `${params.providerMsmePublicId}/${params.providerProfileId}/${Date.now()}-${safeFileName}`;

  const { error: uploadError } = await supabase.storage.from(EVIDENCE_BUCKET).upload(storagePath, params.file, {
    contentType: params.file.type || "application/octet-stream",
    upsert: false,
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: publicUrlData } = supabase.storage.from(EVIDENCE_BUCKET).getPublicUrl(storagePath);

  console.log("uploaded evidence file:", storagePath);

  return {
    bucket: EVIDENCE_BUCKET,
    storagePath,
    publicUrl: publicUrlData.publicUrl,
    originalName: params.file.name,
    sizeBytes: params.file.size,
    mimeType: params.file.type || null,
  };
}

export { MAX_EVIDENCE_FILE_BYTES };
