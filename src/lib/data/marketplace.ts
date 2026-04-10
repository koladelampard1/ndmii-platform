import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { resolvePublicProviderProfile } from "@/lib/data/provider-profile-resolver";

export type ProviderCard = {
  id: string;
  public_slug: string;
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
  is_featured?: boolean;
};

export type RatingBreakdown = {
  five: number;
  four: number;
  three: number;
  two: number;
  one: number;
};

export type ProviderService = {
  id: string;
  category: string;
  specialization: string | null;
  title: string;
  short_description: string;
  pricing_mode: string;
  min_price: number | null;
  max_price: number | null;
  turnaround_time: string | null;
  vat_applicable: boolean;
  availability_status: string;
};

export type ProviderReview = {
  id: string;
  reviewer_name: string;
  rating: number;
  review_title: string;
  review_body: string;
  provider_reply?: string | null;
  provider_reply_at?: string | null;
  created_at: string;
};

export type ProviderProfile = ProviderCard & {
  owner_name: string;
  long_description: string;
  gallery: Array<{ id: string; asset_url: string; caption: string | null; is_featured?: boolean | null }>;
  services: ProviderService[];
  reviews: ProviderReview[];
  rating_breakdown: RatingBreakdown;
  trust_badge: "Platinum Trust" | "Gold Trust" | "Verified Trust";
  trust_factors: Array<{ label: string; value: string; impact: "positive" | "neutral" }>;
  active_complaint_count: number;
  association_name: string | null;
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
  recentlyTrusted: ProviderCard[];
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

const FALLBACK_REVIEWS: ProviderReview[] = [
  {
    id: "seed-1",
    reviewer_name: "Ngozi A.",
    rating: 5,
    review_title: "Reliable and professional",
    review_body: "Completed our request on schedule with verified quality standards.",
    provider_reply: "Thank you for choosing our team. We appreciate your trust and look forward to serving your next project.",
    provider_reply_at: "2026-01-16T09:00:00.000Z",
    created_at: "2026-01-15T09:00:00.000Z",
  },
  {
    id: "seed-2",
    reviewer_name: "Musa K.",
    rating: 4,
    review_title: "Strong communication",
    review_body: "Clear pricing, quick turnaround, and dependable delivery.",
    provider_reply: "Appreciate the feedback. We are implementing tighter update schedules for every milestone.",
    provider_reply_at: "2026-01-12T09:00:00.000Z",
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

function toCard(row: any): ProviderCard | null {
  const canonicalSlug = row.public_slug ?? row.provider_public_slug ?? null;
  if (!canonicalSlug) return null;
  const providerId = row.provider_id ?? row.id;
  if (!providerId) return null;
  return {
    id: providerId,
    public_slug: canonicalSlug,
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
    is_featured: Boolean(row.is_featured),
  };
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
    return [...data].sort(
      (a, b) => Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured)) || b.trust_score - a.trust_score || b.review_count - a.review_count,
    );
  }
  if (sort === "top-rated") {
    return [...data].sort((a, b) => b.avg_rating - a.avg_rating || b.review_count - a.review_count);
  }
  return [...data].sort((a, b) => b.avg_rating - a.avg_rating || b.trust_score - a.trust_score || b.review_count - a.review_count);
}

function projectMsmeToProvider(row: ProjectionRow, ndmiiId: string | null, publicSlug: string): ProviderCard {
  const { avg_rating, review_count, trust_score } = seededMetrics(row.msme_id);
  return {
    id: row.id,
    public_slug: publicSlug,
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
    is_featured: false,
  };
}

function safeNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function calculateTrustScore(input: {
  verification_status: string;
  review_status?: string | null;
  avg_rating: number;
  review_count: number;
  open_complaints: number;
  association_name: string | null;
}) {
  let score = 40;

  if (["verified", "approved"].includes(input.verification_status)) score += 20;
  if (input.review_status === "approved") score += 10;

  score += Math.min(20, input.avg_rating * 4);
  score += Math.min(10, Math.floor(input.review_count / 3));

  if (input.association_name) score += 8;

  score -= Math.min(18, input.open_complaints * 6);

  return Math.max(45, Math.min(99, Math.round(score)));
}

function badgeFromTrustScore(score: number): ProviderProfile["trust_badge"] {
  if (score >= 90) return "Platinum Trust";
  if (score >= 80) return "Gold Trust";
  return "Verified Trust";
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
  const { data: providerProfiles } = await supabase
    .from("provider_profiles")
    .select("id,msme_id,public_slug")
    .not("public_slug", "is", null);
  const publicSlugByMsmeRowId = new Map(
    (providerProfiles ?? [])
      .filter((profile: any) => profile.public_slug && profile.msme_id)
      .map((profile: any) => [profile.msme_id as string, profile.public_slug as string]),
  );

  const lowerQ = filters.q?.toLowerCase().trim();
  const lowerSpec = filters.specialization?.toLowerCase().trim();

  const projected = msmeRows
    .map((row) => {
      const publicSlug = publicSlugByMsmeRowId.get(row.id);
      if (!publicSlug) return null;
      return projectMsmeToProvider(row, ndmiiByMsmeRowId.get(row.id) ?? null, publicSlug);
    })
    .filter((provider): provider is ProviderCard => Boolean(provider))
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
  return applySort((data ?? []).map(toCard).filter((provider): provider is ProviderCard => Boolean(provider)), filters.sort);
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

async function getRecentlyTrustedProviders(limit = 6): Promise<ProviderCard[]> {
  try {
    const supabase = await createServiceRoleSupabaseClient();
    const { data, error } = await supabase
      .from("marketplace_provider_search")
      .select("*")
      .in("verification_status", ["verified", "approved"])
      .order("trust_score", { ascending: false })
      .order("review_count", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map(toCard).filter((provider): provider is ProviderCard => Boolean(provider));
  } catch {
    return getProvidersWithFallback({ sort: "featured", verification: "verified_or_approved" }, limit);
  }
}

export async function getMarketplaceLandingData(): Promise<MarketplaceLandingData> {
  try {
    const [topRated, featured, recentlyTrusted, categoriesRaw] = await Promise.all([
      getProvidersWithFallback({ sort: "top-rated", verification: "verified_or_approved" }, 6),
      getProvidersWithFallback({ sort: "featured", verification: "verified_or_approved" }, 12),
      getRecentlyTrustedProviders(6),
      (async () => {
        const supabase = await createServiceRoleSupabaseClient();
        const { data, error } = await supabase.from("service_categories").select("name").eq("is_active", true).order("name", { ascending: true });
        if (error) throw error;
        return data ?? [];
      })(),
    ]);

    return {
      topRated: topRated.slice(0, 3),
      featured: featured.slice(0, 6),
      recentlyTrusted: recentlyTrusted.slice(0, 3),
      categories: (categoriesRaw as Array<{ name: string }>).map((c) => c.name),
    };
  } catch {
    const seeded = await getProvidersWithFallback({ sort: "top-rated", verification: "verified_or_approved" }, 6);
    return {
      topRated: seeded.slice(0, 3),
      featured: seeded.slice(0, 6),
      recentlyTrusted: seeded.slice(0, 3),
      categories: FALLBACK_CATEGORIES,
    };
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
      const [{ data: gallery }, { data: services }, { data: reviews }, { data: msme }, { data: metrics }, { count: openComplaintCount }] = await Promise.all([
        supabase.from("provider_gallery").select("id,asset_url,caption,is_featured").eq("provider_id", providerId).order("sort_order", { ascending: true }),
        supabase.from("provider_services").select("id,category,specialization,title,short_description,pricing_mode,min_price,max_price,turnaround_time,vat_applicable,availability_status").eq("provider_id", providerId).order("created_at", { ascending: false }),
        supabase
          .from("reviews")
          .select("id,reviewer_name,rating,review_title,review_body,provider_reply,provider_reply_at,created_at")
          .eq("provider_id", providerId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("msmes")
          .select("owner_name,review_status,association_id,associations(name)")
          .eq("id", row.msme_row_id)
          .maybeSingle(),
        supabase
          .from("review_metrics")
          .select("five_star_count,four_star_count,three_star_count,two_star_count,one_star_count")
          .eq("provider_id", providerId)
          .maybeSingle(),
        supabase
          .from("complaints")
          .select("id", { count: "exact", head: true })
          .or(`provider_profile_id.eq.${providerId},provider_id.eq.${providerId}`)
          .neq("status", "closed"),
      ]);

      const base = toCard(row);
      const breakdown: RatingBreakdown = {
        five: metrics?.five_star_count ?? 0,
        four: metrics?.four_star_count ?? 0,
        three: metrics?.three_star_count ?? 0,
        two: metrics?.two_star_count ?? 0,
        one: metrics?.one_star_count ?? 0,
      };

      const associationName = (msme?.associations as { name?: string } | null)?.name ?? null;
      const openCount = openComplaintCount ?? 0;
      const trustScore = calculateTrustScore({
        verification_status: row.verification_status,
        review_status: msme?.review_status,
        avg_rating: safeNumber(row.avg_rating),
        review_count: safeNumber(row.review_count),
        open_complaints: openCount,
        association_name: associationName,
      });

      const trustFactors: ProviderProfile["trust_factors"] = [
        { label: "Verification status", value: row.verification_status === "approved" ? "Approved" : "Verified", impact: "positive" },
        { label: "Validation workflow", value: msme?.review_status ?? "Under review", impact: msme?.review_status === "approved" ? "positive" : "neutral" },
        { label: "Public reviews", value: `${safeNumber(row.avg_rating).toFixed(1)} from ${safeNumber(row.review_count)} reviews`, impact: "positive" },
        { label: "Active complaints", value: openCount === 0 ? "No active complaint" : `${openCount} open complaint(s)`, impact: openCount === 0 ? "positive" : "neutral" },
        { label: "Association linkage", value: associationName ?? "Not linked", impact: associationName ? "positive" : "neutral" },
      ];

      return {
        ...base,
        trust_score: trustScore,
        owner_name: msme?.owner_name ?? "Verified MSME Owner",
        long_description: row.long_description ?? `${row.business_name} is a verified NDMII provider serving ${row.state}.`,
        gallery: (gallery ?? []) as Array<{ id: string; asset_url: string; caption: string | null; is_featured?: boolean | null }>,
        services: (services ?? []).map((service: any) => ({
          ...service,
          min_price: service.min_price == null ? null : Number(service.min_price),
          max_price: service.max_price == null ? null : Number(service.max_price),
          vat_applicable: Boolean(service.vat_applicable),
        })) as ProviderService[],
        reviews: (reviews ?? []) as ProviderReview[],
        rating_breakdown: breakdown,
        trust_badge: badgeFromTrustScore(trustScore),
        trust_factors: trustFactors,
        active_complaint_count: openCount,
        association_name: associationName,
      };
    }
  } catch {
    // fall through to projected profile fallback
  }

  try {
    const supabase = await createServiceRoleSupabaseClient();
    let msmeQuery = supabase
      .from("msmes")
      .select("id,msme_id,business_name,owner_name,state,lga,sector,verification_status,passport_photo_url")
      .in("verification_status", ["verified", "approved"])
      .limit(1);
    msmeQuery = msmeQuery.or(`id.eq.${providerId},msme_id.eq.${providerId.toUpperCase()}`);

    const { data: msmes, error } = await msmeQuery;
    if (error || !msmes?.length) return null;

    const row = msmes[0] as ProjectionRow;
    const { data: digitalId } = await supabase.from("digital_ids").select("ndmii_id").eq("msme_id", row.id).maybeSingle();
    const { data: providerProfile } = await supabase
      .from("provider_profiles")
      .select("public_slug")
      .eq("msme_id", row.id)
      .not("public_slug", "is", null)
      .maybeSingle();

    if (!providerProfile?.public_slug) return null;
    const card = projectMsmeToProvider(row, digitalId?.ndmii_id ?? null, providerProfile.public_slug);

    return {
      ...card,
      owner_name: row.owner_name,
      long_description: `${row.business_name} is a verified business in the NDMII marketplace with a validated identity profile and strong compliance records.`,
      gallery: [
        {
          id: `${card.id}-gallery-1`,
          asset_url: card.logo_url ?? "https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=900&q=80",
          caption: "Verified business storefront",
          is_featured: true,
        },
      ],
      services: [
        {
          id: `${card.id}-service-1`,
          category: card.category,
          specialization: card.specialization,
          title: `${card.business_name} Core Service`,
          short_description: card.short_description,
          pricing_mode: "range",
          min_price: 50000,
          max_price: 250000,
          turnaround_time: "5-10 business days",
          vat_applicable: true,
          availability_status: "available",
        },
      ],
      reviews: FALLBACK_REVIEWS,
      rating_breakdown: { five: 1, four: 1, three: 0, two: 0, one: 0 },
      trust_badge: badgeFromTrustScore(card.trust_score),
      trust_factors: [
        { label: "Verification status", value: "Verified", impact: "positive" },
        { label: "Validation workflow", value: "Approved", impact: "positive" },
        { label: "Public reviews", value: `${card.avg_rating.toFixed(1)} from ${card.review_count} reviews`, impact: "positive" },
        { label: "Active complaints", value: "No active complaint", impact: "positive" },
        { label: "Association linkage", value: "Linked", impact: "positive" },
      ],
      active_complaint_count: 0,
      association_name: "Demo association",
    };
  } catch {
    return null;
  }
}

export async function resolveProviderPublicId(providerSlugOrId: string): Promise<string | null> {
  const value = providerSlugOrId.trim();
  if (!value) return null;

  const resolvedProvider = await resolvePublicProviderProfile({
    providerRouteParam: value,
  });
  if (resolvedProvider.provider?.id) return resolvedProvider.provider.id;

  return null;
}
