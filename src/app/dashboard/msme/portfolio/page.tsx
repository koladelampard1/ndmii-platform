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

function toStorageErrorLog(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: String(error) };
  }

  const maybeError = error as { message?: unknown; name?: unknown; statusCode?: unknown; details?: unknown };
  return {
    message: typeof maybeError.message === "string" ? maybeError.message : String(maybeError.message ?? "unknown_error"),
    name: typeof maybeError.name === "string" ? maybeError.name : "StorageError",
    statusCode: maybeError.statusCode ?? null,
    details: maybeError.details ?? null,
  };
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
  const supabase = await createServerSupabaseClient();
  const kind = String(formData.get("kind") ?? "create");
  const itemId = String(formData.get("item_id") ?? "");

  if (kind === "delete" && itemId) {
    await supabase.from("provider_gallery").delete().eq("id", itemId).eq("provider_profile_id", workspace.provider.id);
  } else if (kind === "update" && itemId) {
    const payload = {
      caption: String(formData.get("caption") ?? "").trim() || null,
    };
    await supabase.from("provider_gallery").update(payload).eq("id", itemId).eq("provider_profile_id", workspace.provider.id);
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
    console.error("[msme-portfolio-upload][file_validation_failed]", {
      providerId: workspace.provider.id,
      msmeId: workspace.msme.id,
      reason: "file_missing",
    });
    return { ok: false as const, error: "file_required" as const };
  }

  const validationResult = validatePortfolioImageFile(file);
  if (!validationResult.ok) {
    console.error("[msme-portfolio-upload][file_validation_failed]", {
      providerId: workspace.provider.id,
      msmeId: workspace.msme.id,
      fileName: file.name,
      fileSizeBytes: file.size,
      mimeType: file.type || null,
      validationError: validationResult.error,
    });
    return { ok: false as const, error: validationResult.error as string };
  }

  const safeName = sanitizePortfolioFileName(file.name);
  const storagePath = `${workspace.msme.id}/${workspace.provider.id}/${Date.now()}-${safeName}`;
  const mimeType = file.type || "application/octet-stream";

  console.info("[msme-portfolio-upload][start]", {
    providerId: workspace.provider.id,
    msmeId: workspace.msme.id,
    fileName: file.name,
    fileSizeBytes: file.size,
    mimeType,
    bucket: PORTFOLIO_BUCKET,
    storagePath,
  });

  const { data: existingBucket, error: bucketLookupError } = await supabase.storage.getBucket(PORTFOLIO_BUCKET);

  if (bucketLookupError) {
    console.error("[msme-portfolio-upload][bucket_lookup_error]", {
      providerId: workspace.provider.id,
      msmeId: workspace.msme.id,
      bucket: PORTFOLIO_BUCKET,
      error: toStorageErrorLog(bucketLookupError),
    });
  }

  if (!existingBucket) {
    const { data: createdBucket, error: createBucketError } = await supabase.storage.createBucket(PORTFOLIO_BUCKET, {
      public: true,
      fileSizeLimit: `${MAX_PORTFOLIO_IMAGE_BYTES}`,
      allowedMimeTypes: Array.from(ALLOWED_PORTFOLIO_MIME_TYPES),
    });

    if (createBucketError) {
      console.error("[msme-portfolio-upload][bucket_create_failed]", {
        providerId: workspace.provider.id,
        msmeId: workspace.msme.id,
        bucket: PORTFOLIO_BUCKET,
        error: toStorageErrorLog(createBucketError),
      });
      return { ok: false as const, error: "upload_failed" as const };
    }

    console.info("[msme-portfolio-upload][bucket_created]", {
      providerId: workspace.provider.id,
      msmeId: workspace.msme.id,
      bucket: createdBucket?.name ?? PORTFOLIO_BUCKET,
    });
  }

  const { data: uploadData, error: uploadError } = await supabase.storage.from(PORTFOLIO_BUCKET).upload(storagePath, file, {
    contentType: mimeType,
    upsert: false,
  });

  if (uploadError) {
    console.error("[msme-portfolio-upload][storage_upload_failed]", {
      providerId: workspace.provider.id,
      msmeId: workspace.msme.id,
      fileName: file.name,
      fileSizeBytes: file.size,
      mimeType,
      bucket: PORTFOLIO_BUCKET,
      storagePath,
      error: toStorageErrorLog(uploadError),
    });
    return { ok: false as const, error: "upload_failed" as const };
  }

  console.info("[msme-portfolio-upload][storage_upload_result]", {
    providerId: workspace.provider.id,
    msmeId: workspace.msme.id,
    bucket: PORTFOLIO_BUCKET,
    storagePath,
    uploadPath: uploadData?.path ?? storagePath,
  });

  const { data: publicUrlData } = supabase.storage.from(PORTFOLIO_BUCKET).getPublicUrl(storagePath);
  const assetUrl = publicUrlData.publicUrl;

  const payload = buildProviderGalleryInsertPayload({
    providerProfileId: workspace.provider.id,
    publicUrl: assetUrl,
    caption: String(formData.get("caption") ?? "").trim() || null,
  });

  console.info("[msme-portfolio-upload][db_insert_payload_aligned]", {
    providerId: workspace.provider.id,
    msmeId: workspace.msme.id,
    payload,
  });

  const { data, error: insertError } = await supabase.from("provider_gallery").insert(payload).select("id");

  if (insertError) {
    console.error("[msme-portfolio-upload][db_insert_failed]", {
      providerId: workspace.provider.id,
      msmeId: workspace.msme.id,
      message: insertError.message,
      details: insertError.details,
      hint: insertError.hint,
      assetUrl,
      bucket: PORTFOLIO_BUCKET,
      storagePath,
    });
    return { ok: false as const, error: "save_failed" as const };
  }

  console.info("[msme-portfolio-upload][db_insert_result]", {
    providerId: workspace.provider.id,
    msmeId: workspace.msme.id,
    savedRecordCount: data?.length ?? 0,
    savedRecordIds: data?.map((item: Record<string, any>) => item.id) ?? [],
    bucket: PORTFOLIO_BUCKET,
    storagePath,
    assetUrl,
  });

  const reloadSnapshot = await readProviderGalleryItems({
    supabase,
    providerProfileId: workspace.provider.id,
  });

  console.info("[msme-portfolio-upload][reload_query_result]", {
    providerId: workspace.provider.id,
    msmeId: workspace.msme.id,
    sourceTable: "provider_gallery",
    itemCount: reloadSnapshot.items.length,
    itemIds: reloadSnapshot.items.map((item) => item.id),
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

  console.log("[msme-portfolio-upload][page_reload_items]", {
    providerId: workspace.provider.id,
    msmeId: workspace.msme.id,
    sourceTable: "provider_gallery",
    portfolioItemCount: gallery?.length ?? 0,
    portfolioItemIds: (gallery ?? []).map((item) => item.id),
  });

  return (
    <MsmePortfolioGalleryDashboard
      gallery={gallery ?? []}
      saved={Boolean(params.saved)}
      error={params.error ?? null}
      galleryAction={galleryAction}
      createPortfolioItemAction={createPortfolioItemAction}
      providerId={workspace.provider.id}
      msmeId={workspace.msme.id}
    />
  );
}
