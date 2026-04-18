const MAX_PORTFOLIO_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_PORTFOLIO_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const ALLOWED_PORTFOLIO_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/pjpeg"]);

function extractFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function sanitizePortfolioFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

export function validatePortfolioImageFile(file: File) {
  if (!file || file.size <= 0) {
    return { ok: false as const, error: "file_required" as const, message: "Please choose an image file to upload." };
  }

  if (file.size > MAX_PORTFOLIO_IMAGE_BYTES) {
    return {
      ok: false as const,
      error: "file_too_large" as const,
      message: `Image size must be ${Math.round(MAX_PORTFOLIO_IMAGE_BYTES / (1024 * 1024))}MB or less.`,
    };
  }

  const extension = extractFileExtension(file.name);
  const mimeType = (file.type || "").toLowerCase();

  if (!ALLOWED_PORTFOLIO_EXTENSIONS.has(extension)) {
    return {
      ok: false as const,
      error: "unsupported_file_type" as const,
      message: "Unsupported image format. Use JPG, JPEG, PNG, or WEBP.",
    };
  }

  if (mimeType && !ALLOWED_PORTFOLIO_MIME_TYPES.has(mimeType)) {
    return {
      ok: false as const,
      error: "unsupported_file_type" as const,
      message: "Unsupported image format. Use JPG, JPEG, PNG, or WEBP.",
    };
  }

  return { ok: true as const };
}

export { MAX_PORTFOLIO_IMAGE_BYTES };
