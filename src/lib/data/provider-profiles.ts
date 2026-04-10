import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

type PublicMsmeRow = {
  id: string;
  msme_id: string;
  business_name: string;
  state: string;
  sector: string;
  passport_photo_url: string | null;
};

export type ProviderProfileRow = {
  id: string;
  msme_id: string;
  display_name: string | null;
  business_name: string | null;
  slug: string | null;
  public_slug: string | null;
  updated_at?: string | null;
};

function slugifySegment(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "provider";
}

function buildStableProviderSlug(msmePublicId: string, businessName: string) {
  return `${slugifySegment(businessName)}-${slugifySegment(msmePublicId)}`;
}

function canonicalSlugScore(slug: string | null | undefined) {
  if (!slug) return -1000;
  let score = slug.length;
  if (!slug.startsWith("msme-")) score += 200;
  if (!slug.includes("ndmii-")) score += 60;
  return score;
}

function chooseCanonicalProviderProfile(rows: ProviderProfileRow[]): ProviderProfileRow | null {
  if (!rows.length) return null;
  return [...rows].sort((a, b) => {
    const slugDelta = canonicalSlugScore(b.public_slug) - canonicalSlugScore(a.public_slug);
    if (slugDelta !== 0) return slugDelta;
    const updatedA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const updatedB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    if (updatedB !== updatedA) return updatedB - updatedA;
    return a.id.localeCompare(b.id);
  })[0];
}

async function getPublicMsmeByAnyKey(input: { msmeRowId?: string | null; msmePublicId?: string | null }): Promise<PublicMsmeRow | null> {
  const supabase = await createServiceRoleSupabaseClient();

  if (input.msmeRowId?.trim()) {
    const { data } = await supabase
      .from("msmes")
      .select("id,msme_id,business_name,state,sector,passport_photo_url")
      .eq("id", input.msmeRowId.trim())
      .in("verification_status", ["verified", "approved"])
      .maybeSingle();
    if (data?.id) return data as PublicMsmeRow;
  }

  if (input.msmePublicId?.trim()) {
    const { data } = await supabase
      .from("msmes")
      .select("id,msme_id,business_name,state,sector,passport_photo_url")
      .eq("msme_id", input.msmePublicId.trim().toUpperCase())
      .in("verification_status", ["verified", "approved"])
      .maybeSingle();
    if (data?.id) return data as PublicMsmeRow;
  }

  return null;
}

export async function ensureProviderProfileForPublicMsme(input: {
  msmeRowId?: string | null;
  msmePublicId?: string | null;
}): Promise<ProviderProfileRow | null> {
  const msme = await getPublicMsmeByAnyKey(input);
  if (!msme?.id) return null;

  const supabase = await createServiceRoleSupabaseClient();
  const stableSlug = buildStableProviderSlug(msme.msme_id, msme.business_name);

  const { data: existingRows } = await supabase
    .from("provider_profiles")
    .select("id,msme_id,display_name,business_name,slug,public_slug,updated_at")
    .eq("msme_id", msme.id)
    .order("updated_at", { ascending: false })
    .limit(20);

  const existing = chooseCanonicalProviderProfile((existingRows ?? []) as ProviderProfileRow[]);

  if (existing?.id) {
    const patch: Record<string, unknown> = {};
    if (!existing.public_slug) patch.public_slug = stableSlug;
    if (!existing.slug) patch.slug = stableSlug;
    if (!existing.display_name) patch.display_name = msme.business_name;
    if (!existing.business_name) patch.business_name = msme.business_name;

    if (Object.keys(patch).length > 0) {
      const { data: updated } = await supabase
        .from("provider_profiles")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select("id,msme_id,display_name,business_name,slug,public_slug,updated_at")
        .maybeSingle();
      return (updated as ProviderProfileRow | null) ?? (existing as ProviderProfileRow);
    }

    return existing as ProviderProfileRow;
  }

  const { data: inserted } = await supabase
    .from("provider_profiles")
    .insert({
      msme_id: msme.id,
      display_name: msme.business_name,
      business_name: msme.business_name,
      slug: stableSlug,
      public_slug: stableSlug,
      short_description: `Verified NDMII provider in ${msme.state} delivering trusted ${msme.sector.toLowerCase()} services.`,
      long_description: `${msme.business_name} is a verified business in the NDMII marketplace with a validated identity profile and strong compliance records.`,
      logo_url: msme.passport_photo_url,
      passport_url: msme.passport_photo_url,
      is_verified: true,
      is_active: true,
    })
    .select("id,msme_id,display_name,business_name,slug,public_slug,updated_at")
    .maybeSingle();

  return (inserted as ProviderProfileRow | null) ?? null;
}

export async function resolveProviderProfileRow(input: {
  providerPathSegment: string;
  providerId?: string | null;
  msmeRowId?: string | null;
  msmePublicId?: string | null;
}): Promise<ProviderProfileRow | null> {
  const value = input.providerPathSegment.trim();
  if (!value) return null;

  const supabase = await createServiceRoleSupabaseClient();

  const { data: byCanonicalPath } = await supabase
    .from("provider_profiles")
    .select("id,msme_id,display_name,business_name,slug,public_slug,updated_at")
    .eq("public_slug", value)
    .limit(20);
  const canonicalBySlug = chooseCanonicalProviderProfile((byCanonicalPath ?? []) as ProviderProfileRow[]);
  if (canonicalBySlug?.id) return canonicalBySlug as ProviderProfileRow;

  const { data: byPath } = await supabase
    .from("provider_profiles")
    .select("id,msme_id,display_name,business_name,slug,public_slug,updated_at")
    .or(`slug.eq.${value},id.eq.${value}`)
    .limit(20);
  const canonicalByLegacyPath = chooseCanonicalProviderProfile((byPath ?? []) as ProviderProfileRow[]);
  if (canonicalByLegacyPath?.id) return canonicalByLegacyPath as ProviderProfileRow;

  if (input.providerId?.trim()) {
    const { data: byProviderId } = await supabase
      .from("provider_profiles")
      .select("id,msme_id,display_name,business_name,slug,public_slug,updated_at")
      .eq("id", input.providerId.trim())
      .limit(20);
    const canonicalByProviderId = chooseCanonicalProviderProfile((byProviderId ?? []) as ProviderProfileRow[]);

    if (canonicalByProviderId?.id) return canonicalByProviderId as ProviderProfileRow;
  }

  if (input.msmeRowId?.trim() || input.msmePublicId?.trim()) {
    const ensured = await ensureProviderProfileForPublicMsme({
      msmeRowId: input.msmeRowId,
      msmePublicId: input.msmePublicId,
    });
    if (ensured?.id) return ensured;
  }

  return null;
}
