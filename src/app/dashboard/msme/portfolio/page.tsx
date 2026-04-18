import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MsmePortfolioGalleryDashboard } from "./portfolio-gallery-dashboard";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { sanitizePortfolioFileName, validatePortfolioImageFile } from "@/lib/msme/portfolio-upload";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const PORTFOLIO_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_PORTFOLIO_BUCKET || "provider-gallery";

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
    const file = formData.get("asset_file");
    if (!(file instanceof File)) {
      redirect(toErrorPath("file_required"));
    }

    const validationResult = validatePortfolioImageFile(file);
    if (!validationResult.ok) {
      redirect(toErrorPath(validationResult.error));
    }

    const safeName = sanitizePortfolioFileName(file.name);
    const storagePath = `${workspace.msme.id}/${workspace.provider.id}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage.from(PORTFOLIO_BUCKET).upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

    if (uploadError) {
      console.error("[msme-portfolio-upload][upload_failed]", {
        providerId: workspace.provider.id,
        storagePath,
        bucket: PORTFOLIO_BUCKET,
        message: uploadError.message,
      });
      redirect(toErrorPath("upload_failed"));
    }

    const { data: publicUrlData } = supabase.storage.from(PORTFOLIO_BUCKET).getPublicUrl(storagePath);
    const publicUrl = publicUrlData.publicUrl;

    const payload = {
      provider_id: workspace.provider.id,
      asset_url: publicUrl,
      caption: String(formData.get("caption") ?? "").trim() || null,
      is_featured: String(formData.get("is_featured") ?? "false") === "true",
      sort_order: Number(formData.get("sort_order") ?? 0) || 0,
      updated_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabase.from("provider_gallery").insert(payload);

    if (insertError) {
      console.error("[msme-portfolio-upload][save_failed]", {
        providerId: workspace.provider.id,
        storagePath,
        bucket: PORTFOLIO_BUCKET,
        message: insertError.message,
      });
      redirect(toErrorPath("save_failed"));
    }
  }

  revalidatePath("/dashboard/msme/portfolio");
  revalidatePath(`/providers/${workspace.provider.id}`);
  redirect("/dashboard/msme/portfolio?saved=1");
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

  return <MsmePortfolioGalleryDashboard gallery={gallery ?? []} saved={Boolean(params.saved)} error={params.error ?? null} galleryAction={galleryAction} />;
}
