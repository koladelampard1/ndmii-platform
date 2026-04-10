import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export type NormalizedProviderProfile = {
  id: string;
  msme_id: string;
  public_slug: string;
  display_name: string | null;
};

const DEV_MODE = process.env.NODE_ENV !== "production";
const PROVIDER_PROFILE_SELECT = "id,msme_id,public_slug,display_name";

function logResolver(message: string, payload: Record<string, unknown>) {
  if (!DEV_MODE) return;
  console.info(`[provider-resolver] ${message}`, payload);
}

export async function resolvePublicProviderProfile(params: {
  providerRouteParam: string;
  allowLegacyCompatibility?: boolean;
}) {
  const providerRouteParam = params.providerRouteParam.trim();

  logResolver("route_param_received", { providerRouteParam });

  if (!providerRouteParam) {
    logResolver("provider_lookup_result", { found: false, providerId: null });
    return { provider: null, redirectToCanonicalSlug: null };
  }

  const supabase = await createServiceRoleSupabaseClient();

  logResolver("provider_lookup_query", {
    table: "provider_profiles",
    select: PROVIDER_PROFILE_SELECT,
    filter: `public_slug.eq.${providerRouteParam}`,
  });

  const { data, error } = await supabase
    .from("provider_profiles")
    .select(PROVIDER_PROFILE_SELECT)
    .eq("public_slug", providerRouteParam)
    .maybeSingle();

  if (error) {
    logResolver("provider_lookup_error", {
      filter: `public_slug.eq.${providerRouteParam}`,
      message: error.message ?? null,
      details: error.details ?? null,
      hint: error.hint ?? null,
      code: error.code ?? null,
    });
    return { provider: null, redirectToCanonicalSlug: null };
  }

  logResolver("provider_lookup_result", {
    found: Boolean(data?.id),
    providerId: data?.id ?? null,
  });

  if (!data?.id && params.allowLegacyCompatibility) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(providerRouteParam);
    const isMsmeId = /^msme-[a-z0-9-]+$/i.test(providerRouteParam);

    if (isUuid || isMsmeId) {
      let legacyQuery = supabase.from("provider_profiles").select(PROVIDER_PROFILE_SELECT).limit(1);
      if (isUuid) {
        legacyQuery = legacyQuery.or(`id.eq.${providerRouteParam},msme_id.eq.${providerRouteParam}`);
      } else {
        legacyQuery = legacyQuery.eq("msme_id", providerRouteParam.toUpperCase());
      }

      const { data: legacyData, error: legacyError } = await legacyQuery.maybeSingle();

      if (legacyError) {
        logResolver("legacy_provider_lookup_error", {
          message: legacyError.message ?? null,
          details: legacyError.details ?? null,
          hint: legacyError.hint ?? null,
          code: legacyError.code ?? null,
          providerRouteParam,
        });
      }

      if (legacyData?.id && legacyData.public_slug) {
        const provider: NormalizedProviderProfile = {
          id: legacyData.id,
          msme_id: legacyData.msme_id,
          public_slug: legacyData.public_slug,
          display_name: legacyData.display_name ?? null,
        };
        const redirectToCanonicalSlug = legacyData.public_slug;
        logResolver("legacy_provider_lookup_redirect", {
          providerRouteParam,
          providerId: provider.id,
          redirectToCanonicalSlug,
        });
        return { provider, redirectToCanonicalSlug };
      }
    }
  }

  if (!data?.id) {
    return { provider: null, redirectToCanonicalSlug: null };
  }

  const provider: NormalizedProviderProfile = {
    id: data.id,
    msme_id: data.msme_id,
    public_slug: data.public_slug,
    display_name: data.display_name ?? null,
  };

  return { provider, redirectToCanonicalSlug: null };
}
