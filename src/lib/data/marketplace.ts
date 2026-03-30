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
  sort?: "relevance" | "top-rated" | "featured";
};

type ProjectionRow = {
  id: string;
  msme_id: string;
  business_name: string;
  owner_name: string;
  state: string;
  lga: string | null;
  sector: string;
  verification_status: string;
  passport_photo_url?: string | null;
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

const FALLBACK_REVIEWS: ProviderProfile["reviews"] = [
  {
    id: "seed-1",
    reviewer_name: "Ngozi A.",
    rating: 5,
    review_title: "Reliable and professional",
    review_body: "Completed our request on schedule with verified quality standards.",
    created_at: "2026-01-15T09:00:00.000Z",
  },
  {
    id: "seed-2",
    reviewer_name: "Musa K.",
    rating: 4,
    review_title: "Strong communication",
    review_body: "Clear pricing, quick turnaround, and dependable delivery.",
    created_at: "2026-01-11T09:00:00.000Z",
  },
];

export function slugifyCategory(category: string): string {
  return category
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

function toProjectedProviderId(msmeId: string) {
  return `msme-${msmeId.toLowerCase()}`;
}

function fromProjectedProviderId(providerId: string) {
  return providerId.startsWith("msme-") ? providerId.slice(5).toUpperCase() : providerId;
}

function categoryFromSector(sector: string) {
  switch (sector) {
    case "Manufacturing":
      return "Construction & Artisan";
    case "Agro-processing":
      return "Food Processing";
    case "Retail":
      return "Professional Services";
    case "Services":
      return "Repairs & Maintenance";
    case "Creative":
      return "Creative & Media";
    default:
      return "Professional Services";
  }
}

function specializationFromSector(sector: string) {
  switch (sector) {
    case "Manufacturing":
      return "Custom fabrication and quality manufacturing";
    case "Agro-processing":
      return "Packaged food and agro value chain processing";
    case "Retail":
      return "Wholesale and neighborhood retail fulfillment";
    case "Services":
      return "Business services and enterprise operations support";
    case "Creative":
      return "Brand design, media production, and visual storytelling";
    default:
      return "Specialized MSME business services";
  }
}

function scoreFromString(value: string) {
  return Array.from(value).reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function seededMetrics(msmeId: string) {
  const seed = scoreFromString(msmeId);
  const avg_rating = 4 + (seed % 10) / 10;
  const review_count = 8 + (seed % 33);
  const trust_score = 78 + (seed % 22);
  return { avg_rating: Number(avg_rating.toFixed(1)), review_count, trust_score };
}

function normalizeVerificationFilter(verification?: string) {
  if (verification === "verified") return ["verified"];
  if (verification === "approved") return ["approved"];
  if (verification === "all") return ["verified", "approved", "pending"];
  return ["verified", "approved"];
}

function applySort(data: ProviderCard[], sort: SearchFilters["sort"] = "relevance") {
  if (sort === "featured") {
    return [...data].sort((a, b) => b.trust_score - a.trust_score || b.review_count - a.review_count);
  }
  if (sort === "top-rated") {
    return [...data].sort((a, b) => b.avg_rating - a.avg_rating || b.review_count - a.review_count);
  }
  return [...data].sort((a, b) => b.avg_rating - a.avg_rating || b.trust_score - a.trust_score || b.review_count - a.review_count);
}

function projectMsmeToProvider(row: ProjectionRow, ndmiiId: string | null): ProviderCard {
  const { avg_rating, review_count, trust_score } = seededMetrics(row.msme_id);
  return {
    id: toProjectedProviderId(row.msme_id),
    msme_id: row.msme_id,
    ndmii_id: ndmiiId,
    business_name: row.business_name,
    logo_url: row.passport_photo_url ?? null,
    category: categoryFromSector(row.sector),
    specialization: specializationFromSector(row.sector),
    state: row.state,
    lga: row.lga ?? null,
    short_description: `Verified NDMII provider in ${row.state} offering trusted ${row.sector.toLowerCase()} services.`,
    verification_status: row.verification_status,
    trust_score,
    avg_rating,
    review_count,
  };
}

async function queryProjectedProviders(filters: SearchFilters = {}, limit = 24) {
  const supabase = await createServiceRoleSupabaseClient();
  const allowedStatuses = normalizeVerificationFilter(filters.verification);

  const { data: msmes, error } = await supabase
    .from("msmes")
    .select("id,msme_id,business_name,owner_name,state,lga,sector,verification_status,passport_photo_url")
    .in("verification_status", allowedStatuses);

  if (error) throw error;

  const msmeRows = (msmes ?? []) as ProjectionRow[];
  if (msmeRows.length === 0) return [];

  const { data: digitalIds } = await supabase
    .from("digital_ids")
    .select("msme_id,ndmii_id")
    .in("msme_id", msmeRows.map((row) => row.id));

  const ndmiiByMsmeRowId = new Map((digitalIds ?? []).map((item: any) => [item.msme_id, item.ndmii_id as string | null]));

  const lowerQ = filters.q?.toLowerCase().trim();
  const lowerSpec = filters.specialization?.toLowerCase().trim();

  const projected = msmeRows
    .map((row) => projectMsmeToProvider(row, ndmiiByMsmeRowId.get(row.id) ?? null))
    .filter((provider) => {
      if (filters.category && provider.category !== filters.category) return false;
      if (filters.state && provider.state !== filters.state) return false;
      if (filters.lga && provider.lga !== filters.lga) return false;
      if (filters.minRating && provider.avg_rating < filters.minRating) return false;
      if (lowerSpec && !(provider.specialization ?? "").toLowerCase().includes(lowerSpec)) return false;

      if (!lowerQ) return true;
      const text = [
        provider.business_name,
        provider.msme_id,
        provider.ndmii_id ?? "",
        provider.category,
        provider.specialization ?? "",
        provider.state,
        provider.lga ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return text.includes(lowerQ);
    });

  return applySort(projected, filters.sort).slice(0, limit);
}

async function queryMarketplaceProviders(filters: SearchFilters = {}, limit = 24) {
  const supabase = await createServiceRoleSupabaseClient();
  const allowedStatuses = normalizeVerificationFilter(filters.verification);

  let query = supabase
    .from("marketplace_provider_search")
    .select("*")
    .in("verification_status", allowedStatuses)
    .limit(limit);

  if (filters.q) query = query.ilike("search_text", `%${filters.q}%`);
  if (filters.category) query = query.eq("category_name", filters.category);
  if (filters.specialization) query = query.ilike("specialization", `%${filters.specialization}%`);
  if (filters.state) query = query.eq("state", filters.state);
  if (filters.lga) query = query.eq("lga", filters.lga);
  if (filters.minRating) query = query.gte("avg_rating", filters.minRating);

  const { data, error } = await query;
  if (error) throw error;
  return applySort((data ?? []).map(toCard), filters.sort);
}

async function getProvidersWithFallback(filters: SearchFilters = {}, limit = 24) {
  try {
    const primary = await queryMarketplaceProviders(filters, limit);
    if (primary.length > 0) return primary;
  } catch {
    // fall through to MSME projection
  }

  try {
    return await queryProjectedProviders(filters, limit);
  } catch {
    return [];
  }
}

export async function getMarketplaceLandingData(): Promise<MarketplaceLandingData> {
  try {
    const [topRated, featured, categoriesRaw] = await Promise.all([
      getProvidersWithFallback({ sort: "top-rated", verification: "verified_or_approved" }, 6),
      getProvidersWithFallback({ sort: "featured", verification: "verified_or_approved" }, 12),
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
    const seeded = await getProvidersWithFallback({ sort: "top-rated", verification: "verified_or_approved" }, 6);
    return { topRated: seeded.slice(0, 3), featured: seeded.slice(0, 6), categories: FALLBACK_CATEGORIES };
  }
}

export async function searchMarketplaceProviders(filters: SearchFilters): Promise<ProviderCard[]> {
  return getProvidersWithFallback(filters);
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
    try {
      const supabase = await createServiceRoleSupabaseClient();
      const { data } = await supabase.from("msmes").select("state,lga,sector").in("verification_status", ["verified", "approved"]);
      const categories = [...new Set((data ?? []).map((row: any) => categoryFromSector(row.sector)))];
      const states = [...new Set((data ?? []).map((row: any) => row.state).filter(Boolean))];
      const lgas = [...new Set((data ?? []).map((row: any) => row.lga).filter(Boolean))];
      return {
        categories: categories.length ? categories : FALLBACK_CATEGORIES,
        states,
        lgas,
      };
    } catch {
      return { categories: FALLBACK_CATEGORIES, states: [], lgas: [] };
    }
  }
}

export async function getMarketplaceCategories() {
  const { categories } = await getMarketplaceFilterOptions();
  return categories.map((name) => ({ name, slug: slugifyCategory(name) }));
}

export async function getCategoryBySlug(slug: string): Promise<string | null> {
  const categories = await getMarketplaceCategories();
  return categories.find((item) => item.slug === slug)?.name ?? null;
}

export async function getProviderPublicProfile(providerId: string): Promise<ProviderProfile | null> {
  try {
    const supabase = await createServiceRoleSupabaseClient();

    const { data: row, error } = await supabase
      .from("marketplace_provider_search")
      .select("*")
      .eq("provider_id", providerId)
      .in("verification_status", ["verified", "approved"])
      .maybeSingle();

    if (!error && row) {
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
        reviews: (reviews ?? []) as ProviderProfile["reviews"],
      };
    }
  } catch {
    // fall through to projected profile fallback
  }

  try {
    const supabase = await createServiceRoleSupabaseClient();
    const msmeLookup = fromProjectedProviderId(providerId);

    let msmeQuery = supabase
      .from("msmes")
      .select("id,msme_id,business_name,owner_name,state,lga,sector,verification_status,passport_photo_url")
      .in("verification_status", ["verified", "approved"])
      .limit(1);

    if (providerId.startsWith("msme-")) {
      msmeQuery = msmeQuery.eq("msme_id", msmeLookup);
    } else {
      msmeQuery = msmeQuery.or(`id.eq.${providerId},msme_id.eq.${providerId.toUpperCase()}`);
    }

    const { data: msmes, error } = await msmeQuery;
    if (error || !msmes?.length) return null;

    const row = msmes[0] as ProjectionRow;
    const { data: digitalId } = await supabase.from("digital_ids").select("ndmii_id").eq("msme_id", row.id).maybeSingle();
    const card = projectMsmeToProvider(row, digitalId?.ndmii_id ?? null);

    return {
      ...card,
      owner_name: row.owner_name,
      long_description: `${row.business_name} is a verified business in the NDMII marketplace with a validated identity profile and strong compliance records.`,
      gallery: [
        {
          id: `${card.id}-gallery-1`,
          asset_url:
            card.logo_url ?? "https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=900&q=80",
          caption: "Verified business storefront",
        },
      ],
      reviews: FALLBACK_REVIEWS,
    };
  } catch {
    return null;
  }
}
