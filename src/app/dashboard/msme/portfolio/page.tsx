import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MsmePortfolioGalleryDashboard } from "./portfolio-gallery-dashboard";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { readProviderGalleryItems } from "@/lib/data/provider-gallery";
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";

const PORTFOLIO_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_PORTFOLIO_BUCKET || "provider-gallery";

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
      providerId={workspace.provider.id}
    />
  );
}
