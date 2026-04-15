import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export type NormalizedProviderProfile = {
  id: string;
  msme_id: string;
  public_slug: string;
  display_name: string | null;
};

export type ProviderPublicContext = {
  provider: NormalizedProviderProfile | null;
  provider_profile_id: string | null;
  provider_profile_msme_id: string | null;
  association_id: string | null;
  redirectToCanonicalSlug: string | null;
};

const DEV_MODE = process.env.NODE_ENV !== "production";
const PROVIDER_PROFILE_SELECT = "id,msme_id,public_slug,display_name";
let providerProfilesHasLegacySlugColumn: boolean | null = null;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  let data: { id: string; msme_id: string; public_slug: string; display_name: string | null } | null = null;
  let queryFieldUsed = "public_slug";

  const attemptLookup = async (field: string, value: string) => {
    logResolver("provider_lookup_query", {
      table: "provider_profiles",
      select: PROVIDER_PROFILE_SELECT,
      query_field: field,
      filter: `${field}.eq.${value}`,
    });
    const { data: candidate, error } = await supabase
      .from("provider_profiles")
      .select(PROVIDER_PROFILE_SELECT)
      .eq(field, value)
      .maybeSingle();

    if (error) {
      logResolver("provider_lookup_error", {
        query_field: field,
        filter: `${field}.eq.${value}`,
        message: error.message ?? null,
        details: error.details ?? null,
        hint: error.hint ?? null,
        code: error.code ?? null,
      });
      return null;
    }
    if (candidate?.id) {
      queryFieldUsed = field;
      return candidate;
    }
    return null;
  };

  data = await attemptLookup("public_slug", providerRouteParam);

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
      data = await attemptLookup("slug", providerRouteParam);
    }
  }

  if (!data?.id && UUID_PATTERN.test(providerRouteParam)) {
    data = await attemptLookup("id", providerRouteParam);
  }

  if (!data?.id && UUID_PATTERN.test(providerRouteParam)) {
    data = await attemptLookup("msme_id", providerRouteParam);
  }

  if (!data?.id) {
    const { data: msmeByPublicId, error: msmeLookupError } = await supabase
      .from("msmes")
      .select("id")
      .eq("msme_id", providerRouteParam.toUpperCase())
      .maybeSingle();
    if (msmeLookupError) {
      logResolver("provider_lookup_msme_public_id_error", {
        query_field: "msmes.msme_id",
        filter: `msme_id.eq.${providerRouteParam.toUpperCase()}`,
        message: msmeLookupError.message ?? null,
      });
    }
    if (msmeByPublicId?.id) {
      data = await attemptLookup("msme_id", msmeByPublicId.id);
      if (data?.id) queryFieldUsed = "msmes.msme_id";
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

  return {
    provider,
    redirectToCanonicalSlug:
      provider.public_slug && provider.public_slug !== providerRouteParam ? provider.public_slug : null,
  };
}

export async function resolveProviderPublicContext(params: {
  providerRouteParam: string;
}): Promise<ProviderPublicContext> {
  const resolved = await resolvePublicProviderProfile(params);
  if (!resolved.provider?.id) {
    return {
      provider: null,
      provider_profile_id: null,
      provider_profile_msme_id: null,
      association_id: null,
      redirectToCanonicalSlug: resolved.redirectToCanonicalSlug,
    };
  }

  const supabase = await createServiceRoleSupabaseClient();
  let associationLookup = supabase
    .from("msmes")
    .select("association_id")
    .limit(1);

  associationLookup = UUID_PATTERN.test(resolved.provider.msme_id)
    ? associationLookup.eq("id", resolved.provider.msme_id)
    : associationLookup.eq("msme_id", resolved.provider.msme_id.toUpperCase());

  const { data: linkedMsmeAssociation, error: associationLookupError } = await associationLookup.maybeSingle();

  if (associationLookupError) {
    logResolver("provider_context_association_lookup_failed", {
      providerId: resolved.provider.id,
      providerMsmeId: resolved.provider.msme_id,
      message: associationLookupError.message ?? null,
      details: associationLookupError.details ?? null,
      hint: associationLookupError.hint ?? null,
      code: associationLookupError.code ?? null,
    });
  }

  return {
    provider: resolved.provider,
    provider_profile_id: resolved.provider.id,
    provider_profile_msme_id: resolved.provider.msme_id,
    association_id: linkedMsmeAssociation?.association_id ?? null,
    redirectToCanonicalSlug: resolved.redirectToCanonicalSlug,
  };
}
