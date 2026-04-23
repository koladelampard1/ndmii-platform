import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MsmePortfolioGalleryDashboard } from "./portfolio-gallery-dashboard";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
    await supabase.from("provider_gallery").delete().eq("id", itemId).eq("provider_id", workspace.provider.id);
  } else if (kind === "update" && itemId) {
    const payload = {
      caption: String(formData.get("caption") ?? "").trim() || null,
      is_featured: String(formData.get("is_featured") ?? "false") === "true",
      sort_order: Number(formData.get("sort_order") ?? 0) || 0,
      updated_at: new Date().toISOString(),
    };
    await supabase.from("provider_gallery").update(payload).eq("id", itemId).eq("provider_id", workspace.provider.id);
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
  const supabase = await createServerSupabaseClient();
  const assetUrl = String(formData.get("asset_url") ?? "").trim();

  if (!assetUrl) {
    return { ok: false as const, error: "file_required" as const };
  }

  const payload = {
    provider_id: workspace.provider.id,
    asset_url: assetUrl,
    caption: String(formData.get("caption") ?? "").trim() || null,
    is_featured: String(formData.get("is_featured") ?? "false") === "true",
    sort_order: Number(formData.get("sort_order") ?? 0) || 0,
    updated_at: new Date().toISOString(),
  };

  const { data, error: insertError } = await supabase.from("provider_gallery").insert(payload).select("id");

  if (insertError) {
    console.error("[msme-portfolio-upload][save_failed]", {
      providerId: workspace.provider.id,
      message: insertError.message,
      assetUrl,
    });
    return { ok: false as const, error: "save_failed" as const };
  }

  console.log("[msme-portfolio-upload][saved_db_records]", {
    providerId: workspace.provider.id,
    savedRecordCount: data?.length ?? 0,
  });

  revalidatePath("/dashboard/msme/portfolio");
  revalidatePath(`/providers/${workspace.provider.id}`);
  return { ok: true as const };
}

export default async function MsmePortfolioPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const params = await searchParams;
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServerSupabaseClient();

  const { data: gallery } = await supabase
    .from("provider_gallery")
    .select("id,asset_url,caption,is_featured,sort_order,updated_at")
    .eq("provider_id", workspace.provider.id)
    .order("sort_order", { ascending: true });

  console.log("[msme-portfolio-upload][page_reload_items]", {
    providerId: workspace.provider.id,
    portfolioItemCount: gallery?.length ?? 0,
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
