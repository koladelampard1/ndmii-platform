const MAX_PASSPORT_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PASSPORT_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const ALLOWED_PASSPORT_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function extractFileExtension(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();
  return extension ?? "";
}

export function validatePassportPhotoFile(file: File) {
  if (file.size > MAX_PASSPORT_FILE_BYTES) {
    return {
      ok: false as const,
      error: "file_too_large" as const,
      message: "Passport photo must be 5MB or smaller.",
    };
  }

  const extension = extractFileExtension(file.name);
  const mimeType = (file.type || "").toLowerCase();

  if (!ALLOWED_PASSPORT_EXTENSIONS.has(extension)) {
    return {
      ok: false as const,
      error: "unsupported_file_type" as const,
      message: "Passport photo must be JPG, JPEG, PNG, or WEBP.",
    };
  }

  if (mimeType && !ALLOWED_PASSPORT_MIME_TYPES.has(mimeType)) {
    return {
      ok: false as const,
      error: "unsupported_mime_type" as const,
      message: "Passport photo format is not supported. Use JPG, PNG, or WEBP.",
    };
  }

  return { ok: true as const };
}

export function sanitizePassportFileName(filename: string) {
  return filename.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

export { MAX_PASSPORT_FILE_BYTES };
