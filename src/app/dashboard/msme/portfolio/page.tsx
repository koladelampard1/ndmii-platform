import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MsmePortfolioGalleryDashboard } from "./portfolio-gallery-dashboard";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function galleryAction(formData: FormData) {
  "use server";
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServerSupabaseClient();
  const kind = String(formData.get("kind") ?? "create");
  const itemId = String(formData.get("item_id") ?? "");

  const payload = {
    provider_id: workspace.provider.id,
    asset_url: String(formData.get("asset_url") ?? ""),
    caption: String(formData.get("caption") ?? "").trim() || null,
    is_featured: String(formData.get("is_featured") ?? "false") === "true",
    sort_order: Number(formData.get("sort_order") ?? 0) || 0,
    updated_at: new Date().toISOString(),
  };

  if (kind === "delete" && itemId) {
    await supabase.from("provider_gallery").delete().eq("id", itemId).eq("provider_id", workspace.provider.id);
  } else if (kind === "update" && itemId) {
    await supabase.from("provider_gallery").update(payload).eq("id", itemId).eq("provider_id", workspace.provider.id);
  } else {
    await supabase.from("provider_gallery").insert(payload);
  }

  revalidatePath("/dashboard/msme/portfolio");
  revalidatePath(`/providers/${workspace.provider.id}`);
  redirect("/dashboard/msme/portfolio?saved=1");
}

export default async function MsmePortfolioPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const params = await searchParams;
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServerSupabaseClient();

  const { data: gallery } = await supabase
    .from("provider_gallery")
    .select("id,asset_url,caption,is_featured,sort_order,updated_at")
    .eq("provider_id", workspace.provider.id)
    .order("sort_order", { ascending: true });

  return <MsmePortfolioGalleryDashboard gallery={gallery ?? []} saved={Boolean(params.saved)} galleryAction={galleryAction} />;
}
