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
