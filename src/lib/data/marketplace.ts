import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export type ProviderCard = {
  id: string;
  msme_id: string;
  ndmii_id: string | null;
  business_name: string;
  logo_url: string | null;
  category: string;
  specialization: string | null;
  state: string;
  lga: string | null;
  short_description: string;
  verification_status: string;
  trust_score: number;
  avg_rating: number;
  review_count: number;
};

export type ProviderProfile = ProviderCard & {
  owner_name: string;
  long_description: string;
  gallery: Array<{ id: string; asset_url: string; caption: string | null }>;
  reviews: Array<{
    id: string;
    reviewer_name: string;
    rating: number;
    review_title: string;
    review_body: string;
    created_at: string;
  }>;
};

export type SearchFilters = {
  q?: string;
  category?: string;
  specialization?: string;
  state?: string;
  lga?: string;
  minRating?: number;
  verification?: string;
};

export type MarketplaceLandingData = {
  topRated: ProviderCard[];
  featured: ProviderCard[];
  categories: string[];
};

const FALLBACK_CATEGORIES = [
  "Construction & Artisan",
  "Fashion & Textiles",
  "Food Processing",
  "Professional Services",
  "Creative & Media",
  "Repairs & Maintenance",
];

function toCard(row: any): ProviderCard {
  return {
    id: row.provider_id,
    msme_id: row.msme_id,
    ndmii_id: row.ndmii_id ?? null,
    business_name: row.business_name,
    logo_url: row.logo_url ?? row.passport_photo_url ?? null,
    category: row.category_name ?? row.sector ?? "General Services",
    specialization: row.specialization ?? null,
    state: row.state,
    lga: row.lga ?? null,
    short_description: row.short_description ?? "Verified NDMII provider",
    verification_status: row.verification_status ?? "verified",
    trust_score: Number(row.trust_score ?? 0),
    avg_rating: Number(row.avg_rating ?? 0),
    review_count: Number(row.review_count ?? 0),
  };
}

async function queryMarketplaceProviders(filters: SearchFilters = {}, limit = 24) {
  const supabase = await createServiceRoleSupabaseClient();

  let query = supabase
    .from("marketplace_provider_search")
    .select("*")
    .eq("verification_status", "verified")
    .or("review_status.is.null,review_status.eq.approved,review_status.eq.verified")
    .limit(limit)
    .order("avg_rating", { ascending: false })
    .order("review_count", { ascending: false })
    .order("trust_score", { ascending: false });

  if (filters.q) query = query.ilike("search_text", `%${filters.q}%`);
  if (filters.category) query = query.eq("category_name", filters.category);
  if (filters.specialization) query = query.ilike("specialization", `%${filters.specialization}%`);
  if (filters.state) query = query.eq("state", filters.state);
  if (filters.lga) query = query.eq("lga", filters.lga);
  if (filters.minRating) query = query.gte("avg_rating", filters.minRating);
  if (filters.verification === "verified") query = query.eq("verification_status", "verified");

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(toCard);
}

export async function getMarketplaceLandingData(): Promise<MarketplaceLandingData> {
  try {
    const [topRated, featured, categoriesRaw] = await Promise.all([
      queryMarketplaceProviders({}, 6),
      queryMarketplaceProviders({}, 12),
      (async () => {
        const supabase = await createServiceRoleSupabaseClient();
        const { data, error } = await supabase
          .from("service_categories")
          .select("name")
          .eq("is_active", true)
          .order("name", { ascending: true });
        if (error) throw error;
        return data ?? [];
      })(),
    ]);

    return {
      topRated: topRated.slice(0, 3),
      featured: featured.slice(0, 6),
      categories: (categoriesRaw as Array<{ name: string }>).map((c) => c.name),
    };
  } catch {
    return { topRated: [], featured: [], categories: FALLBACK_CATEGORIES };
  }
}

export async function searchMarketplaceProviders(filters: SearchFilters): Promise<ProviderCard[]> {
  try {
    return await queryMarketplaceProviders(filters);
  } catch {
    return [];
  }
}

export async function getMarketplaceFilterOptions() {
  try {
    const supabase = await createServiceRoleSupabaseClient();
    const [{ data: categories }, { data: states }, { data: lgas }] = await Promise.all([
      supabase.from("service_categories").select("name").eq("is_active", true).order("name", { ascending: true }),
      supabase.from("provider_locations").select("state"),
      supabase.from("provider_locations").select("lga"),
    ]);

    return {
      categories: [...new Set((categories ?? []).map((row: any) => row.name))],
      states: [...new Set((states ?? []).map((row: any) => row.state).filter(Boolean))],
      lgas: [...new Set((lgas ?? []).map((row: any) => row.lga).filter(Boolean))],
    };
  } catch {
    return { categories: FALLBACK_CATEGORIES, states: [], lgas: [] };
  }
}

export async function getProviderPublicProfile(providerId: string): Promise<ProviderProfile | null> {
  try {
    const supabase = await createServiceRoleSupabaseClient();

    const { data: row, error } = await supabase
      .from("marketplace_provider_search")
      .select("*")
      .eq("provider_id", providerId)
      .eq("verification_status", "verified")
      .or("review_status.is.null,review_status.eq.approved,review_status.eq.verified")
      .maybeSingle();

    if (error || !row) return null;

    const [{ data: gallery }, { data: reviews }, { data: msme }] = await Promise.all([
      supabase.from("provider_gallery").select("id,asset_url,caption").eq("provider_id", providerId).order("sort_order", { ascending: true }),
      supabase
        .from("reviews")
        .select("id,reviewer_name,rating,review_title,review_body,created_at")
        .eq("provider_id", providerId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("msmes").select("owner_name").eq("id", row.msme_row_id).maybeSingle(),
    ]);

    const base = toCard(row);

    return {
      ...base,
      owner_name: msme?.owner_name ?? "Verified MSME Owner",
      long_description: row.long_description ?? `${row.business_name} is a verified NDMII provider serving ${row.state}.`,
      gallery: (gallery ?? []) as Array<{ id: string; asset_url: string; caption: string | null }>,
      reviews: (reviews ?? []) as Array<{
        id: string;
        reviewer_name: string;
        rating: number;
        review_title: string;
        review_body: string;
        created_at: string;
      }>,
    };
  } catch {
    return null;
  }
}
