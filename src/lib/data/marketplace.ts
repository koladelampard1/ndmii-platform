import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { readProviderGalleryItems } from "@/lib/data/provider-gallery";
import { resolvePublicProviderProfile } from "@/lib/data/provider-profile-resolver";

export type ProviderCard = {
  id: string;
  public_slug: string;
  msme_id: string;
  display_name: string | null;
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
  contact_email: string | null;
  contact_phone: string | null;
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

type UsableHomepageProviderProfileRow = {
  id: string;
  msme_id: string;
  public_slug: string;
  display_name: string | null;
};

type MarketplaceDevLogPayload = {
  section: string;
  stage: string;
  input_params?: Record<string, unknown>;
  select_fields?: string[];
  filters?: Record<string, unknown>;
  result_count?: number;
  first_result_sample?: unknown;
  db_error?: unknown;
  js_error?: { message: string; stack: string | null };
};

const FALLBACK_CATEGORIES = [
  "Construction & Artisan",
  "Fashion & Textiles",
  "Food Processing",
  "Professional Services",
  "Creative & Media",
  "Repairs & Maintenance",
];

const DEV_MODE = process.env.NODE_ENV !== "production";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type CategoriesFailureCause =
  | "missing_category_field"
  | "null_values"
  | "bad_aggregation_grouping"
  | "unsupported_sorting_or_counting_logic"
  | "unknown";

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
  const providerId = row.provider_id ?? row.provider_profile_id ?? row.id;
  if (!providerId) return null;
  const msmeId = row.msme_id ?? row.provider_profile_msme_id ?? null;
  if (!msmeId) return null;
  return {
    id: providerId,
    public_slug: canonicalSlug,
    msme_id: msmeId,
    display_name: row.display_name ?? row.provider_display_name ?? row.business_name ?? null,
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

function logHomepageSectionDebug(payload: {
  section: "base";
  query: string;
  select_fields: string[];
  filters: Record<string, unknown>;
  rows_returned: number;
  mapped_rows_count: number;
  first_three_mapped_rows: Array<{
    id: string;
    msme_id: string;
    public_slug: string;
    display_name: string | null;
    business_name: string;
  }>;
  error: string | null;
}) {
  if (!DEV_MODE) return;
  console.info("[homepage-marketplace]", payload);
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
  if (verification === "verified_or_approved") return ["verified", "approved"];
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
    display_name: row.business_name,
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

async function attachProviderProfileMetadata(rows: any[]) {
  if (!rows.length) return rows;
  const supabase = await createServiceRoleSupabaseClient();
  const providerIds = rows
    .map((row) => (row.provider_id ?? row.id ?? null) as string | null)
    .filter((value): value is string => Boolean(value));
  if (!providerIds.length) return rows;

  const { data: providerProfiles } = await supabase
    .from("provider_profiles")
    .select("id,msme_id,public_slug,display_name")
    .in("id", providerIds);

  const profileById = new Map((providerProfiles ?? []).map((profile: any) => [profile.id as string, profile]));

  return rows.map((row) => {
    const providerId = (row.provider_id ?? row.id) as string;
    const profile = profileById.get(providerId);
    return {
      ...row,
      provider_profile_id: profile?.id ?? providerId,
      provider_profile_msme_id: profile?.msme_id ?? null,
      provider_public_slug: profile?.public_slug ?? null,
      provider_display_name: profile?.display_name ?? null,
      public_slug: row.public_slug ?? profile?.public_slug ?? null,
      display_name: row.display_name ?? profile?.display_name ?? null,
      msme_id: row.msme_id ?? profile?.msme_id ?? null,
    };
  });
}


function normalizeSearchTerm(value: string | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function logMarketplaceSearchDebug(payload: {
  raw_search_term: string;
  normalized_search_term: string;
  query_fields_used: string[];
  result_count: number;
  first_three_matched_slugs: string[];
}) {
  if (!DEV_MODE) return;
  console.info("[marketplace-search]", payload);
}

function safeNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function devLog(payload: MarketplaceDevLogPayload) {
  if (!DEV_MODE) return;
  console.info("[marketplace-dev]", payload);
}

function classifyCategoriesFailure(error: unknown): CategoriesFailureCause {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (message.includes("column") && message.includes("name")) return "missing_category_field";
  if (message.includes("null")) return "null_values";
  if (message.includes("group") || message.includes("aggregate")) return "bad_aggregation_grouping";
  if (message.includes("order") || message.includes("sort") || message.includes("count")) return "unsupported_sorting_or_counting_logic";
  return "unknown";
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
  const normalizedSearchTerm = normalizeSearchTerm(filters.q);

  const { data: msmes, error } = await supabase
    .from("msmes")
    .select("id,msme_id,business_name,owner_name,state,lga,sector,verification_status,passport_photo_url")
    .in("verification_status", allowedStatuses);

  if (error) {
    devLog({
      section: "projected_search",
      stage: "msmes_query_error",
      input_params: { filters, limit },
      select_fields: ["id", "msme_id", "business_name", "owner_name", "state", "lga", "sector", "verification_status", "passport_photo_url"],
      filters: { verification_status: allowedStatuses },
      db_error: error,
      js_error: { message: String(error.message ?? "Unknown database error"), stack: null },
    });
    throw error;
  }

  const msmeRows = (msmes ?? []) as ProjectionRow[];
  if (msmeRows.length === 0) return [];

  const msmeRowIds = msmeRows.map((row) => row.id);
  const publicMsmeIds = msmeRows.map((row) => row.msme_id);

  const { data: digitalIds } = await supabase
    .from("digital_ids")
    .select("msme_id,ndmii_id")
    .in("msme_id", [...msmeRowIds, ...publicMsmeIds]);

  const ndmiiByMsmeRef = new Map((digitalIds ?? []).map((item: any) => [item.msme_id, item.ndmii_id as string | null]));
  const { data: providerProfiles } = await supabase
    .from("provider_profiles")
    .select("id,msme_id,public_slug")
    .not("public_slug", "is", null);

  const publicSlugByMsmeRef = new Map(
    (providerProfiles ?? [])
      .filter((profile: any) => profile.public_slug && profile.msme_id)
      .map((profile: any) => [profile.msme_id as string, profile.public_slug as string]),
  );

  const lowerQ = normalizedSearchTerm;
  const lowerSpec = filters.specialization?.toLowerCase().trim();
  const exactMsmeSearch = lowerQ.length > 0 && /^ndmii-[a-z0-9-]+$/.test(lowerQ);

  const projected = msmeRows
    .map((row) => {
      const publicSlug = publicSlugByMsmeRef.get(row.id) ?? publicSlugByMsmeRef.get(row.msme_id);
      if (!publicSlug) return null;
      return projectMsmeToProvider(row, ndmiiByMsmeRef.get(row.id) ?? ndmiiByMsmeRef.get(row.msme_id) ?? null, publicSlug);
    })
    .filter((provider): provider is ProviderCard => Boolean(provider))
    .filter((provider) => {
      if (filters.category && provider.category !== filters.category) return false;
      if (filters.state && provider.state !== filters.state) return false;
      if (filters.lga && provider.lga !== filters.lga) return false;
      if (filters.minRating && provider.avg_rating < filters.minRating) return false;
      if (lowerSpec && !(provider.specialization ?? "").toLowerCase().includes(lowerSpec)) return false;

      if (!lowerQ) return true;
      if (exactMsmeSearch) {
        return [provider.msme_id, provider.ndmii_id ?? ""].some((value) => value.toLowerCase() === lowerQ);
      }
      const text = [
        provider.business_name,
        provider.display_name ?? "",
        provider.public_slug,
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

  const sorted = applySort(projected, filters.sort).slice(0, limit);
  devLog({
    section: "projected_search",
    stage: "post_filter",
    input_params: { filters, limit, normalizedSearchTerm },
    result_count: sorted.length,
    first_result_sample: sorted[0] ?? null,
  });
  return sorted;
}

async function queryMarketplaceProviders(filters: SearchFilters = {}, limit = 24) {
  const supabase = await createServiceRoleSupabaseClient();
  const allowedStatuses = normalizeVerificationFilter(filters.verification);

  const hasSearchTerm = Boolean(filters.q?.trim());
  const normalizedSearchTerm = normalizeSearchTerm(filters.q);
  const providerSearchFields = ["provider_profiles.display_name", "provider_profiles.public_slug", "provider_profiles.msme_id"];
  const queryFieldsUsed = [...providerSearchFields, "business_name(optional_joined_data)"];

  let query = supabase
    .from("marketplace_provider_search")
    .select("*")
    .in("verification_status", allowedStatuses)
    .limit(hasSearchTerm ? Math.max(limit * 6, 120) : limit);

  if (filters.category) query = query.eq("category_name", filters.category);
  if (filters.specialization) query = query.ilike("specialization", `%${filters.specialization}%`);
  if (filters.state) query = query.eq("state", filters.state);
  if (filters.lga) query = query.eq("lga", filters.lga);
  if (filters.minRating) query = query.gte("avg_rating", filters.minRating);

  const { data, error } = await query;
  if (error) {
    devLog({
      section: "public_search",
      stage: "marketplace_provider_search_query_error",
      input_params: { filters, limit },
      select_fields: ["*"],
      filters: {
        verification_status: allowedStatuses,
        category: filters.category ?? null,
        specialization: filters.specialization ?? null,
        state: filters.state ?? null,
        lga: filters.lga ?? null,
        min_rating: filters.minRating ?? null,
      },
      db_error: error,
      js_error: { message: error.message ?? "Unknown database error", stack: null },
    });
    throw error;
  }
  const hydrated = await attachProviderProfileMetadata(data ?? []);
  const exactMsmeSearch = normalizedSearchTerm.length > 0 && /^ndmii-[a-z0-9-]+$/.test(normalizedSearchTerm);

  const searchedRows = !hasSearchTerm
    ? hydrated
    : hydrated.filter((row: any) => {
        const candidateText = [
          row?.provider_display_name,
          row?.display_name,
          row?.provider_public_slug,
          row?.public_slug,
          row?.provider_profile_msme_id,
          row?.msme_id,
          row?.ndmii_id,
          row?.business_name,
        ]
          .filter((value) => typeof value === "string" && value.trim().length > 0)
          .map((value: string) => value.toLowerCase())
          .join(" ")
          .replace(/\s+/g, " ");

        if (exactMsmeSearch) {
          return [row?.provider_profile_msme_id, row?.msme_id, row?.ndmii_id]
            .filter((value) => typeof value === "string")
            .map((value: string) => value.toLowerCase())
            .includes(normalizedSearchTerm);
        }

        return candidateText.includes(normalizedSearchTerm);
      });

  const cards = searchedRows.map(toCard).filter((provider): provider is ProviderCard => Boolean(provider));
  const sorted = applySort(cards, filters.sort).slice(0, limit);

  logMarketplaceSearchDebug({
    raw_search_term: filters.q ?? "",
    normalized_search_term: normalizedSearchTerm,
    query_fields_used: queryFieldsUsed,
    result_count: sorted.length,
    first_three_matched_slugs: sorted.slice(0, 3).map((item) => item.public_slug),
  });
  devLog({
    section: "public_search",
    stage: "post_filter",
    input_params: { filters, limit },
    select_fields: ["* + provider_profiles(id, msme_id, public_slug, display_name)"],
    result_count: sorted.length,
    first_result_sample: sorted[0] ?? null,
  });

  return sorted;
}

async function getProvidersWithFallback(filters: SearchFilters = {}, limit = 24) {
  try {
    const primary = await queryMarketplaceProviders(filters, limit);
    if (primary.length > 0) return primary;
    devLog({
      section: "public_search",
      stage: "primary_empty_fallback_to_projected",
      input_params: { filters, limit },
      result_count: 0,
    });
  } catch {
    // fall through to MSME projection
    devLog({
      section: "public_search",
      stage: "primary_failed_fallback_to_projected",
      input_params: { filters, limit },
    });
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
    const hydrated = await attachProviderProfileMetadata(data ?? []);
    return hydrated.map(toCard).filter((provider): provider is ProviderCard => Boolean(provider));
  } catch {
    return getProvidersWithFallback({ sort: "featured", verification: "verified_or_approved" }, limit);
  }
}

async function fetchHomepageProviderProfiles(): Promise<UsableHomepageProviderProfileRow[]> {
  const supabase = await createServiceRoleSupabaseClient();
  const selectFields = ["id", "msme_id", "public_slug", "display_name"];

  const { data, error } = await supabase
    .from("provider_profiles")
    .select(selectFields.join(","))
    .not("public_slug", "is", null)
    .order("display_name", { ascending: true })
    .limit(54);

  if (error) {
    devLog({
      section: "homepage-base",
      stage: "provider_profiles_query_error",
      select_fields: selectFields,
      filters: { public_slug_not_null: true, order_by: "display_name", limit: 54 },
      db_error: error,
      js_error: { message: error.message ?? "Unknown database error", stack: null },
    });
    throw error;
  }

  const rows = (data ?? []) as any[];
  return rows.filter((row: any): row is UsableHomepageProviderProfileRow => Boolean(row?.id && row?.msme_id && row?.public_slug));
}

function mapHomepageProviderProfile(row: UsableHomepageProviderProfileRow): ProviderCard {
  const safeMsmeId = typeof row?.msme_id === "string" && row.msme_id ? row.msme_id : `UNKNOWN-${row?.id ?? "ROW"}`;
  const safeDisplayName = typeof row?.display_name === "string" && row.display_name.trim() ? row.display_name.trim() : null;
  const safePublicSlug = typeof row?.public_slug === "string" && row.public_slug ? row.public_slug : `provider-${row?.id ?? "unknown"}`;
  const metrics = seededMetrics(safeMsmeId);
  return {
    id: row.id,
    msme_id: safeMsmeId,
    public_slug: safePublicSlug,
    display_name: safeDisplayName,
    ndmii_id: null,
    business_name: safeDisplayName ?? `MSME ${safeMsmeId}`,
    logo_url: null,
    category: "Professional Services",
    specialization: null,
    state: "Nigeria",
    lga: null,
    short_description: "Verified NDMII provider listed in the national marketplace directory.",
    verification_status: "verified",
    trust_score: metrics.trust_score,
    avg_rating: metrics.avg_rating,
    review_count: metrics.review_count,
    is_featured: false,
  };
}

async function queryHomepageBaseProviders(): Promise<ProviderCard[]> {
  try {
    const rawRows = await fetchHomepageProviderProfiles();
    const mappedRows = rawRows.map(mapHomepageProviderProfile);

    logHomepageSectionDebug({
      section: "base",
      query: "provider_profiles",
      select_fields: ["id", "msme_id", "public_slug", "display_name"],
      filters: {
        required_fields: ["public_slug", "display_name"],
        order_by: "display_name",
      },
      rows_returned: rawRows.length,
      mapped_rows_count: mappedRows.length,
      first_three_mapped_rows: mappedRows.slice(0, 3).map((item) => ({
        id: item.id,
        msme_id: item.msme_id,
        public_slug: item.public_slug,
        display_name: item.display_name,
        business_name: item.business_name,
      })),
      error: null,
    });

    return mappedRows;
  } catch (error) {
    logHomepageSectionDebug({
      section: "base",
      query: "provider_profiles",
      select_fields: ["id", "msme_id", "public_slug", "display_name"],
      filters: {
        required_fields: ["public_slug", "display_name"],
        order_by: "display_name",
      },
      rows_returned: 0,
      mapped_rows_count: 0,
      first_three_mapped_rows: [],
      error: error instanceof Error ? error.message : "Unknown homepage query error",
    });
    console.error("[homepage-marketplace] landing base query error", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
      raw: error,
    });
    return [];
  }
}

export async function getMarketplaceLandingData(): Promise<MarketplaceLandingData> {
  if (DEV_MODE) {
    console.info("[homepage-marketplace] getMarketplaceLandingData:start");
  }

  let baseProviders: ProviderCard[] = [];
  try {
    if (DEV_MODE) {
      console.info("[homepage-marketplace] getMarketplaceLandingData:base_provider_query:start");
    }
    baseProviders = await queryHomepageBaseProviders();
    if (DEV_MODE) {
      console.info("[homepage-marketplace] getMarketplaceLandingData:base_provider_query:done", { count: baseProviders.length });
    }
  } catch (error) {
    console.error("[homepage-marketplace] landing data error", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
      raw: error,
    });
    baseProviders = [];
  }

  let topRated: ProviderCard[] = [];
  try {
    if (DEV_MODE) {
      console.info("[homepage-marketplace] getMarketplaceLandingData:top_rated_section_build:start");
    }
    topRated = baseProviders.slice(0, 6);
    if (DEV_MODE) {
      console.info("[homepage-marketplace] getMarketplaceLandingData:top_rated_section_build:done", { count: topRated.length });
    }
  } catch (error) {
    console.error("[homepage-marketplace] top rated section failure", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
      raw: error,
    });
    topRated = [];
  }

  let featured: ProviderCard[] = [];
  try {
    if (DEV_MODE) {
      console.info("[homepage-marketplace] getMarketplaceLandingData:featured_section_build:start");
    }
    featured = baseProviders.slice(6, 12);
    if (DEV_MODE) {
      console.info("[homepage-marketplace] getMarketplaceLandingData:featured_section_build:done", { count: featured.length });
    }
  } catch (error) {
    console.error("[homepage-marketplace] featured section failure", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
      raw: error,
    });
    featured = [];
  }

  let recentlyTrusted: ProviderCard[] = [];
  try {
    if (DEV_MODE) {
      console.info("[homepage-marketplace] getMarketplaceLandingData:recent_section_build:start");
    }
    recentlyTrusted = baseProviders.slice(12, 18);
    if (DEV_MODE) {
      console.info("[homepage-marketplace] getMarketplaceLandingData:recent_section_build:done", { count: recentlyTrusted.length });
    }
  } catch (error) {
    console.error("[homepage-marketplace] recent section failure", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
      raw: error,
    });
    recentlyTrusted = [];
  }

  let categories: string[] = FALLBACK_CATEGORIES;
  try {
    const supabase = await createServiceRoleSupabaseClient();
    const possibleCategoryFields = ["name", "category_name", "title", "label"];
    const { data, error } = await supabase.from("service_categories").select("*").eq("is_active", true).limit(200);
    if (error) {
      if (DEV_MODE) {
        console.warn("[homepage-marketplace] categories query failed", {
          section: "categories",
          cause: classifyCategoriesFailure(error),
          message: error.message,
        });
      }
      categories = [];
    }

    const counts = new Map<string, number>();
    let skippedMissingField = 0;
    let skippedNullOrInvalid = 0;

    for (const row of data ?? []) {
      if (!row || typeof row !== "object") {
        skippedMissingField += 1;
        continue;
      }
      const rawName = possibleCategoryFields
        .map((field) => (row as Record<string, unknown>)[field])
        .find((value) => typeof value === "string" && value.trim().length > 0);
      if (typeof rawName !== "string" || !rawName.trim()) {
        skippedNullOrInvalid += 1;
        continue;
      }
      const categoryName = rawName.trim();
      counts.set(categoryName, (counts.get(categoryName) ?? 0) + 1);
    }

    try {
      categories = [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name]) => name);
    } catch (sortError) {
      console.error("[homepage-marketplace] categories section failure", {
        section: "categories",
        cause: "unsupported_sorting_or_counting_logic" satisfies CategoriesFailureCause,
        message: sortError instanceof Error ? sortError.message : String(sortError),
        stack: sortError instanceof Error ? sortError.stack : null,
        raw: sortError,
      });
      categories = [];
    }

    if (DEV_MODE && (skippedMissingField > 0 || skippedNullOrInvalid > 0)) {
      console.info("[homepage-marketplace] categories section sanitization", {
        section: "categories",
        skippedMissingField,
        skippedNullOrInvalid,
        categoryFieldCandidates: possibleCategoryFields,
      });
    }

    if (!categories.length) {
      const { data: providerRows, error: providerRowsError } = await supabase
        .from("marketplace_provider_search")
        .select("category_name")
        .in("verification_status", ["verified", "approved"])
        .limit(200);

      if (providerRowsError) {
        if (DEV_MODE) {
          console.warn("[homepage-marketplace] categories fallback query failed", {
            section: "categories",
            cause: classifyCategoriesFailure(providerRowsError),
            message: providerRowsError.message,
          });
        }
      } else {
        categories = [...new Set((providerRows ?? []).map((row: any) => row?.category_name).filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0))];
      }
    }

    if (!categories.length) {
      categories = FALLBACK_CATEGORIES;
    }
    devLog({
      section: "homepage-categories",
      stage: "computed_categories",
      select_fields: ["service_categories.*", "marketplace_provider_search.category_name (fallback)"],
      filters: { service_categories_is_active: true },
      result_count: categories.length,
      first_result_sample: categories[0] ?? null,
    });
  } catch (error) {
    if (DEV_MODE) {
      console.warn("[homepage-marketplace] categories section failure", {
        section: "categories",
        cause: classifyCategoriesFailure(error),
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
      });
    }
    categories = FALLBACK_CATEGORIES;
  }

  if (!topRated.length && baseProviders.length) {
    topRated = baseProviders.slice(0, 6);
  }
  if (!featured.length && baseProviders.length) {
    featured = baseProviders.slice(6, 12).length ? baseProviders.slice(6, 12) : baseProviders.slice(0, 6);
  }
  if (!recentlyTrusted.length && baseProviders.length) {
    recentlyTrusted = baseProviders.slice(12, 18).length ? baseProviders.slice(12, 18) : baseProviders.slice(0, 6);
  }

  const payload: MarketplaceLandingData = {
    topRated,
    featured,
    recentlyTrusted,
    categories,
  };

  if (DEV_MODE) {
    console.info("[homepage-marketplace] getMarketplaceLandingData:return_payload", {
      topRatedCount: payload.topRated.length,
      featuredCount: payload.featured.length,
      recentlyTrustedCount: payload.recentlyTrusted.length,
      categoryCount: payload.categories.length,
    });
  }

  return payload;
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

async function getProviderPublicPortfolio(providerId: string): Promise<Array<{ id: string; asset_url: string; caption: string | null; is_featured?: boolean | null }>> {
  try {
    const supabase = await createServiceRoleSupabaseClient();
    const { items } = await readProviderGalleryItems({
      supabase,
      providerId,
      limit: 12,
    });
    return items;
  } catch {
    return [];
  }
}

async function loadProviderSectionsFailClosed(providerId: string) {
  const [gallerySettled, servicesSettled, reviewsSettled] = await Promise.allSettled([
    getProviderPublicPortfolio(providerId),
    getProviderPublicServices(providerId),
    getProviderPublicReviews(providerId),
  ]);

  if (gallerySettled.status === "rejected") {
    console.error("[provider-public-page][profile_gallery_load_failed_closed]", {
      providerId,
      trace: gallerySettled.reason instanceof Error ? gallerySettled.reason.message : "gallery_load_failed",
    });
  }
  if (servicesSettled.status === "rejected") {
    console.error("[provider-public-page][profile_services_load_failed_closed]", {
      providerId,
      trace: servicesSettled.reason instanceof Error ? servicesSettled.reason.message : "services_load_failed",
    });
  }
  if (reviewsSettled.status === "rejected") {
    console.error("[provider-public-page][profile_reviews_load_failed_closed]", {
      providerId,
      trace: reviewsSettled.reason instanceof Error ? reviewsSettled.reason.message : "reviews_load_failed",
    });
  }

  return {
    gallery: gallerySettled.status === "fulfilled" ? gallerySettled.value : [],
    services: servicesSettled.status === "fulfilled" ? servicesSettled.value : [],
    reviews: reviewsSettled.status === "fulfilled" ? reviewsSettled.value : [],
  };
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
      const [{ gallery, services, reviews }, { data: msme }, { data: metrics }, { count: openComplaintCount }] = await Promise.all([
        loadProviderSectionsFailClosed(providerId),
        supabase
          .from("msmes")
          .select("owner_name,contact_email,contact_phone,review_status,association_id,associations(name)")
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

      const msmeRow: any = msme as any;
      const metricsRow: any = metrics as any;

      const [hydratedRow] = await attachProviderProfileMetadata([row]);
      const base = toCard(hydratedRow);
      if (!base) return null;
      const breakdown: RatingBreakdown = {
        five: metricsRow?.five_star_count ?? 0,
        four: metricsRow?.four_star_count ?? 0,
        three: metricsRow?.three_star_count ?? 0,
        two: metricsRow?.two_star_count ?? 0,
        one: metricsRow?.one_star_count ?? 0,
      };

      const associationName = (msmeRow?.associations as { name?: string } | null)?.name ?? null;
      const openCount = openComplaintCount ?? 0;
      const trustScore = calculateTrustScore({
        verification_status: row.verification_status,
        review_status: msmeRow?.review_status,
        avg_rating: safeNumber(row.avg_rating),
        review_count: safeNumber(row.review_count),
        open_complaints: openCount,
        association_name: associationName,
      });

      const trustFactors: ProviderProfile["trust_factors"] = [
        { label: "Verification status", value: row.verification_status === "approved" ? "Approved" : "Verified", impact: "positive" },
        { label: "Validation workflow", value: msmeRow?.review_status ?? "Under review", impact: msmeRow?.review_status === "approved" ? "positive" : "neutral" },
        { label: "Public reviews", value: `${safeNumber(row.avg_rating).toFixed(1)} from ${safeNumber(row.review_count)} reviews`, impact: "positive" },
        { label: "Active complaints", value: openCount === 0 ? "No active complaint" : `${openCount} open complaint(s)`, impact: openCount === 0 ? "positive" : "neutral" },
        { label: "Association linkage", value: associationName ?? "Not linked", impact: associationName ? "positive" : "neutral" },
      ];

      return {
        ...base,
        trust_score: trustScore,
        owner_name: msmeRow?.owner_name ?? "Verified MSME Owner",
        contact_email: msmeRow?.contact_email ?? null,
        contact_phone: msmeRow?.contact_phone ?? null,
        long_description: row.long_description ?? `${row.business_name} is a verified NDMII provider serving ${row.state}.`,
        gallery,
        services,
        reviews,
        rating_breakdown: breakdown,
        trust_badge: badgeFromTrustScore(trustScore),
        trust_factors: trustFactors,
        active_complaint_count: openCount,
        association_name: associationName,
      };
    }
  } catch (error) {
    console.error("[provider-public-page][profile_primary_query_failed]", {
      providerId,
      trace: error instanceof Error ? error.message : "unknown_profile_primary_query_failure",
      error,
    });
  }

  try {
    const supabase = await createServiceRoleSupabaseClient();
    let msmeQuery = supabase
      .from("msmes")
      .select("id,msme_id,business_name,owner_name,contact_email,contact_phone,state,lga,sector,verification_status,passport_photo_url")
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
        contact_email: (row as any).contact_email ?? null,
        contact_phone: (row as any).contact_phone ?? null,
        long_description: `${row.business_name} is a verified business in the NDMII marketplace with a validated identity profile and strong compliance records.`,
        gallery: [],
        services: [],
        reviews: [],
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
  } catch (error) {
    console.error("[provider-public-page][profile_projected_fallback_failed]", {
      providerId,
      trace: error instanceof Error ? error.message : "unknown_profile_projected_fallback_failure",
      error,
    });
    return null;
  }
}

export async function getProviderPublicServices(providerId: string): Promise<ProviderService[]> {
  try {
    const supabase = await createServiceRoleSupabaseClient();
    const { data, error } = await supabase
      .from("provider_services")
      .select(
        "id,category,specialization,title,short_description,pricing_mode,min_price,max_price,turnaround_time,vat_applicable,availability_status",
      )
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false })
      .limit(12);
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      id: String(row.id),
      category: row.category ?? "General Services",
      specialization: row.specialization ?? null,
      title: row.title ?? "Service",
      short_description: row.short_description ?? "No description provided yet.",
      pricing_mode: row.pricing_mode ?? "custom",
      min_price: row.min_price ?? null,
      max_price: row.max_price ?? null,
      turnaround_time: row.turnaround_time ?? null,
      vat_applicable: Boolean(row.vat_applicable),
      availability_status: row.availability_status ?? "available",
    }));
  } catch {
    return [];
  }
}

export async function getProviderPublicReviews(providerId: string): Promise<ProviderReview[]> {
  try {
    const supabase = await createServiceRoleSupabaseClient();
    const { data, error } = await supabase
      .from("reviews")
      .select("id,reviewer_name,rating,review_title,review_body,provider_reply,provider_reply_at,created_at")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      id: String(row.id),
      reviewer_name: row.reviewer_name ?? "Verified customer",
      rating: safeNumber(row.rating, 0),
      review_title: row.review_title ?? "Customer review",
      review_body: row.review_body ?? "No review body provided.",
      provider_reply: row.provider_reply ?? null,
      provider_reply_at: row.provider_reply_at ?? null,
      created_at: row.created_at ?? new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function getProviderComplaintFormContext(providerId: string): Promise<{
  active_complaint_count: number;
  association_name: string | null;
}> {
  try {
    const supabase = await createServiceRoleSupabaseClient();

    const [{ count }, { data: providerProfile }] = await Promise.all([
      supabase.from("complaints").select("id", { count: "exact", head: true }).eq("provider_profile_id", providerId).neq("status", "closed"),
      supabase.from("provider_profiles").select("msme_id").eq("id", providerId).maybeSingle(),
    ]);

    const providerMsmeId = providerProfile?.msme_id ?? null;
    let associationName: string | null = null;

    if (providerMsmeId) {
      const { data: msmeRow } = await supabase
        .from("msmes")
        .select("associations(name)")
        .eq("id", providerMsmeId)
        .maybeSingle();
      associationName = (msmeRow?.associations as { name?: string } | null)?.name ?? null;
    }

    return {
      active_complaint_count: count ?? 0,
      association_name: associationName,
    };
  } catch (error) {
    if (DEV_MODE) {
      console.error("[provider-public-page][complaint_context_load_failed]", {
        providerId,
        error,
      });
    }
    return {
      active_complaint_count: 0,
      association_name: null,
    };
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
