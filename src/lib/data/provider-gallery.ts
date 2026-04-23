import type { SupabaseClient } from "@supabase/supabase-js";

const PORTFOLIO_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_PORTFOLIO_BUCKET || "provider-gallery";

function toPublicAssetUrl(supabase: SupabaseClient<any>, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const cleanPath = trimmed.replace(/^\/+/, "");
  return supabase.storage.from(PORTFOLIO_BUCKET).getPublicUrl(cleanPath).data.publicUrl;
}

export function buildProviderGalleryInsertPayload(params: {
  providerProfileId: string;
  publicUrl: string;
  caption: string | null;
}) {
  const { providerProfileId, publicUrl, caption } = params;
  return {
    provider_profile_id: providerProfileId,
    image_url: publicUrl,
    caption: caption ?? null,
  };
}

export async function readProviderGalleryItems(params: {
  supabase: SupabaseClient<any>;
  providerProfileId: string;
  limit?: number;
}) {
  const { supabase, providerProfileId, limit } = params;

  let query = supabase
    .from("provider_gallery")
    .select("id,provider_profile_id,image_url,caption,created_at")
    .eq("provider_profile_id", providerProfileId)
    .order("created_at", { ascending: false });
  if (typeof limit === "number") {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;

  const normalized = (data ?? [])
    .map((item: Record<string, any>) => {
      const rawAsset = item.image_url;
      if (typeof rawAsset !== "string" || rawAsset.trim().length === 0) return null;
      return {
        id: String(item.id),
        asset_url: toPublicAssetUrl(supabase, rawAsset),
        caption: typeof item.caption === "string" ? item.caption : null,
        is_featured: false,
        sort_order: 0,
        updated_at: typeof item.created_at === "string" ? item.created_at : null,
      };
    })
    .filter(Boolean) as Array<{
    id: string;
    asset_url: string;
    caption: string | null;
    is_featured: boolean;
    sort_order: number;
    updated_at: string | null;
  }>;

  return { items: normalized };
}
