const MAX_PROVIDER_LOGO_BYTES = 2 * 1024 * 1024;

const ALLOWED_PROVIDER_LOGO_EXTENSIONS = new Set(["jpg", "jpeg", "png", "svg", "webp"]);
const ALLOWED_PROVIDER_LOGO_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/svg+xml", "image/webp", "image/pjpeg"]);

function extractFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function sanitizeProviderLogoFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

export function validateProviderLogoFile(file: File) {
  if (!file || file.size <= 0) {
    return { ok: false as const, error: "file_required" as const, message: "Please choose a logo image to upload." };
  }

  if (file.size > MAX_PROVIDER_LOGO_BYTES) {
    return {
      ok: false as const,
      error: "file_too_large" as const,
      message: `Logo image must be ${Math.round(MAX_PROVIDER_LOGO_BYTES / (1024 * 1024))}MB or less.`,
    };
  }

  const extension = extractFileExtension(file.name);
  const mimeType = (file.type || "").toLowerCase();

  if (!ALLOWED_PROVIDER_LOGO_EXTENSIONS.has(extension)) {
    return {
      ok: false as const,
      error: "unsupported_file_type" as const,
      message: "Unsupported file type. Use JPG, JPEG, PNG, SVG, or WEBP.",
    };
  }

  if (mimeType && !ALLOWED_PROVIDER_LOGO_MIME_TYPES.has(mimeType)) {
    return {
      ok: false as const,
      error: "unsupported_file_type" as const,
      message: "Unsupported file type. Use JPG, JPEG, PNG, SVG, or WEBP.",
    };
  }

  return { ok: true as const };
}

export { MAX_PROVIDER_LOGO_BYTES };
