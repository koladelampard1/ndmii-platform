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

  const { data: existing } = await supabase
    .from("provider_profiles")
    .select("id,msme_id,display_name,business_name,slug,public_slug")
    .eq("msme_id", msme.id)
    .maybeSingle();

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
        .select("id,msme_id,display_name,business_name,slug,public_slug")
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
    .select("id,msme_id,display_name,business_name,slug,public_slug")
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

  const { data: byPath } = await supabase
    .from("provider_profiles")
    .select("id,msme_id,display_name,business_name,slug,public_slug")
    .or(`public_slug.eq.${value},slug.eq.${value},id.eq.${value}`)
    .maybeSingle();

  if (byPath?.id) return byPath as ProviderProfileRow;

  if (input.providerId?.trim()) {
    const { data: byProviderId } = await supabase
      .from("provider_profiles")
      .select("id,msme_id,display_name,business_name,slug,public_slug")
      .eq("id", input.providerId.trim())
      .maybeSingle();

    if (byProviderId?.id) return byProviderId as ProviderProfileRow;
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
