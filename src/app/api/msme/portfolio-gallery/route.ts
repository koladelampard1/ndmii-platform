import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { buildProviderGalleryInsertPayload } from "@/lib/data/provider-gallery";
import { getCredentialedCorsHeaders } from "@/lib/http/cors";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_PORTFOLIO_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PORTFOLIO_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const ALLOWED_PORTFOLIO_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/pjpeg"]);
const PORTFOLIO_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_PORTFOLIO_BUCKET || "provider-gallery";

function extractFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function sanitizePortfolioFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function toSupabaseErrorInfo(error: unknown) {
  if (!error || typeof error !== "object") {
    return { code: null, message: String(error) };
  }

  const maybeError = error as { code?: unknown; message?: unknown };
  return {
    code: typeof maybeError.code === "string" ? maybeError.code : null,
    message: typeof maybeError.message === "string" ? maybeError.message : String(maybeError.message ?? "unknown_error"),
  };
}

function logPortfolioDiagnostic(params: { providerProfileId: string; operation: string; error?: unknown }) {
  const errorInfo = params.error ? toSupabaseErrorInfo(params.error) : { code: null, message: null };
  console.info("[msme-portfolio-gallery]", {
    providerProfileId: params.providerProfileId,
    operation: params.operation,
    supabaseErrorCode: errorInfo.code,
    supabaseErrorMessage: errorInfo.message,
  });
}

function validatePortfolioImageFile(file: File) {
  if (!file || file.size <= 0) {
    return { ok: false as const, code: "file_required" as const, message: "Please choose an image file to upload." };
  }

  if (file.size > MAX_PORTFOLIO_IMAGE_BYTES) {
    return { ok: false as const, code: "file_too_large" as const, message: "Image size must be 5MB or less." };
  }

  const extension = extractFileExtension(file.name);
  const mimeType = (file.type || "").toLowerCase();

  if (!ALLOWED_PORTFOLIO_EXTENSIONS.has(extension) || (mimeType && !ALLOWED_PORTFOLIO_MIME_TYPES.has(mimeType))) {
    return { ok: false as const, code: "unsupported_file_type" as const, message: "Unsupported image format. Use JPG, JPEG, PNG, or WEBP." };
  }

  return { ok: true as const };
}

export async function POST(request: Request) {
  const corsHeaders = getCredentialedCorsHeaders(request, ["POST", "OPTIONS"]);
  let providerProfileId = "unresolved";

  try {
    const workspace = await getProviderWorkspaceContext();
    providerProfileId = workspace.provider.id;
    const formData = await request.formData();
    const file = formData.get("asset_file");

    if (!(file instanceof File)) {
      logPortfolioDiagnostic({ providerProfileId, operation: "upload_validate_file_required", error: "file_required" });
      return NextResponse.json(
        { ok: false, code: "file_required", error: "Please choose an image file to upload." },
        { status: 400, headers: corsHeaders },
      );
    }

    const validationResult = validatePortfolioImageFile(file);
    if (!validationResult.ok) {
      logPortfolioDiagnostic({ providerProfileId, operation: "upload_validate", error: validationResult.code });
      return NextResponse.json(
        { ok: false, code: validationResult.code, error: validationResult.message },
        { status: 400, headers: corsHeaders },
      );
    }

    const supabase = await createServiceRoleSupabaseClient();
    const safeName = sanitizePortfolioFileName(file.name);
    const storagePath = `${workspace.msme.id}/${workspace.provider.id}/${Date.now()}-${safeName}`;

    logPortfolioDiagnostic({ providerProfileId, operation: "upload_start" });

    const { data: existingBucket, error: bucketLookupError } = await supabase.storage.getBucket(PORTFOLIO_BUCKET);
    if (bucketLookupError) {
      logPortfolioDiagnostic({ providerProfileId, operation: "bucket_lookup", error: bucketLookupError });
    }

    if (!existingBucket) {
      const { error: createBucketError } = await supabase.storage.createBucket(PORTFOLIO_BUCKET, {
        public: true,
        fileSizeLimit: `${MAX_PORTFOLIO_IMAGE_BYTES}`,
        allowedMimeTypes: Array.from(ALLOWED_PORTFOLIO_MIME_TYPES),
      });

      if (createBucketError) {
        logPortfolioDiagnostic({ providerProfileId, operation: "bucket_create", error: createBucketError });
        return NextResponse.json({ ok: false, code: "upload_failed", error: "Image upload failed. Please try again." }, { status: 500, headers: corsHeaders });
      }

      logPortfolioDiagnostic({ providerProfileId, operation: "bucket_create" });
    }

    const { error: uploadError } = await supabase.storage.from(PORTFOLIO_BUCKET).upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

    if (uploadError) {
      logPortfolioDiagnostic({ providerProfileId, operation: "storage_upload", error: uploadError });
      return NextResponse.json({ ok: false, code: "upload_failed", error: "Image upload failed. Please try again." }, { status: 500, headers: corsHeaders });
    }

    logPortfolioDiagnostic({ providerProfileId, operation: "storage_upload" });

    const { data: publicUrlData } = supabase.storage.from(PORTFOLIO_BUCKET).getPublicUrl(storagePath);
    const payload = buildProviderGalleryInsertPayload({
      providerProfileId,
      publicUrl: publicUrlData.publicUrl,
      caption: String(formData.get("caption") ?? "").trim() || null,
    });

    const { data: insertedRows, error: insertError } = await supabase.from("provider_gallery").insert(payload).select("id");

    if (insertError || !insertedRows?.length) {
      const { error: cleanupError } = await supabase.storage.from(PORTFOLIO_BUCKET).remove([storagePath]);
      if (cleanupError) {
        logPortfolioDiagnostic({ providerProfileId, operation: "insert_storage_cleanup", error: cleanupError });
      }

      logPortfolioDiagnostic({ providerProfileId, operation: "insert", error: insertError ?? "no_rows_inserted" });
      return NextResponse.json(
        { ok: false, code: "save_failed", error: "Portfolio item could not be saved. Please try again." },
        { status: 500, headers: corsHeaders },
      );
    }

    logPortfolioDiagnostic({ providerProfileId, operation: "insert" });

    revalidatePath("/dashboard/msme/portfolio");
    revalidatePath(`/providers/${providerProfileId}`);

    return NextResponse.json({ ok: true, itemId: insertedRows[0].id }, { headers: corsHeaders });
  } catch (error) {
    logPortfolioDiagnostic({ providerProfileId, operation: "unexpected_failure", error });
    return NextResponse.json({ ok: false, code: "upload_failed", error: "Unable to upload portfolio image right now." }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: getCredentialedCorsHeaders(request, ["POST", "OPTIONS"]),
  });
}
