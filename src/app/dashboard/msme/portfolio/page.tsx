import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MsmePortfolioGalleryDashboard } from "./portfolio-gallery-dashboard";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { buildProviderGalleryInsertPayload, readProviderGalleryItems } from "@/lib/data/provider-gallery";
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";

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

function logPortfolioDiagnostic(params: {
  providerProfileId: string;
  operation: string;
  error?: unknown;
  rowsReturnedCount?: number;
}) {
  const errorInfo = params.error ? toSupabaseErrorInfo(params.error) : { code: null, message: null };
  console.info("[msme-portfolio-gallery]", {
    providerProfileId: params.providerProfileId,
    operation: params.operation,
    supabaseErrorCode: errorInfo.code,
    supabaseErrorMessage: errorInfo.message,
    rowsReturnedCount: params.rowsReturnedCount ?? 0,
  });
}

function getPortfolioStoragePathFromPublicUrl(publicUrl: string | null) {
  const trimmed = publicUrl?.trim();
  if (!trimmed) return null;

  const publicPathMarker = `/storage/v1/object/public/${PORTFOLIO_BUCKET}/`;
  const markerIndex = trimmed.indexOf(publicPathMarker);
  if (markerIndex >= 0) {
    return decodeURIComponent(trimmed.slice(markerIndex + publicPathMarker.length).split("?")[0] ?? "");
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^\/+/, "");
  }

  return null;
}

function validatePortfolioImageFile(file: File) {
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

function toErrorPath(errorCode: string) {
  return `/dashboard/msme/portfolio?error=${encodeURIComponent(errorCode)}`;
}

async function galleryAction(formData: FormData) {
  "use server";
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();
  const kind = String(formData.get("kind") ?? "create");
  const itemId = String(formData.get("item_id") ?? "");

  if (kind === "delete" && itemId) {
    const { data: existingItem, error: lookupError } = await supabase
      .from("provider_gallery")
      .select("id,image_url")
      .eq("id", itemId)
      .eq("provider_profile_id", workspace.provider.id)
      .maybeSingle();

    if (lookupError) {
      logPortfolioDiagnostic({
        providerProfileId: workspace.provider.id,
        operation: "delete_lookup",
        error: lookupError,
        rowsReturnedCount: 0,
      });
      redirect(toErrorPath("delete_failed"));
    }

    const { data: deletedRows, error: deleteError } = await supabase
      .from("provider_gallery")
      .delete()
      .eq("id", itemId)
      .eq("provider_profile_id", workspace.provider.id)
      .select("id");

    if (deleteError || !deletedRows?.length) {
      logPortfolioDiagnostic({
        providerProfileId: workspace.provider.id,
        operation: "delete",
        error: deleteError ?? "no_rows_deleted",
        rowsReturnedCount: deletedRows?.length ?? 0,
      });
      redirect(toErrorPath("delete_failed"));
    }

    const storagePath = getPortfolioStoragePathFromPublicUrl(typeof existingItem?.image_url === "string" ? existingItem.image_url : null);
    if (storagePath) {
      const { error: removeStorageError } = await supabase.storage.from(PORTFOLIO_BUCKET).remove([storagePath]);
      if (removeStorageError) {
        logPortfolioDiagnostic({
          providerProfileId: workspace.provider.id,
          operation: "delete_storage_cleanup",
          error: removeStorageError,
          rowsReturnedCount: deletedRows.length,
        });
      }
    }

    logPortfolioDiagnostic({
      providerProfileId: workspace.provider.id,
      operation: "delete",
      rowsReturnedCount: deletedRows.length,
    });
  } else if (kind === "update" && itemId) {
    const payload = {
      caption: String(formData.get("caption") ?? "").trim() || null,
    };
    const { data: updatedRows, error: updateError } = await supabase
      .from("provider_gallery")
      .update(payload)
      .eq("id", itemId)
      .eq("provider_profile_id", workspace.provider.id)
      .select("id");

    if (updateError || !updatedRows?.length) {
      logPortfolioDiagnostic({
        providerProfileId: workspace.provider.id,
        operation: "update",
        error: updateError ?? "no_rows_updated",
        rowsReturnedCount: updatedRows?.length ?? 0,
      });
      redirect(toErrorPath("save_failed"));
    }

    logPortfolioDiagnostic({
      providerProfileId: workspace.provider.id,
      operation: "update",
      rowsReturnedCount: updatedRows.length,
    });
  } else {
    redirect(toErrorPath("upload_failed"));
  }

  revalidatePath("/dashboard/msme/portfolio");
  revalidatePath(`/providers/${workspace.provider.id}`);
  redirect("/dashboard/msme/portfolio?saved=1");
}

async function createPortfolioItemAction(formData: FormData) {
  "use server";
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();
  const file = formData.get("asset_file");

  if (!(file instanceof File)) {
    logPortfolioDiagnostic({
      providerProfileId: workspace.provider.id,
      operation: "upload_validate_file_required",
      error: "file_required",
    });
    return { ok: false as const, error: "file_required" as const };
  }

  const validationResult = validatePortfolioImageFile(file);
  if (!validationResult.ok) {
    logPortfolioDiagnostic({
      providerProfileId: workspace.provider.id,
      operation: "upload_validate",
      error: validationResult.error,
    });
    return { ok: false as const, error: validationResult.error as string };
  }

  const safeName = sanitizePortfolioFileName(file.name);
  const storagePath = `${workspace.msme.id}/${workspace.provider.id}/${Date.now()}-${safeName}`;
  const mimeType = file.type || "application/octet-stream";

  logPortfolioDiagnostic({
    providerProfileId: workspace.provider.id,
    operation: "upload_start",
  });

  const { data: existingBucket, error: bucketLookupError } = await supabase.storage.getBucket(PORTFOLIO_BUCKET);

  if (bucketLookupError) {
    logPortfolioDiagnostic({
      providerProfileId: workspace.provider.id,
      operation: "bucket_lookup",
      error: bucketLookupError,
    });
  }

  if (!existingBucket) {
    const { data: createdBucket, error: createBucketError } = await supabase.storage.createBucket(PORTFOLIO_BUCKET, {
      public: true,
      fileSizeLimit: `${MAX_PORTFOLIO_IMAGE_BYTES}`,
      allowedMimeTypes: Array.from(ALLOWED_PORTFOLIO_MIME_TYPES),
    });

    if (createBucketError) {
      logPortfolioDiagnostic({
        providerProfileId: workspace.provider.id,
        operation: "bucket_create",
        error: createBucketError,
      });
      return { ok: false as const, error: "upload_failed" as const };
    }

    logPortfolioDiagnostic({
      providerProfileId: workspace.provider.id,
      operation: "bucket_create",
      rowsReturnedCount: createdBucket ? 1 : 0,
    });
  }

  const { data: uploadData, error: uploadError } = await supabase.storage.from(PORTFOLIO_BUCKET).upload(storagePath, file, {
    contentType: mimeType,
    upsert: false,
  });

  if (uploadError) {
    logPortfolioDiagnostic({
      providerProfileId: workspace.provider.id,
      operation: "storage_upload",
      error: uploadError,
    });
    return { ok: false as const, error: "upload_failed" as const };
  }

  logPortfolioDiagnostic({
    providerProfileId: workspace.provider.id,
    operation: "storage_upload",
    rowsReturnedCount: uploadData?.path ? 1 : 0,
  });

  const { data: publicUrlData } = supabase.storage.from(PORTFOLIO_BUCKET).getPublicUrl(storagePath);
  const assetUrl = publicUrlData.publicUrl;

  const payload = buildProviderGalleryInsertPayload({
    providerProfileId: workspace.provider.id,
    publicUrl: assetUrl,
    caption: String(formData.get("caption") ?? "").trim() || null,
  });

  const { data, error: insertError } = await supabase.from("provider_gallery").insert(payload).select("id");

  if (insertError) {
    const { error: cleanupError } = await supabase.storage.from(PORTFOLIO_BUCKET).remove([storagePath]);
    if (cleanupError) {
      logPortfolioDiagnostic({
        providerProfileId: workspace.provider.id,
        operation: "insert_storage_cleanup",
        error: cleanupError,
      });
    }
    logPortfolioDiagnostic({
      providerProfileId: workspace.provider.id,
      operation: "insert",
      error: insertError,
      rowsReturnedCount: 0,
    });
    return { ok: false as const, error: "save_failed" as const };
  }

  logPortfolioDiagnostic({
    providerProfileId: workspace.provider.id,
    operation: "insert",
    rowsReturnedCount: data?.length ?? 0,
  });

  const reloadSnapshot = await readProviderGalleryItems({
    supabase,
    providerProfileId: workspace.provider.id,
  });

  logPortfolioDiagnostic({
    providerProfileId: workspace.provider.id,
    operation: "reload_after_insert",
    rowsReturnedCount: reloadSnapshot.items.length,
  });

  revalidatePath("/dashboard/msme/portfolio");
  revalidatePath(`/providers/${workspace.provider.id}`);
  return { ok: true as const };
}

export default async function MsmePortfolioPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const params = await searchParams;
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServerSupabaseClient();
  const { items: gallery } = await readProviderGalleryItems({
    supabase,
    providerProfileId: workspace.provider.id,
  });

  logPortfolioDiagnostic({
    providerProfileId: workspace.provider.id,
    operation: "page_read",
    rowsReturnedCount: gallery?.length ?? 0,
  });

  return (
    <MsmePortfolioGalleryDashboard
      gallery={gallery ?? []}
      saved={Boolean(params.saved)}
      error={params.error ?? null}
      galleryAction={galleryAction}
      createPortfolioItemAction={createPortfolioItemAction}
      providerId={workspace.provider.id}
    />
  );
}
