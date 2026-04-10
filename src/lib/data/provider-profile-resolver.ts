import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export type NormalizedProviderProfile = {
  id: string;
  msme_id: string;
  public_slug: string;
  display_name: string | null;
};

const DEV_MODE = process.env.NODE_ENV !== "production";
const PROVIDER_PROFILE_SELECT = "id,msme_id,public_slug,display_name,slug,updated_at,created_at";

function logResolver(message: string, payload: Record<string, unknown>) {
  if (!DEV_MODE) return;
  console.info(`[provider-resolver] ${message}`, payload);
}

function isLikelyHumanReadableSlug(value: string | null | undefined) {
  if (!value) return false;
  if (value.startsWith("msme-")) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(value);
}

function toCanonicalSlug(row: { public_slug?: string | null; slug?: string | null; id: string }) {
  return row.public_slug?.trim() || row.slug?.trim() || row.id;
}

async function backfillProviderProfileForMsme(msmePublicId: string) {
  const supabase = await createServiceRoleSupabaseClient();
  const normalizedMsmeId = msmePublicId.trim().toUpperCase();

  const { data: msme, error: msmeError } = await supabase
    .from("msmes")
    .select("id,msme_id,business_name")
    .eq("msme_id", normalizedMsmeId)
    .in("verification_status", ["verified", "approved"])
    .maybeSingle();

  if (msmeError || !msme?.id) {
    logResolver("legacy_msme_lookup_failed", { msmePublicId: normalizedMsmeId, error: msmeError?.message ?? null });
    return null;
  }

  const { data: candidates, error: candidatesError } = await supabase
    .from("provider_profiles")
    .select(PROVIDER_PROFILE_SELECT)
    .eq("msme_id", msme.id)
    .order("updated_at", { ascending: false });

  logResolver("backfill_candidates", {
    msmePublicId: normalizedMsmeId,
    table: "provider_profiles",
    select: PROVIDER_PROFILE_SELECT,
    filter: `msme_id.eq.${msme.id}`,
    count: candidates?.length ?? 0,
    queryError: candidatesError?.message ?? null,
  });

  if (candidatesError) return null;

  const rows = candidates ?? [];
  if (!rows.length) {
    const fallbackSlugBase = `${(msme.business_name ?? "provider")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")}-${normalizedMsmeId.toLowerCase()}`;

    const fallbackSlug = fallbackSlugBase || normalizedMsmeId.toLowerCase();

    const { data: inserted, error: insertError } = await supabase
      .from("provider_profiles")
      .insert({
        msme_id: msme.id,
        display_name: msme.business_name,
        public_slug: fallbackSlug,
        slug: fallbackSlug,
      })
      .select("id,msme_id,public_slug,display_name")
      .maybeSingle();

    logResolver("backfill_insert_provider_profile", {
      msmePublicId: normalizedMsmeId,
      slug: fallbackSlug,
      queryError: insertError?.message ?? null,
      insertedId: inserted?.id ?? null,
    });

    return insertError ? null : ((inserted as NormalizedProviderProfile | null) ?? null);
  }

  const [canonical] = [...rows].sort((a, b) => {
    const aScore = Number(isLikelyHumanReadableSlug(a.public_slug)) * 3 + Number(Boolean(a.public_slug)) * 2 + Number(Boolean(a.slug));
    const bScore = Number(isLikelyHumanReadableSlug(b.public_slug)) * 3 + Number(Boolean(b.public_slug)) * 2 + Number(Boolean(b.slug));
    if (aScore !== bScore) return bScore - aScore;
    return String(b.updated_at ?? b.created_at ?? "").localeCompare(String(a.updated_at ?? a.created_at ?? ""));
  });

  const canonicalSlug = toCanonicalSlug(canonical);
  if (!canonical.public_slug || canonical.public_slug !== canonicalSlug) {
    const { error: canonicalUpdateError } = await supabase
      .from("provider_profiles")
      .update({ public_slug: canonicalSlug, updated_at: new Date().toISOString() })
      .eq("id", canonical.id);

    logResolver("backfill_canonical_slug_update", {
      msmePublicId: normalizedMsmeId,
      canonicalId: canonical.id,
      canonicalSlug,
      queryError: canonicalUpdateError?.message ?? null,
    });
  }

  return {
    id: canonical.id,
    msme_id: canonical.msme_id,
    public_slug: canonicalSlug,
    display_name: canonical.display_name,
  } satisfies NormalizedProviderProfile;
}

export async function resolvePublicProviderProfile(params: {
  providerRouteParam: string;
  allowSlugFallback?: boolean;
  allowLegacyMsmeFallback?: boolean;
}) {
  const providerRouteParam = params.providerRouteParam.trim();
  if (!providerRouteParam) return { provider: null, redirectToCanonicalSlug: null };

  const supabase = await createServiceRoleSupabaseClient();
  logResolver("provider_route_param_received", { providerRouteParam });

  logResolver("provider_lookup_query_fields", {
    table: "provider_profiles",
    select: "id,msme_id,public_slug,display_name",
    filter: `public_slug.eq.${providerRouteParam}`,
  });

  const { data: byPublicSlug, error: byPublicSlugError } = await supabase
    .from("provider_profiles")
    .select("id,msme_id,public_slug,display_name")
    .eq("public_slug", providerRouteParam)
    .maybeSingle();

  if (byPublicSlugError) {
    logResolver("provider_lookup_query_error", {
      filter: `public_slug.eq.${providerRouteParam}`,
      message: byPublicSlugError.message ?? null,
      details: byPublicSlugError.details ?? null,
      hint: byPublicSlugError.hint ?? null,
      code: byPublicSlugError.code ?? null,
    });
  }

  if (byPublicSlug?.id) {
    const provider = byPublicSlug as NormalizedProviderProfile;
    logResolver("canonical_provider_row_selected", provider);
    return { provider, redirectToCanonicalSlug: null };
  }

  if (params.allowSlugFallback !== false) {
    logResolver("provider_lookup_query_fields", {
      table: "provider_profiles",
      select: "id,msme_id,public_slug,display_name,slug",
      filter: `slug.eq.${providerRouteParam}`,
    });

    const { data: bySlug, error: bySlugError } = await supabase
      .from("provider_profiles")
      .select("id,msme_id,public_slug,display_name,slug")
      .eq("slug", providerRouteParam)
      .maybeSingle();

    if (bySlugError) {
      logResolver("provider_lookup_query_error", {
        filter: `slug.eq.${providerRouteParam}`,
        message: bySlugError.message ?? null,
        details: bySlugError.details ?? null,
        hint: bySlugError.hint ?? null,
        code: bySlugError.code ?? null,
      });
    }

    if (bySlug?.id) {
      const canonicalSlug = bySlug.public_slug?.trim() || bySlug.slug?.trim();
      const provider = {
        id: bySlug.id,
        msme_id: bySlug.msme_id,
        public_slug: canonicalSlug ?? providerRouteParam,
        display_name: bySlug.display_name,
      } satisfies NormalizedProviderProfile;
      logResolver("canonical_provider_row_selected", provider);

      if (provider.public_slug !== providerRouteParam) {
        logResolver("redirect_to_canonical_slug", { from: providerRouteParam, to: provider.public_slug });
        return { provider, redirectToCanonicalSlug: provider.public_slug };
      }

      return { provider, redirectToCanonicalSlug: null };
    }
  }

  if (params.allowLegacyMsmeFallback !== false) {
    const legacy = await backfillProviderProfileForMsme(providerRouteParam);
    if (legacy?.id) {
      logResolver("canonical_provider_row_selected", legacy);
      if (legacy.public_slug !== providerRouteParam) {
        logResolver("redirect_to_canonical_slug", { from: providerRouteParam, to: legacy.public_slug });
        return { provider: legacy, redirectToCanonicalSlug: legacy.public_slug };
      }
      return { provider: legacy, redirectToCanonicalSlug: null };
    }
  }

  return { provider: null, redirectToCanonicalSlug: null };
}
