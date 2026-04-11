import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export type NormalizedProviderProfile = {
  id: string;
  msme_id: string;
  public_slug: string;
  display_name: string | null;
};

const DEV_MODE = process.env.NODE_ENV !== "production";
const PROVIDER_PROFILE_SELECT = "id,msme_id,public_slug,display_name";
let providerProfilesHasLegacySlugColumn: boolean | null = null;

function logResolver(message: string, payload: Record<string, unknown>) {
  if (!DEV_MODE) return;
  console.info(`[provider-resolver] ${message}`, payload);
}

export async function resolvePublicProviderProfile(params: {
  providerRouteParam: string;
}) {
  const providerRouteParam = params.providerRouteParam.trim();

  logResolver("route_param_received", { providerRouteParam });

  if (!providerRouteParam) {
    logResolver("provider_lookup_result", { found: false, providerId: null });
    return { provider: null, redirectToCanonicalSlug: null };
  }

  const supabase = await createServiceRoleSupabaseClient();

  const primaryField = "public_slug";
  logResolver("provider_lookup_query", {
    table: "provider_profiles",
    select: PROVIDER_PROFILE_SELECT,
    query_field: primaryField,
    filter: `${primaryField}.eq.${providerRouteParam}`,
  });

  const { data: dataByPublicSlug, error: publicSlugError } = await supabase
    .from("provider_profiles")
    .select(PROVIDER_PROFILE_SELECT)
    .eq(primaryField, providerRouteParam)
    .maybeSingle();

  if (publicSlugError) {
    logResolver("provider_lookup_error", {
      query_field: primaryField,
      filter: `${primaryField}.eq.${providerRouteParam}`,
      message: publicSlugError.message ?? null,
      details: publicSlugError.details ?? null,
      hint: publicSlugError.hint ?? null,
      code: publicSlugError.code ?? null,
    });
    return { provider: null, redirectToCanonicalSlug: null };
  }

  let data = dataByPublicSlug;
  let queryFieldUsed = primaryField;

  if (!data?.id) {
    if (providerProfilesHasLegacySlugColumn === null) {
      const { data: columnRows, error: columnLookupError } = await supabase
        .from("information_schema.columns")
        .select("column_name")
        .eq("table_schema", "public")
        .eq("table_name", "provider_profiles")
        .eq("column_name", "slug")
        .limit(1);
      if (columnLookupError) {
        logResolver("provider_lookup_optional_slug_column_check_error", {
          message: columnLookupError.message ?? null,
          details: columnLookupError.details ?? null,
          hint: columnLookupError.hint ?? null,
          code: columnLookupError.code ?? null,
        });
      }
      providerProfilesHasLegacySlugColumn = Boolean(columnRows?.length);
    }

    if (providerProfilesHasLegacySlugColumn) {
      const fallbackField = "slug";
      logResolver("provider_lookup_query", {
        table: "provider_profiles",
        select: PROVIDER_PROFILE_SELECT,
        query_field: fallbackField,
        filter: `${fallbackField}.eq.${providerRouteParam}`,
      });
      const { data: dataByLegacySlug, error: legacySlugError } = await supabase
        .from("provider_profiles")
        .select(PROVIDER_PROFILE_SELECT)
        .eq(fallbackField, providerRouteParam)
        .maybeSingle();

      if (legacySlugError) {
        logResolver("provider_lookup_error", {
          query_field: fallbackField,
          filter: `${fallbackField}.eq.${providerRouteParam}`,
          message: legacySlugError.message ?? null,
          details: legacySlugError.details ?? null,
          hint: legacySlugError.hint ?? null,
          code: legacySlugError.code ?? null,
        });
        return { provider: null, redirectToCanonicalSlug: null };
      }

      if (dataByLegacySlug?.id) {
        data = dataByLegacySlug;
        queryFieldUsed = fallbackField;
      }
    }
  }

  if (!data?.id) {
    logResolver("provider_lookup_result", {
      found: false,
      query_field_used: queryFieldUsed,
      providerId: null,
      matched_public_slug: null,
      matched_msme_id: null,
      error: "No provider_profiles row matched route param.",
    });
    return { provider: null, redirectToCanonicalSlug: null };
  }

  const provider: NormalizedProviderProfile = {
    id: data.id,
    msme_id: data.msme_id,
    public_slug: data.public_slug,
    display_name: data.display_name ?? null,
  };

  logResolver("provider_lookup_result", {
    found: true,
    query_field_used: queryFieldUsed,
    providerId: provider.id,
    matched_public_slug: provider.public_slug,
    matched_msme_id: provider.msme_id,
    error: null,
  });

  return { provider, redirectToCanonicalSlug: null };
}
